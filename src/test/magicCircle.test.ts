import { describe, expect, it } from "vitest";
import {
  getMagicAnimationOptions,
  MAGIC_ELEMENTS,
  MAGIC_ANIMATION_COUNT,
  MAGIC_SPEED_OPTIONS,
  makeMagicCircleStrokes
} from "../lib/magicCircle";
import type { Poi, StarMode, StarResult } from "../types";

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
  center: { lat: 25, lng: 121 },
  points: Array.from({ length: mode }, (_, index) => makePoi(index, mode)),
  score: 0.1,
  rotationDeg: 12,
  radiusMeanMeters: 1600,
  radiusStdMeters: 20,
  angleErrorDeg: 1.5,
  createdAt: "2026-05-21T00:00:00.000Z"
});

describe("magic circle animations", () => {
  it("offers 16 element-named choices for five- and six-point stars", () => {
    expect(getMagicAnimationOptions(5)).toHaveLength(MAGIC_ANIMATION_COUNT);
    expect(getMagicAnimationOptions(6)).toHaveLength(MAGIC_ANIMATION_COUNT);
    expect(MAGIC_ANIMATION_COUNT).toBe(16);
    expect(getMagicAnimationOptions(5).map((option) => option.label)).toEqual(
      MAGIC_ELEMENTS.map((element) => `${element.name}魔法陣`)
    );
  });

  it("includes the requested 0.254x playback speed", () => {
    expect(MAGIC_SPEED_OPTIONS).toContain(0.254);
  });

  it("adds 16 sequential rune strokes around each magic circle", () => {
    for (const mode of [5, 6] as const) {
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

  it("uses mode-specific foundation frames for five- and six-point stars", () => {
    for (const [index, element] of MAGIC_ELEMENTS.entries()) {
      const fivePointStrokes = makeMagicCircleStrokes(makeResult(5), index);
      const sixPointStrokes = makeMagicCircleStrokes(makeResult(6), index);

      expect(
        fivePointStrokes.some(
          (stroke) =>
            stroke.id === "mode-frame-5" &&
            stroke.className.includes(`magic-geometry--${element.baseGeometry}`)
        )
      ).toBe(true);
      expect(
        sixPointStrokes.some(
          (stroke) =>
            stroke.id === "mode-frame-6" &&
            stroke.className.includes(`magic-geometry--${element.baseGeometry}`)
        )
      ).toBe(true);
    }
  });
});
