import { describe, expect, it } from "vitest";
import {
  getMagicAnimationOptions,
  MAGIC_ELEMENTS,
  MAGIC_ANIMATION_COUNT,
  MAGIC_SPEED_OPTIONS,
  ZODIAC_CONSTELLATIONS,
  makeMagicCircleStrokes
} from "../lib/magicCircle";
import {
  angularDifferenceDegrees,
  bearingDegrees,
  destinationPoint,
  haversineDistanceMeters
} from "../lib/geo";
import type { Poi, StarMode, StarResult } from "../types";

const TEST_CENTER = { lat: 25, lng: 121 };

const makePoi = (index: number, mode: StarMode): Poi => ({
  id: `poi-${mode}-${index}`,
  osmType: "node",
  osmId: index,
  name: `Point ${index + 1}`,
  lat: 25 + index * 0.01,
  lng: 121 + index * 0.01,
  categoryId: "temple",
  categoryLabel: "Temple",
  categoryColor: "#263fd1",
  tags: {},
  distanceMeters: 1000,
  bearingDeg: (360 / mode) * index
});

const makeResult = (mode: StarMode): StarResult => ({
  id: `star-${mode}`,
  mode,
  center: TEST_CENTER,
  points: Array.from({ length: mode }, (_, index) => makePoi(index, mode)),
  score: 0.1,
  rotationDeg: 12,
  radiusMeanMeters: 1600,
  radiusStdMeters: 20,
  angleErrorDeg: 1.5,
  centerErrorMeters: 0,
  createdAt: "2026-05-21T00:00:00.000Z"
});

const makePoiAtBearing = (
  index: number,
  mode: StarMode,
  bearingDeg: number
): Poi => {
  const distanceMeters = 1450 + index * 85;
  const position = destinationPoint(TEST_CENTER, distanceMeters, bearingDeg);

  return {
    ...makePoi(index, mode),
    lat: position.lat,
    lng: position.lng,
    distanceMeters,
    bearingDeg
  };
};

const makeResultWithBearings = (
  mode: StarMode,
  bearings: number[]
): StarResult => ({
  ...makeResult(mode),
  points: bearings.map((bearing, index) =>
    makePoiAtBearing(index, mode, bearing)
  ),
  radiusMeanMeters:
    bearings.reduce((total, _bearing, index) => total + 1450 + index * 85, 0) /
    bearings.length
});

const pointPosition = (point: Poi) => ({ lat: point.lat, lng: point.lng });

describe("magic circle animations", () => {
  it("offers 16 element-named choices for every pattern", () => {
    for (const mode of [4, 5, 6, 7, 8] as const) {
      expect(getMagicAnimationOptions(mode)).toHaveLength(MAGIC_ANIMATION_COUNT);
    }
    expect(MAGIC_ANIMATION_COUNT).toBe(16);
    expect(getMagicAnimationOptions(5).map((option) => option.label)).toEqual(
      MAGIC_ELEMENTS.map((element) => `${element.name}魔法陣`)
    );
  });

  it("offers the requested playback speeds", () => {
    expect(MAGIC_SPEED_OPTIONS).toEqual([0.25, 0.5, 1, 2, 4]);
  });

  it("adds 16 sequential rune strokes around each magic circle", () => {
    for (const mode of [4, 5, 6, 7, 8] as const) {
      const strokes = makeMagicCircleStrokes(makeResult(mode), 3);
      const runeStrokes = strokes.filter((stroke) =>
        stroke.id.startsWith("rune-")
      );

      expect(runeStrokes).toHaveLength(MAGIC_ANIMATION_COUNT);
      expect(
        strokes.some((stroke) => stroke.className.includes("star-line"))
      ).toBe(true);
    }
  });

  it("adds rose curve and Sierpinski triangle geometry to the seal", () => {
    const result = makeResult(5);
    const strokes = makeMagicCircleStrokes(result, 14);
    const roseCurve = strokes.find((stroke) => stroke.id === "rose-curve");
    const sierpinskiTriangles = strokes.filter((stroke) =>
      stroke.id.startsWith("sierpinski-triangle-")
    );

    if (!roseCurve || roseCurve.kind !== "polyline") {
      throw new Error("Expected a rose curve polyline");
    }

    expect(roseCurve.className).toContain("magic-rose-curve");
    expect(roseCurve.points).toHaveLength(385);
    expect(
      roseCurve.points.every(
        (point) =>
          haversineDistanceMeters(result.center, point) <=
          result.radiusMeanMeters * 0.45
      )
    ).toBe(true);

    expect(sierpinskiTriangles).toHaveLength(27);
    sierpinskiTriangles.forEach((stroke) => {
      if (stroke.kind !== "polyline") {
        throw new Error("Expected a Sierpinski triangle polyline");
      }

      expect(stroke.className).toContain("magic-sierpinski");
      expect(stroke.points).toHaveLength(4);
      expect(
        haversineDistanceMeters(stroke.points[0], stroke.points[3])
      ).toBeLessThan(0.001);
    });
  });

  it("can draw rose curve and Sierpinski variants separately", () => {
    const result = makeResult(5);
    const roseStrokes = makeMagicCircleStrokes(result, 14, "rose");
    const sierpinskiStrokes = makeMagicCircleStrokes(
      result,
      14,
      "sierpinski"
    );

    expect(roseStrokes.some((stroke) => stroke.id === "rose-curve")).toBe(true);
    expect(
      roseStrokes.some((stroke) =>
        stroke.id.startsWith("sierpinski-triangle-")
      )
    ).toBe(false);
    expect(
      sierpinskiStrokes.some((stroke) => stroke.id === "rose-curve")
    ).toBe(false);
    expect(
      sierpinskiStrokes.filter((stroke) =>
        stroke.id.startsWith("sierpinski-triangle-")
      )
    ).toHaveLength(27);

    for (const strokes of [roseStrokes, sierpinskiStrokes]) {
      expect(strokes.some((stroke) => stroke.id === "mode-frame-5")).toBe(
        false
      );
      expect(strokes.some((stroke) => stroke.id === "outer-polygon")).toBe(
        false
      );
      expect(
        strokes.some((stroke) => stroke.className.includes("star-line"))
      ).toBe(false);
      expect(
        strokes.some(
          (stroke) => stroke.kind === "symbol" && stroke.role === "endpoint"
        )
      ).toBe(true);
      expect(
        strokes.filter((stroke) => stroke.id.startsWith("spoke-"))
      ).toHaveLength(0);
      expect(
        strokes.filter((stroke) => stroke.id.startsWith("element-point-"))
      ).not.toHaveLength(0);
      expect(
        strokes.some((stroke) => stroke.id.includes("independent-axis"))
      ).toBe(false);
      expect(strokes.some((stroke) => stroke.id === "center-symbol")).toBe(
        true
      );
      expect(strokes.filter((stroke) => stroke.id.startsWith("rune-"))).toHaveLength(
        MAGIC_ANIMATION_COUNT
      );
    }
  });

  it("draws the twelve zodiac constellations as numeric variants", () => {
    const result = makeResult(5);

    expect(ZODIAC_CONSTELLATIONS).toHaveLength(12);

    ZODIAC_CONSTELLATIONS.forEach((constellation, index) => {
      const strokes = makeMagicCircleStrokes(result, 14, "zodiac", {
        zodiacIndex: index
      });

      expect(
        strokes.some(
          (stroke) => stroke.id === `zodiac-frame-${constellation.id}`
        )
      ).toBe(true);
      expect(
        strokes.filter((stroke) =>
          stroke.id.startsWith(`zodiac-line-${constellation.id}-`)
        )
      ).toHaveLength(constellation.lines.length);
      const zodiacStars = strokes.filter((stroke) =>
        stroke.id.startsWith(`zodiac-star-${constellation.id}-`)
      );
      expect(zodiacStars).toHaveLength(constellation.points.length);
      const zodiacOuterRadiusMeters = Math.max(
        ...zodiacStars.map((stroke) =>
          stroke.kind === "circle"
            ? haversineDistanceMeters(result.center, stroke.center)
            : 0
        )
      );
      expect(zodiacOuterRadiusMeters).toBeGreaterThan(
        result.radiusMeanMeters * 0.99
      );
      expect(zodiacOuterRadiusMeters).toBeLessThan(
        result.radiusMeanMeters * 1.01
      );
      const endpointSymbols = strokes.filter(
        (stroke) => stroke.kind === "symbol" && stroke.role === "endpoint"
      );
      expect(endpointSymbols).toHaveLength(constellation.points.length);
      expect(
        endpointSymbols.every(
          (stroke) =>
            stroke.kind === "symbol" &&
            stroke.symbol === MAGIC_ELEMENTS[14].endpointSymbol &&
            stroke.className.includes(
              `magic-element--${MAGIC_ELEMENTS[14].id}`
            )
        )
      ).toBe(true);
      expect(
        strokes.filter(
          (stroke) =>
            stroke.id.startsWith("zodiac-gate-") &&
            !stroke.id.startsWith("zodiac-gate-tick-")
        )
      ).toHaveLength(12);
      expect(strokes.some((stroke) => stroke.id === "center-symbol")).toBe(
        true
      );
      expect(
        strokes.some((stroke) => stroke.className.includes("star-line"))
      ).toBe(false);
      expect(
        strokes.filter((stroke) => stroke.id.startsWith("spoke-"))
      ).toHaveLength(0);
      expect(
        strokes.filter((stroke) => stroke.id.startsWith("element-point-"))
      ).toHaveLength(constellation.points.length);
      expect(
        strokes.some((stroke) => stroke.id.includes("independent-axis"))
      ).toBe(false);
    });
  });

  it("keeps element point and line effects on combined seals", () => {
    for (const mode of [5, 6] as const) {
      const result = makeResult(mode);
      const strokes = makeMagicCircleStrokes(result, 6, "combined");

      expect(
        strokes.some((stroke) => stroke.className.includes("star-line"))
      ).toBe(true);
      expect(
        strokes.filter((stroke) => stroke.id.startsWith("spoke-"))
      ).toHaveLength(mode);
      expect(
        strokes.filter((stroke) => stroke.id.startsWith("element-point-"))
      ).toHaveLength(mode);
      expect(
        strokes.filter(
          (stroke) => stroke.kind === "symbol" && stroke.role === "endpoint"
        )
      ).toHaveLength(mode);
    }
  });

  it("keeps standalone geometry variants focused on their own shapes", () => {
    const variants = [
      ["rose", {}],
      ["sierpinski", {}],
      ["zodiac", { zodiacIndex: 3 }]
    ] as const;

    for (const mode of [5, 6] as const) {
      const result = makeResult(mode);

      for (const [pattern, options] of variants) {
        const strokes = makeMagicCircleStrokes(result, 6, pattern, options);

        expect(
          strokes.some((stroke) => stroke.className.includes("star-line"))
        ).toBe(false);
        expect(
          strokes.filter((stroke) => stroke.id.startsWith("spoke-"))
        ).toHaveLength(0);
        expect(
          strokes.filter((stroke) => stroke.id.startsWith("element-point-"))
        ).not.toHaveLength(0);
        expect(
          strokes.filter(
            (stroke) => stroke.kind === "symbol" && stroke.role === "endpoint"
          )
        ).not.toHaveLength(0);
        expect(
          strokes.some((stroke) => stroke.id.includes("independent-axis"))
        ).toBe(false);
        expect(strokes.some((stroke) => stroke.id === "center-symbol")).toBe(
          true
        );
      }
    }
  });

  it("keeps zodiac star counts aligned with unique line vertices", () => {
    ZODIAC_CONSTELLATIONS.forEach((constellation) => {
      const linePointIndexes = constellation.lines.flat();
      const uniqueLinePointIndexes = new Set(linePointIndexes);

      expect(uniqueLinePointIndexes.size).toBe(constellation.points.length);
      linePointIndexes.forEach((pointIndex) => {
        expect(pointIndex).toBeGreaterThanOrEqual(0);
        expect(pointIndex).toBeLessThan(constellation.points.length);
      });
    });
  });

  it("applies numeric drawing variants to rose and Sierpinski geometry", () => {
    const result = makeResult(5);
    const roseStrokes = makeMagicCircleStrokes(result, 14, "rose", {
      rosePetalFactor: 3
    });
    const roseCurve = roseStrokes.find((stroke) => stroke.id === "rose-curve");
    if (!roseCurve || roseCurve.kind !== "polyline") {
      throw new Error("Expected a rose curve polyline");
    }
    expect(
      haversineDistanceMeters(result.center, roseCurve.points[32])
    ).toBeLessThan(0.001);

    const shallowTriangles = makeMagicCircleStrokes(
      result,
      14,
      "sierpinski",
      { sierpinskiDepth: 2 }
    ).filter((stroke) => stroke.id.startsWith("sierpinski-triangle-"));
    const deepTriangles = makeMagicCircleStrokes(result, 14, "sierpinski", {
      sierpinskiDepth: 4
    }).filter((stroke) => stroke.id.startsWith("sierpinski-triangle-"));

    expect(shallowTriangles).toHaveLength(9);
    expect(deepTriangles).toHaveLength(81);
  });

  it("applies the selected element class and palette to every variant", () => {
    for (const [index, element] of MAGIC_ELEMENTS.entries()) {
      const strokes = makeMagicCircleStrokes(makeResult(5), index);

      expect(
        strokes.some((stroke) =>
          stroke.className.includes(`magic-element--${element.id}`)
        )
      ).toBe(true);
      expect(strokes.some((stroke) => stroke.color === element.primary)).toBe(
        true
      );
      expect(strokes.some((stroke) => stroke.color === element.accent)).toBe(
        true
      );
    }
  });

  it("adds center, endpoint, and ambient symbols for every element", () => {
    for (const [index, element] of MAGIC_ELEMENTS.entries()) {
      const strokes = makeMagicCircleStrokes(makeResult(5), index);

      expect(
        strokes.some(
          (stroke) =>
            stroke.kind === "symbol" &&
            stroke.role === "center" &&
            stroke.symbol === element.centerSymbol
        )
      ).toBe(true);
      expect(
        strokes.filter(
          (stroke) =>
            stroke.kind === "symbol" &&
            stroke.role === "endpoint" &&
            stroke.symbol === element.endpointSymbol &&
            stroke.sizePx >= 40 &&
            stroke.opacity === 1
        )
      ).toHaveLength(5);
      expect(
        strokes.some(
          (stroke) => stroke.kind === "symbol" && stroke.role === "ambient"
        )
      ).toBe(true);
    }
  });

  it("anchors magic symbols to the center and actual star rays", () => {
    const result = makeResultWithBearings(5, [17, 91, 154, 223, 299]);
    const rayBearings = result.points.map((point) =>
      bearingDegrees(result.center, pointPosition(point))
    );
    const strokes = makeMagicCircleStrokes(result, 11);
    const centerSymbol = strokes.find((stroke) => stroke.id === "center-symbol");

    if (!centerSymbol || centerSymbol.kind !== "symbol") {
      throw new Error("Expected a center magic symbol");
    }

    expect(
      haversineDistanceMeters(centerSymbol.position, result.center)
    ).toBeLessThan(0.001);

    const endpointSymbols = strokes.filter(
      (stroke) => stroke.kind === "symbol" && stroke.role === "endpoint"
    );
    expect(endpointSymbols).toHaveLength(result.mode);
    endpointSymbols.forEach((stroke, index) => {
      if (stroke.kind !== "symbol") throw new Error("Expected endpoint symbol");
      expect(
        haversineDistanceMeters(stroke.position, pointPosition(result.points[index]))
      ).toBeLessThan(0.001);
      expect(
        angularDifferenceDegrees(stroke.bearingDeg, rayBearings[index])
      ).toBeLessThan(0.000001);
    });

    const ambientSymbols = strokes.filter(
      (stroke) => stroke.kind === "symbol" && stroke.role === "ambient"
    );
    expect(ambientSymbols.length).toBeGreaterThan(0);
    ambientSymbols.forEach((stroke) => {
      if (stroke.kind !== "symbol") throw new Error("Expected ambient symbol");
      const symbolBearing = bearingDegrees(result.center, stroke.position);
      expect(
        rayBearings.some(
          (rayBearing) =>
            angularDifferenceDegrees(symbolBearing, rayBearing) < 0.000001
        )
      ).toBe(true);
    });
  });

  it("draws spoke strokes on the actual center-to-point rays", () => {
    const result = makeResultWithBearings(6, [4, 63, 127, 181, 244, 309]);
    const strokes = makeMagicCircleStrokes(result, 7);

    result.points.forEach((point, index) => {
      const spoke = strokes.find((stroke) => stroke.id === `spoke-${index}`);
      const rayBearing = bearingDegrees(result.center, pointPosition(point));

      if (!spoke || spoke.kind !== "polyline") {
        throw new Error(`Expected spoke-${index}`);
      }

      spoke.points.forEach((position) => {
        expect(
          angularDifferenceDegrees(
            bearingDegrees(result.center, position),
            rayBearing
          )
        ).toBeLessThan(0.000001);
      });
    });
  });

  it("marks every generated layer with element material and geometry classes", () => {
    for (const [index, element] of MAGIC_ELEMENTS.entries()) {
      const strokes = makeMagicCircleStrokes(makeResult(6), index);

      expect(
        strokes.every((stroke) =>
          stroke.className.includes(`magic-material--${element.lineMaterial}`)
        )
      ).toBe(true);
      expect(
        strokes.every((stroke) =>
          stroke.className.includes(`magic-geometry--${element.baseGeometry}`)
        )
      ).toBe(true);
    }
  });

  it("uses mode-specific foundation frames for every pattern", () => {
    for (const [index, element] of MAGIC_ELEMENTS.entries()) {
      for (const mode of [4, 5, 6, 7, 8] as const) {
        const strokes = makeMagicCircleStrokes(makeResult(mode), index);

        expect(
          strokes.some(
            (stroke) =>
              stroke.id === `mode-frame-${mode}` &&
              stroke.className.includes(
                `magic-geometry--${element.baseGeometry}`
              )
          )
        ).toBe(true);
      }
    }
  });

  it("adds pattern-specific strokes for cross star and bagua drawings", () => {
    const crossStrokes = makeMagicCircleStrokes(makeResult(4), 0);
    const baguaStrokes = makeMagicCircleStrokes(makeResult(8), 0);
    const eightPointStarStrokes = makeMagicCircleStrokes(
      makeResult(8),
      0,
      "combined",
      { combinedShape: "star" }
    );

    expect(crossStrokes.some((stroke) => stroke.id === "cross-star-axis-0")).toBe(
      true
    );
    expect(baguaStrokes.some((stroke) => stroke.id === "bagua-taiji-ring")).toBe(
      true
    );
    expect(
      baguaStrokes.some((stroke) => stroke.id.startsWith("bagua-trigram-"))
    ).toBe(true);
    expect(
      eightPointStarStrokes.some((stroke) => stroke.id === "bagua-taiji-ring")
    ).toBe(false);
    expect(
      eightPointStarStrokes.some((stroke) =>
        stroke.id.startsWith("bagua-trigram-")
      )
    ).toBe(false);
  });
});
