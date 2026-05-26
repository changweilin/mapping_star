import type { LatLng, StarMode, StarResult } from "../types";
import { bearingDegrees, destinationPoint, normalizeDegrees } from "./geo";
import { starLineSequences } from "./solver";

const FULL_CIRCLE_DEGREES = 360;
const MIN_MAGIC_RADIUS_METERS = 120;
const ROSE_CURVE_PETAL_FACTOR = 7;
const SIERPINSKI_TRIANGLE_DEPTH = 3;

type MagicLineStyle =
  | "sharp"
  | "branch"
  | "flow"
  | "jagged"
  | "square"
  | "crystal"
  | "mist"
  | "bolt"
  | "broken"
  | "viscous"
  | "toxic"
  | "bone"
  | "radiant"
  | "lunar"
  | "constellation"
  | "ether";

type MagicRuneShape =
  | "chevron"
  | "leaf"
  | "wave"
  | "flame"
  | "block"
  | "shard"
  | "arc"
  | "bolt"
  | "slash"
  | "drop"
  | "orb"
  | "cross"
  | "ray"
  | "crescent"
  | "star"
  | "wisp";

type MagicBaseGeometry =
  | "faceted"
  | "arboreal"
  | "tidal"
  | "ignition"
  | "monolith"
  | "hex-crystal"
  | "vortex"
  | "storm"
  | "eclipse"
  | "vein"
  | "venom"
  | "bone-seal"
  | "solar"
  | "lunar"
  | "astral"
  | "ether";

type MagicLineMaterial =
  | "metal-etch"
  | "vine-grow"
  | "water-wash"
  | "fuse-flame"
  | "stone-crack"
  | "frost-trace"
  | "mist-stream"
  | "lightning-snap"
  | "shadow-tear"
  | "blood-ink"
  | "acid-bubble"
  | "bone-dust"
  | "solar-flare"
  | "moonlight"
  | "starlace"
  | "spirit-wisp";

type MagicSymbolKind =
  | "prism"
  | "blade"
  | "tree-ring"
  | "leaf-bud"
  | "vortex"
  | "droplet"
  | "flame-core"
  | "ember"
  | "crystal-mountain"
  | "pillar"
  | "snowflake"
  | "ice-shard"
  | "cyclone"
  | "feather"
  | "thunder-rune"
  | "arc-node"
  | "void"
  | "shade"
  | "blood-drop"
  | "blood-bead"
  | "venom-orb"
  | "bubble"
  | "bone-mark"
  | "bone-chip"
  | "sun-disc"
  | "ray"
  | "moon-phase"
  | "crescent"
  | "compass-star"
  | "star-glyph"
  | "soul-flame"
  | "will-o-wisp";

type MagicAmbientEffect =
  | "sparks"
  | "pollen"
  | "ripples"
  | "embers"
  | "dust"
  | "frost"
  | "gust"
  | "static"
  | "smoke"
  | "drips"
  | "acid"
  | "spirits"
  | "flare"
  | "phases"
  | "twinkles"
  | "ghosts";

type MagicDrawProfile =
  | "snap"
  | "bloom"
  | "flow"
  | "flare"
  | "weight"
  | "crystallize"
  | "drift"
  | "strike"
  | "fade"
  | "bleed"
  | "seethe"
  | "haunt"
  | "burst"
  | "tide"
  | "spark"
  | "wander";

export type MagicSymbolRole = "center" | "endpoint" | "ambient";

export interface MagicElement {
  id: string;
  name: string;
  primary: string;
  accent: string;
  pale: string;
  lineStyle: MagicLineStyle;
  runeShape: MagicRuneShape;
  baseGeometry: MagicBaseGeometry;
  lineMaterial: MagicLineMaterial;
  centerSymbol: MagicSymbolKind;
  endpointSymbol: MagicSymbolKind;
  ambientEffect: MagicAmbientEffect;
  drawProfile: MagicDrawProfile;
  ringScale: number;
  pulse: number;
}

export const MAGIC_ELEMENTS = [
  {
    id: "metal",
    name: "金",
    primary: "#c99528",
    accent: "#ffe38a",
    pale: "#fff4c7",
    lineStyle: "sharp",
    runeShape: "chevron",
    baseGeometry: "faceted",
    lineMaterial: "metal-etch",
    centerSymbol: "prism",
    endpointSymbol: "blade",
    ambientEffect: "sparks",
    drawProfile: "snap",
    ringScale: 1.07,
    pulse: 0.92
  },
  {
    id: "wood",
    name: "木",
    primary: "#287d47",
    accent: "#8fd35f",
    pale: "#d8f2b8",
    lineStyle: "branch",
    runeShape: "leaf",
    baseGeometry: "arboreal",
    lineMaterial: "vine-grow",
    centerSymbol: "tree-ring",
    endpointSymbol: "leaf-bud",
    ambientEffect: "pollen",
    drawProfile: "bloom",
    ringScale: 1.04,
    pulse: 1.08
  },
  {
    id: "water",
    name: "水",
    primary: "#1976c9",
    accent: "#6fd4ff",
    pale: "#d8f6ff",
    lineStyle: "flow",
    runeShape: "wave",
    baseGeometry: "tidal",
    lineMaterial: "water-wash",
    centerSymbol: "vortex",
    endpointSymbol: "droplet",
    ambientEffect: "ripples",
    drawProfile: "flow",
    ringScale: 1.05,
    pulse: 1.16
  },
  {
    id: "fire",
    name: "火",
    primary: "#e03a1f",
    accent: "#ff9f2f",
    pale: "#ffe1a3",
    lineStyle: "jagged",
    runeShape: "flame",
    baseGeometry: "ignition",
    lineMaterial: "fuse-flame",
    centerSymbol: "flame-core",
    endpointSymbol: "ember",
    ambientEffect: "embers",
    drawProfile: "flare",
    ringScale: 1.08,
    pulse: 0.84
  },
  {
    id: "earth",
    name: "土",
    primary: "#80613a",
    accent: "#c89b5c",
    pale: "#e8c98d",
    lineStyle: "square",
    runeShape: "block",
    baseGeometry: "monolith",
    lineMaterial: "stone-crack",
    centerSymbol: "crystal-mountain",
    endpointSymbol: "pillar",
    ambientEffect: "dust",
    drawProfile: "weight",
    ringScale: 1.03,
    pulse: 1.22
  },
  {
    id: "ice",
    name: "冰",
    primary: "#4eb8e8",
    accent: "#c8f7ff",
    pale: "#ffffff",
    lineStyle: "crystal",
    runeShape: "shard",
    baseGeometry: "hex-crystal",
    lineMaterial: "frost-trace",
    centerSymbol: "snowflake",
    endpointSymbol: "ice-shard",
    ambientEffect: "frost",
    drawProfile: "crystallize",
    ringScale: 1.06,
    pulse: 1
  },
  {
    id: "wind",
    name: "風",
    primary: "#2aa9a0",
    accent: "#a8fff2",
    pale: "#ddfff8",
    lineStyle: "mist",
    runeShape: "arc",
    baseGeometry: "vortex",
    lineMaterial: "mist-stream",
    centerSymbol: "cyclone",
    endpointSymbol: "feather",
    ambientEffect: "gust",
    drawProfile: "drift",
    ringScale: 1.06,
    pulse: 1.12
  },
  {
    id: "thunder",
    name: "雷",
    primary: "#6c46e8",
    accent: "#ffe45f",
    pale: "#fff8b5",
    lineStyle: "bolt",
    runeShape: "bolt",
    baseGeometry: "storm",
    lineMaterial: "lightning-snap",
    centerSymbol: "thunder-rune",
    endpointSymbol: "arc-node",
    ambientEffect: "static",
    drawProfile: "strike",
    ringScale: 1.08,
    pulse: 0.78
  },
  {
    id: "shadow",
    name: "影",
    primary: "#2f2a44",
    accent: "#766aa8",
    pale: "#c6bee8",
    lineStyle: "broken",
    runeShape: "slash",
    baseGeometry: "eclipse",
    lineMaterial: "shadow-tear",
    centerSymbol: "void",
    endpointSymbol: "shade",
    ambientEffect: "smoke",
    drawProfile: "fade",
    ringScale: 1.04,
    pulse: 1.28
  },
  {
    id: "blood",
    name: "血",
    primary: "#a80f23",
    accent: "#ff4e5e",
    pale: "#ffd3d7",
    lineStyle: "viscous",
    runeShape: "drop",
    baseGeometry: "vein",
    lineMaterial: "blood-ink",
    centerSymbol: "blood-drop",
    endpointSymbol: "blood-bead",
    ambientEffect: "drips",
    drawProfile: "bleed",
    ringScale: 1.05,
    pulse: 0.95
  },
  {
    id: "poison",
    name: "毒",
    primary: "#4f9700",
    accent: "#b8ff36",
    pale: "#ecff9f",
    lineStyle: "toxic",
    runeShape: "orb",
    baseGeometry: "venom",
    lineMaterial: "acid-bubble",
    centerSymbol: "venom-orb",
    endpointSymbol: "bubble",
    ambientEffect: "acid",
    drawProfile: "seethe",
    ringScale: 1.05,
    pulse: 1.18
  },
  {
    id: "undead",
    name: "不死",
    primary: "#62705f",
    accent: "#b6d178",
    pale: "#efffd0",
    lineStyle: "bone",
    runeShape: "cross",
    baseGeometry: "bone-seal",
    lineMaterial: "bone-dust",
    centerSymbol: "bone-mark",
    endpointSymbol: "bone-chip",
    ambientEffect: "spirits",
    drawProfile: "haunt",
    ringScale: 1.03,
    pulse: 1.3
  },
  {
    id: "sun",
    name: "日",
    primary: "#f39a10",
    accent: "#fff05a",
    pale: "#fff8bb",
    lineStyle: "radiant",
    runeShape: "ray",
    baseGeometry: "solar",
    lineMaterial: "solar-flare",
    centerSymbol: "sun-disc",
    endpointSymbol: "ray",
    ambientEffect: "flare",
    drawProfile: "burst",
    ringScale: 1.1,
    pulse: 0.86
  },
  {
    id: "moon",
    name: "月",
    primary: "#7f94e8",
    accent: "#dbe4ff",
    pale: "#f8f5ff",
    lineStyle: "lunar",
    runeShape: "crescent",
    baseGeometry: "lunar",
    lineMaterial: "moonlight",
    centerSymbol: "moon-phase",
    endpointSymbol: "crescent",
    ambientEffect: "phases",
    drawProfile: "tide",
    ringScale: 1.05,
    pulse: 1.14
  },
  {
    id: "star",
    name: "星",
    primary: "#5364f2",
    accent: "#ffd96a",
    pale: "#ffffff",
    lineStyle: "constellation",
    runeShape: "star",
    baseGeometry: "astral",
    lineMaterial: "starlace",
    centerSymbol: "compass-star",
    endpointSymbol: "star-glyph",
    ambientEffect: "twinkles",
    drawProfile: "spark",
    ringScale: 1.07,
    pulse: 0.96
  },
  {
    id: "soul",
    name: "靈魂",
    primary: "#8b74ff",
    accent: "#73fff0",
    pale: "#eadfff",
    lineStyle: "ether",
    runeShape: "wisp",
    baseGeometry: "ether",
    lineMaterial: "spirit-wisp",
    centerSymbol: "soul-flame",
    endpointSymbol: "will-o-wisp",
    ambientEffect: "ghosts",
    drawProfile: "wander",
    ringScale: 1.06,
    pulse: 1.2
  }
] as const satisfies readonly MagicElement[];

export const MAGIC_ANIMATION_COUNT = MAGIC_ELEMENTS.length;
export const MAGIC_SPEED_OPTIONS = [0.25, 0.5, 1, 2, 4] as const;

export type MagicSpeed = (typeof MAGIC_SPEED_OPTIONS)[number];
export type MagicElementId = (typeof MAGIC_ELEMENTS)[number]["id"];
export type MagicGeometryPattern = "combined" | "rose" | "sierpinski";
export type MagicCombinedShape = "star" | "cross" | "bagua";

export type MagicCircleGeometryOptions = {
  combinedShape?: MagicCombinedShape;
  rosePetalFactor?: number;
  sierpinskiDepth?: number;
};

interface MagicStrokeBase {
  id: string;
  className: string;
  color: string;
  weight: number;
  opacity: number;
  delayMs: number;
  durationMs: number;
}

export type MagicCircleStroke =
  | (MagicStrokeBase & {
      kind: "circle";
      center: LatLng;
      radiusMeters: number;
    })
  | (MagicStrokeBase & {
      kind: "polyline";
      points: LatLng[];
    })
  | (MagicStrokeBase & {
      kind: "symbol";
      position: LatLng;
      role: MagicSymbolRole;
      symbol: MagicSymbolKind;
      sizePx: number;
      bearingDeg: number;
      accent: string;
      pale: string;
      phase: number;
    });

export const normalizeMagicAnimationIndex = (index: number) => {
  const rounded = Math.trunc(Number.isFinite(index) ? index : 0);
  return (
    ((rounded % MAGIC_ANIMATION_COUNT) + MAGIC_ANIMATION_COUNT) %
    MAGIC_ANIMATION_COUNT
  );
};

export const getMagicElement = (index: number) =>
  MAGIC_ELEMENTS[normalizeMagicAnimationIndex(index)];

export const getMagicAnimationOptions = (_mode: StarMode) =>
  MAGIC_ELEMENTS.map((element, index) => ({
    index,
    label: `${element.name}魔法陣`
  }));

const makeElementClass = (element: MagicElement, className: string) =>
  `${className} magic-element--${element.id} magic-style--${element.lineStyle} magic-material--${element.lineMaterial} magic-geometry--${element.baseGeometry} magic-profile--${element.drawProfile}`;

const makeCirclePoints = (
  center: LatLng,
  radiusMeters: number,
  startDeg = 0,
  spanDeg = FULL_CIRCLE_DEGREES,
  steps = 96
) =>
  Array.from({ length: steps + 1 }, (_, index) => {
    const bearing = startDeg + (spanDeg * index) / steps;
    return destinationPoint(center, radiusMeters, bearing);
  });

const makePolygonPoints = (
  center: LatLng,
  radiusMeters: number,
  sides: number,
  rotationDeg: number
) =>
  Array.from({ length: sides + 1 }, (_, index) =>
    destinationPoint(
      center,
      radiusMeters,
      rotationDeg + (FULL_CIRCLE_DEGREES * index) / sides
    )
  );

const makeRadialLine = (
  center: LatLng,
  innerRadiusMeters: number,
  outerRadiusMeters: number,
  bearingDeg: number
) => [
  destinationPoint(center, innerRadiusMeters, bearingDeg),
  destinationPoint(center, outerRadiusMeters, bearingDeg)
];

const makeTangentialSegment = (
  center: LatLng,
  radiusMeters: number,
  bearingDeg: number,
  startOffsetMeters: number,
  endOffsetMeters: number
) => {
  const base = destinationPoint(center, radiusMeters, bearingDeg);
  const pointAtOffset = (offsetMeters: number) =>
    destinationPoint(
      base,
      Math.abs(offsetMeters),
      bearingDeg + (offsetMeters < 0 ? -90 : 90)
    );

  return [pointAtOffset(startOffsetMeters), pointAtOffset(endOffsetMeters)];
};

const makeZigZagLine = (
  center: LatLng,
  innerRadiusMeters: number,
  outerRadiusMeters: number,
  bearingDeg: number,
  amplitudeMeters: number,
  segments: number
) =>
  Array.from({ length: segments + 1 }, (_, index) => {
    const ratio = index / segments;
    const radius =
      innerRadiusMeters + (outerRadiusMeters - innerRadiusMeters) * ratio;
    const point = destinationPoint(center, radius, bearingDeg);
    if (index === 0 || index === segments) return point;
    const sideBearing = bearingDeg + (index % 2 === 0 ? 90 : -90);
    return destinationPoint(point, amplitudeMeters, sideBearing);
  });

const makeSpikedRingPoints = (
  center: LatLng,
  innerRadiusMeters: number,
  outerRadiusMeters: number,
  points: number,
  rotationDeg: number
) =>
  Array.from({ length: points * 2 + 1 }, (_, index) => {
    const radius = index % 2 === 0 ? outerRadiusMeters : innerRadiusMeters;
    return destinationPoint(
      center,
      radius,
      rotationDeg + (FULL_CIRCLE_DEGREES * index) / (points * 2)
    );
  });

const makeSpiralPoints = (
  center: LatLng,
  innerRadiusMeters: number,
  outerRadiusMeters: number,
  startDeg: number,
  spanDeg: number,
  steps: number
) =>
  Array.from({ length: steps + 1 }, (_, index) => {
    const ratio = index / steps;
    return destinationPoint(
      center,
      innerRadiusMeters + (outerRadiusMeters - innerRadiusMeters) * ratio,
      startDeg + spanDeg * ratio
    );
  });

const makeRoseCurvePoints = (
  center: LatLng,
  radiusMeters: number,
  petalFactor: number,
  rotationDeg: number,
  steps = 192
) =>
  Array.from({ length: steps + 1 }, (_, index) => {
    const thetaDeg = (FULL_CIRCLE_DEGREES * index) / steps;
    const thetaRad = (thetaDeg * Math.PI) / 180;
    const roseScale = Math.cos(petalFactor * thetaRad);
    const bearing =
      rotationDeg + thetaDeg + (roseScale < 0 ? 180 : 0);

    return destinationPoint(center, radiusMeters * Math.abs(roseScale), bearing);
  });

const makeLatLngMidpoint = (first: LatLng, second: LatLng): LatLng => ({
  lat: (first.lat + second.lat) / 2,
  lng: (first.lng + second.lng) / 2
});

const makeSierpinskiTriangleSegments = (
  center: LatLng,
  radiusMeters: number,
  rotationDeg: number,
  depth: number
): LatLng[][] => {
  const [top, right, left] = [0, 1, 2].map((index) =>
    destinationPoint(
      center,
      radiusMeters,
      rotationDeg + (FULL_CIRCLE_DEGREES * index) / 3
    )
  );

  const buildSegments = (
    a: LatLng,
    b: LatLng,
    c: LatLng,
    remainingDepth: number
  ): LatLng[][] => {
    if (remainingDepth <= 0) return [[a, b, c, a]];

    const ab = makeLatLngMidpoint(a, b);
    const bc = makeLatLngMidpoint(b, c);
    const ca = makeLatLngMidpoint(c, a);

    return [
      ...buildSegments(a, ab, ca, remainingDepth - 1),
      ...buildSegments(ab, b, bc, remainingDepth - 1),
      ...buildSegments(ca, bc, c, remainingDepth - 1)
    ];
  };

  return buildSegments(top, right, left, depth);
};

const clampInteger = (
  value: number | undefined,
  fallback: number,
  min: number,
  max: number
) => {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, Math.round(value)));
};

const getDefaultCombinedShape = (mode: StarMode): MagicCombinedShape =>
  mode === 4 ? "cross" : mode === 8 ? "bagua" : "star";

const getMagicStarLineSequences = (
  mode: StarMode,
  combinedShape: MagicCombinedShape
) => {
  if (combinedShape !== "star") return starLineSequences(mode);

  switch (mode) {
    case 7:
      return [[0, 2, 4, 6, 1, 3, 5, 0]];
    case 8:
      return [[0, 3, 6, 1, 4, 7, 2, 5, 0]];
    default:
      return starLineSequences(mode);
  }
};

const pointFromPoi = (point: StarResult["points"][number]): LatLng => ({
  lat: point.lat,
  lng: point.lng
});

const pointBearingFromCenter = (
  center: LatLng,
  point: StarResult["points"][number]
) => bearingDegrees(center, pointFromPoi(point));

const makeRuneStroke = ({
  center,
  radiusMeters,
  bearing,
  shape
}: {
  center: LatLng;
  radiusMeters: number;
  bearing: number;
  shape: MagicRuneShape;
}) => {
  const length = radiusMeters * 0.048;
  const width = radiusMeters * 0.026;
  const baseRadius = radiusMeters * 1.11;
  const tipRadius = baseRadius + length;
  const rootRadius = baseRadius - length * 0.5;
  const centerPoint = destinationPoint(center, baseRadius, bearing);

  switch (shape) {
    case "leaf":
      return [
        destinationPoint(centerPoint, width, bearing - 115),
        destinationPoint(center, tipRadius, bearing),
        destinationPoint(centerPoint, width, bearing + 115),
        destinationPoint(center, rootRadius, bearing)
      ];
    case "wave":
      return Array.from({ length: 5 }, (_, index) => {
        const local = destinationPoint(
          center,
          rootRadius + (length * index) / 2,
          bearing
        );
        return destinationPoint(
          local,
          index % 2 === 0 ? width : width * 0.2,
          bearing + 90
        );
      });
    case "flame":
      return [
        destinationPoint(center, rootRadius, bearing - 1.4),
        destinationPoint(centerPoint, width * 1.2, bearing - 90),
        destinationPoint(center, tipRadius, bearing),
        destinationPoint(centerPoint, width, bearing + 90),
        destinationPoint(center, rootRadius, bearing + 1.4)
      ];
    case "block":
      return makePolygonPoints(centerPoint, length * 0.62, 4, bearing + 45);
    case "shard":
      return [
        destinationPoint(center, rootRadius, bearing),
        destinationPoint(centerPoint, width, bearing - 76),
        destinationPoint(center, tipRadius, bearing),
        destinationPoint(centerPoint, width, bearing + 76),
        destinationPoint(center, rootRadius, bearing)
      ];
    case "arc":
      return makeCirclePoints(center, baseRadius, bearing - 9, 18, 8);
    case "bolt":
      return makeZigZagLine(center, rootRadius, tipRadius, bearing, width, 3);
    case "slash":
      return [
        destinationPoint(centerPoint, length * 0.72, bearing - 128),
        destinationPoint(centerPoint, length * 0.72, bearing + 52)
      ];
    case "drop":
      return [
        destinationPoint(center, tipRadius, bearing),
        destinationPoint(centerPoint, width * 0.9, bearing - 120),
        destinationPoint(center, rootRadius, bearing),
        destinationPoint(centerPoint, width * 0.9, bearing + 120),
        destinationPoint(center, tipRadius, bearing)
      ];
    case "orb":
      return makeCirclePoints(centerPoint, length * 0.48, bearing, 360, 18);
    case "cross":
      return [
        destinationPoint(center, rootRadius, bearing),
        destinationPoint(center, tipRadius, bearing),
        destinationPoint(centerPoint, length * 0.55, bearing - 90),
        destinationPoint(centerPoint, length * 0.55, bearing + 90)
      ];
    case "ray":
      return makeRadialLine(center, rootRadius - length * 0.35, tipRadius, bearing);
    case "crescent":
      return makeCirclePoints(centerPoint, length * 0.72, bearing + 60, 210, 14);
    case "star":
      return makePolygonPoints(centerPoint, length * 0.74, 5, bearing - 90);
    case "wisp":
      return [
        destinationPoint(center, rootRadius, bearing),
        destinationPoint(centerPoint, width, bearing + 76),
        destinationPoint(center, tipRadius - length * 0.28, bearing + 3),
        destinationPoint(centerPoint, width * 0.6, bearing - 82)
      ];
    case "chevron":
    default:
      return [
        destinationPoint(centerPoint, width, bearing - 115),
        destinationPoint(center, tipRadius, bearing),
        destinationPoint(centerPoint, width, bearing + 115)
      ];
  }
};

export const makeMagicCircleStrokes = (
  result: StarResult,
  animationIndex: number,
  geometryPattern: MagicGeometryPattern = "combined",
  geometryOptions: MagicCircleGeometryOptions = {}
): MagicCircleStroke[] => {
  const normalizedIndex = normalizeMagicAnimationIndex(animationIndex);
  const element = getMagicElement(normalizedIndex);
  const mode = result.mode;
  const combinedShape =
    geometryOptions.combinedShape ?? getDefaultCombinedShape(mode);
  const rosePetalFactor = clampInteger(
    geometryOptions.rosePetalFactor,
    ROSE_CURVE_PETAL_FACTOR,
    1,
    12
  );
  const sierpinskiDepth = clampInteger(
    geometryOptions.sierpinskiDepth,
    SIERPINSKI_TRIANGLE_DEPTH,
    0,
    5
  );
  const modeSlotDeg = FULL_CIRCLE_DEGREES / mode;
  const phaseDeg = normalizeDegrees(result.rotationDeg);
  const visualPhaseDeg =
    (FULL_CIRCLE_DEGREES * normalizedIndex) / MAGIC_ANIMATION_COUNT;
  const starRayBearings = result.points.map((point, index) => {
    const bearing = pointBearingFromCenter(result.center, point);
    return Number.isFinite(bearing)
      ? bearing
      : normalizeDegrees(phaseDeg + index * modeSlotDeg);
  });
  const radiusMeters = Math.max(
    result.radiusMeanMeters,
    MIN_MAGIC_RADIUS_METERS
  );
  const strokes: MagicCircleStroke[] = [];
  let sequence = 0;

  const schedule = (durationMs: number, advance = 1) => {
    const delayMs = Math.round(sequence * 132 * element.pulse);
    sequence += advance;
    return {
      delayMs,
      durationMs: Math.round(durationMs * element.pulse)
    };
  };

  const pushCircleAt = (
    id: string,
    center: LatLng,
    radiusMetersValue: number,
    color: string,
    weight: number,
    opacity: number,
    durationMs: number,
    className = "magic-circle magic-circle--draw",
    advance = 1
  ) => {
    strokes.push({
      kind: "circle",
      id,
      center,
      radiusMeters: radiusMetersValue,
      className: makeElementClass(element, className),
      color,
      weight,
      opacity,
      ...schedule(durationMs, advance)
    });
  };

  const pushCircle = (
    id: string,
    radiusScale: number,
    color: string,
    weight: number,
    opacity: number,
    durationMs: number,
    className?: string,
    advance?: number
  ) => {
    pushCircleAt(
      id,
      result.center,
      radiusMeters * radiusScale,
      color,
      weight,
      opacity,
      durationMs,
      className,
      advance
    );
  };

  const pushPolyline = (
    id: string,
    points: LatLng[],
    className: string,
    color: string,
    weight: number,
    opacity: number,
    durationMs: number,
    advance = 1
  ) => {
    strokes.push({
      kind: "polyline",
      id,
      points,
      className: makeElementClass(element, className),
      color,
      weight,
      opacity,
      ...schedule(durationMs, advance)
    });
  };

  const pushSymbol = (
    id: string,
    position: LatLng,
    role: MagicSymbolRole,
    symbol: MagicSymbolKind,
    sizePx: number,
    color: string,
    opacity: number,
    durationMs: number,
    bearingDeg = 0,
    advance = 0.4
  ) => {
    strokes.push({
      kind: "symbol",
      id,
      position,
      role,
      symbol,
      sizePx,
      bearingDeg,
      phase: normalizeDegrees(visualPhaseDeg + bearingDeg),
      className: makeElementClass(
        element,
        `magic-symbol magic-symbol--${role} magic-symbol--${symbol} magic-ambient--${element.ambientEffect} magic-symbol--appear`
      ),
      color,
      accent: element.accent,
      pale: element.pale,
      weight: 0,
      opacity,
      ...schedule(durationMs, advance)
    });
  };

  const addRadialTicks = (
    idPrefix: string,
    count: number,
    innerScale: number,
    outerScale: number,
    color: string,
    weight: number,
    opacity: number,
    offsetDeg = 0
  ) => {
    for (let index = 0; index < count; index += 1) {
      const bearing =
        phaseDeg + offsetDeg + (FULL_CIRCLE_DEGREES * index) / count;
      pushPolyline(
        `${idPrefix}-${index}`,
        makeRadialLine(
          result.center,
          radiusMeters * innerScale,
          radiusMeters * outerScale,
          bearing
        ),
        "magic-stroke magic-element-mark magic-stroke--draw",
        color,
        weight,
        opacity,
        420,
        0.38
      );
    }
  };

  const addBaseGeometry = () => {
    const foundationClass = `magic-stroke magic-foundation magic-foundation--${element.baseGeometry} magic-stroke--draw`;

    pushPolyline(
      `mode-frame-${mode}`,
      makePolygonPoints(result.center, radiusMeters * 0.86, mode, phaseDeg),
      foundationClass,
      element.accent,
      1.25,
      0.55,
      760,
      0.72
    );

    switch (element.baseGeometry) {
      case "faceted":
        pushPolyline(
          "base-faceted-crown",
          makePolygonPoints(result.center, radiusMeters * 1.14, 10, phaseDeg + 18),
          foundationClass,
          element.pale,
          1.05,
          0.52,
          700,
          0.48
        );
        addRadialTicks("base-metal-score", mode * 2, 0.58, 1.1, element.accent, 0.9, 0.52, 9);
        break;
      case "arboreal":
        pushCircle("base-tree-ring-a", 0.33, element.pale, 0.9, 0.42, 520, "magic-circle magic-foundation magic-circle--draw", 0.32);
        pushCircle("base-tree-ring-b", 0.57, element.accent, 0.95, 0.38, 560, "magic-circle magic-foundation magic-circle--draw", 0.34);
        for (let index = 0; index < mode; index += 1) {
          const bearing = starRayBearings[index] ?? phaseDeg + index * modeSlotDeg;
          pushPolyline(
            `base-root-curve-${index}`,
            [
              destinationPoint(result.center, radiusMeters * 0.2, bearing - 8),
              destinationPoint(result.center, radiusMeters * 0.48, bearing + 13),
              destinationPoint(result.center, radiusMeters * 0.84, bearing - 5)
            ],
            foundationClass,
            element.primary,
            1.05,
            0.45,
            640,
            0.34
          );
        }
        break;
      case "tidal":
        for (let index = 0; index < 5; index += 1) {
          pushPolyline(
            `base-tide-arc-${index}`,
            makeCirclePoints(
              result.center,
              radiusMeters * (0.36 + index * 0.14),
              phaseDeg + index * 24,
              176,
              38
            ),
            foundationClass,
            index % 2 === 0 ? element.accent : element.pale,
            1.05,
            0.46,
            620,
            0.36
          );
        }
        break;
      case "ignition":
        pushPolyline(
          "base-ignition-star",
          makeSpikedRingPoints(result.center, radiusMeters * 0.72, radiusMeters * 1.08, mode * 2, phaseDeg),
          foundationClass,
          element.accent,
          1.3,
          0.6,
          780,
          0.54
        );
        addRadialTicks("base-spark-fuse", mode * 2, 0.68, 1.16, element.pale, 1.05, 0.55, 4);
        break;
      case "monolith":
        pushPolyline(
          "base-stone-square",
          makePolygonPoints(result.center, radiusMeters * 0.93, 4, phaseDeg + 45),
          foundationClass,
          element.accent,
          1.35,
          0.58,
          780,
          0.5
        );
        pushPolyline(
          "base-stone-diamond",
          makePolygonPoints(result.center, radiusMeters * 0.62, 4, phaseDeg),
          foundationClass,
          element.pale,
          1.05,
          0.44,
          640,
          0.4
        );
        break;
      case "hex-crystal":
        pushPolyline(
          "base-crystal-hex",
          makePolygonPoints(result.center, radiusMeters * 1.02, 6, phaseDeg + 30),
          foundationClass,
          element.pale,
          1.2,
          0.66,
          760,
          0.5
        );
        addRadialTicks("base-crystal-arm", 12, 0.28, 1.06, element.accent, 0.95, 0.56, 0);
        break;
      case "vortex":
        for (let index = 0; index < 4; index += 1) {
          pushPolyline(
            `base-vortex-stream-${index}`,
            makeSpiralPoints(
              result.center,
              radiusMeters * 0.18,
              radiusMeters * 0.98,
              phaseDeg + index * 90,
              250,
              34
            ),
            foundationClass,
            index % 2 === 0 ? element.accent : element.pale,
            1.05,
            0.46,
            700,
            0.42
          );
        }
        break;
      case "storm":
        pushPolyline(
          "base-storm-cage",
          makeSpikedRingPoints(result.center, radiusMeters * 0.68, radiusMeters * 1.06, mode * 2, phaseDeg + 7),
          foundationClass,
          element.accent,
          1.25,
          0.62,
          620,
          0.48
        );
        for (let index = 0; index < mode; index += 1) {
          const bearing = phaseDeg + index * modeSlotDeg + modeSlotDeg / 2;
          pushPolyline(
            `base-storm-fork-${index}`,
            makeZigZagLine(result.center, radiusMeters * 0.38, radiusMeters * 0.92, bearing, radiusMeters * 0.034, 4),
            foundationClass,
            element.pale,
            1.1,
            0.54,
            480,
            0.3
          );
        }
        break;
      case "eclipse":
        for (let index = 0; index < 6; index += 1) {
          pushPolyline(
            `base-eclipse-fragment-${index}`,
            makeCirclePoints(
              result.center,
              radiusMeters * (0.5 + index * 0.08),
              phaseDeg + index * 61,
              46,
              12
            ),
            foundationClass,
            index % 2 === 0 ? element.primary : element.accent,
            1.1,
            0.46,
            520,
            0.28
          );
        }
        break;
      case "vein":
        addRadialTicks("base-vein-spoke", mode * 2, 0.24, 0.95, element.primary, 1.1, 0.54, 5);
        for (let index = 0; index < mode; index += 1) {
          const bearing = starRayBearings[index] ?? phaseDeg + index * modeSlotDeg;
          pushPolyline(
            `base-vein-branch-${index}`,
            [
              destinationPoint(result.center, radiusMeters * 0.2, bearing),
              destinationPoint(result.center, radiusMeters * 0.42, bearing + 12),
              destinationPoint(result.center, radiusMeters * 0.7, bearing - 9),
              destinationPoint(result.center, radiusMeters * 0.98, bearing + 4)
            ],
            foundationClass,
            element.accent,
            1.25,
            0.5,
            620,
            0.36
          );
        }
        break;
      case "venom":
        pushPolyline(
          "base-venom-orbit",
          makeSpikedRingPoints(result.center, radiusMeters * 0.74, radiusMeters * 0.92, 16, phaseDeg),
          foundationClass,
          element.accent,
          1,
          0.48,
          680,
          0.42
        );
        for (let index = 0; index < 8; index += 1) {
          const bubbleCenter = destinationPoint(result.center, radiusMeters * (0.35 + (index % 4) * 0.14), phaseDeg + index * 45);
          pushCircleAt(
            `base-venom-bubble-${index}`,
            bubbleCenter,
            radiusMeters * (0.018 + (index % 3) * 0.006),
            index % 2 === 0 ? element.accent : element.pale,
            0.8,
            0.52,
            420,
            "magic-circle magic-foundation magic-circle--draw",
            0.18
          );
        }
        break;
      case "bone-seal":
        pushPolyline(
          "base-bone-octagon",
          makePolygonPoints(result.center, radiusMeters * 0.96, 8, phaseDeg + 22.5),
          foundationClass,
          element.pale,
          1.05,
          0.5,
          700,
          0.46
        );
        addRadialTicks("base-bone-sigil", 8, 0.18, 0.86, element.accent, 1.05, 0.5, 22.5);
        break;
      case "solar":
        pushPolyline(
          "base-solar-corona",
          makeSpikedRingPoints(result.center, radiusMeters * 0.88, radiusMeters * 1.2, 24, phaseDeg),
          foundationClass,
          element.accent,
          1.1,
          0.68,
          760,
          0.5
        );
        addRadialTicks("base-solar-ray", 24, 0.44, 1.17, element.pale, 0.9, 0.5, 0);
        break;
      case "lunar":
        pushCircleAt(
          "base-lunar-offset",
          destinationPoint(result.center, radiusMeters * 0.08, phaseDeg + 120),
          radiusMeters * 0.46,
          element.pale,
          1,
          0.38,
          620,
          "magic-circle magic-foundation magic-circle--draw",
          0.34
        );
        for (let index = 0; index < 4; index += 1) {
          pushPolyline(
            `base-lunar-tide-${index}`,
            makeCirclePoints(result.center, radiusMeters * (0.42 + index * 0.16), phaseDeg + 150 + index * 12, 86, 22),
            foundationClass,
            index % 2 === 0 ? element.accent : element.pale,
            0.95,
            0.44,
            560,
            0.3
          );
        }
        break;
      case "astral":
        pushPolyline(
          "base-astral-compass",
          makeSpikedRingPoints(result.center, radiusMeters * 0.62, radiusMeters * 1.04, 16, phaseDeg),
          foundationClass,
          element.accent,
          1.05,
          0.58,
          760,
          0.44
        );
        for (let index = 0; index < 5; index += 1) {
          pushPolyline(
            `base-astral-link-${index}`,
            [
              destinationPoint(result.center, radiusMeters * (0.34 + index * 0.08), phaseDeg + index * 71),
              destinationPoint(result.center, radiusMeters * (0.68 + (index % 2) * 0.16), phaseDeg + index * 71 + 43)
            ],
            foundationClass,
            element.pale,
            0.95,
            0.48,
            420,
            0.26
          );
        }
        break;
      case "ether":
        for (let index = 0; index < 5; index += 1) {
          pushPolyline(
            `base-ether-ribbon-${index}`,
            [
              destinationPoint(result.center, radiusMeters * 0.18, phaseDeg + index * 72),
              destinationPoint(result.center, radiusMeters * 0.42, phaseDeg + index * 72 + 26),
              destinationPoint(result.center, radiusMeters * 0.72, phaseDeg + index * 72 - 16),
              destinationPoint(result.center, radiusMeters * 1.02, phaseDeg + index * 72 + 12)
            ],
            foundationClass,
            index % 2 === 0 ? element.accent : element.pale,
            1,
            0.48,
            680,
            0.34
          );
        }
        break;
      default:
        break;
    }
  };

  if (geometryPattern === "combined") {
    addBaseGeometry();
  }

  pushCircle("outer-ring", element.ringScale, element.primary, 1.8, 0.72, 930);
  pushCircle("middle-ring", 0.77, element.accent, 1.2, 0.48, 760);
  pushCircle("inner-ring", 0.48, element.pale, 1.1, 0.5, 660);

  if (geometryPattern === "combined" || geometryPattern === "rose") {
    pushPolyline(
      "rose-curve",
      makeRoseCurvePoints(
        result.center,
        radiusMeters * (geometryPattern === "rose" ? 0.56 : 0.44),
        geometryPattern === "rose" ? rosePetalFactor : mode,
        phaseDeg
      ),
      "magic-stroke magic-rose-curve magic-stroke--draw",
      element.pale,
      geometryPattern === "rose" ? 1.55 : 1.15,
      geometryPattern === "rose" ? 0.78 : 0.64,
      1120,
      0.72
    );
  }

  if (geometryPattern === "combined" || geometryPattern === "sierpinski") {
    makeSierpinskiTriangleSegments(
      result.center,
      radiusMeters * 0.82,
      phaseDeg,
      sierpinskiDepth
    ).forEach((points, index) => {
      pushPolyline(
        `sierpinski-triangle-${index}`,
        points,
        "magic-stroke magic-sierpinski magic-stroke--draw",
        index % 3 === 0 ? element.accent : element.primary,
        geometryPattern === "sierpinski" ? 1.08 : 0.82,
        geometryPattern === "sierpinski" ? 0.66 : 0.46,
        520,
        0.08
      );
    });
  }

  if (geometryPattern !== "combined") {
    addRadialTicks(
      `${geometryPattern}-independent-axis`,
      geometryPattern === "rose" ? rosePetalFactor * 2 : 12,
      0.18,
      1.02,
      element.accent,
      0.95,
      0.48,
      geometryPattern === "rose" ? 0 : 30
    );

    for (let index = 0; index < MAGIC_ANIMATION_COUNT; index += 1) {
      const bearing =
        phaseDeg + (FULL_CIRCLE_DEGREES * index) / MAGIC_ANIMATION_COUNT;
      pushPolyline(
        `rune-${index}`,
        makeRuneStroke({
          center: result.center,
          radiusMeters,
          bearing,
          shape: element.runeShape
        }),
        "magic-stroke magic-rune magic-stroke--draw",
        index % 3 === 0 ? element.pale : element.accent,
        element.runeShape === "orb" ? 1 : 1.25,
        0.74,
        430,
        0.34
      );
    }

    pushCircle("core-ring", 0.16, element.accent, 1.2, 0.64, 560);
    pushPolyline(
      "core-axis",
      [
        destinationPoint(result.center, radiusMeters * 0.24, phaseDeg + 90),
        destinationPoint(result.center, radiusMeters * 0.24, phaseDeg + 270)
      ],
      "magic-stroke magic-stroke--draw",
      element.primary,
      1.15,
      0.58,
      480
    );

    pushSymbol(
      "center-symbol",
      result.center,
      "center",
      element.centerSymbol,
      46,
      element.primary,
      1,
      640,
      phaseDeg,
      0.52
    );

    const ambientCount = element.ambientEffect === "ghosts" ? 9 : 8;
    for (let index = 0; index < ambientCount; index += 1) {
      const bearing =
        phaseDeg + (FULL_CIRCLE_DEGREES * index) / ambientCount;
      const radiusScale = 0.28 + (index % 4) * 0.16;
      pushSymbol(
        `ambient-symbol-${index}`,
        destinationPoint(result.center, radiusMeters * radiusScale, bearing),
        "ambient",
        index % 2 === 0 ? element.endpointSymbol : element.centerSymbol,
        19 + (index % 3) * 2,
        index % 2 === 0 ? element.accent : element.pale,
        0.82,
        560,
        bearing,
        0.16
      );
    }

    return strokes;
  }

  getMagicStarLineSequences(mode, combinedShape).forEach(
    (sequencePoints, index) => {
      pushPolyline(
        `star-line-${index}`,
        sequencePoints.map((pointIndex) =>
          pointFromPoi(result.points[pointIndex])
        ),
        "star-line star-line--draw",
        element.primary,
        element.lineStyle === "radiant" ? 3.35 : 3,
        0.92,
        980,
        1.25
      );
    }
  );

  pushPolyline(
    "outer-polygon",
    makePolygonPoints(result.center, radiusMeters * 0.94, mode, phaseDeg),
    "magic-stroke magic-stroke--draw",
    element.accent,
    1.35,
    0.6,
    840
  );

  pushPolyline(
    "inner-polygon",
    makePolygonPoints(
      result.center,
      radiusMeters * 0.58,
      mode,
      phaseDeg + modeSlotDeg / 2
    ),
    "magic-stroke magic-stroke--draw",
    element.pale,
    1.05,
    0.5,
    760
  );

  if (combinedShape === "cross" && mode === 4) {
    addRadialTicks("cross-star-axis", 4, 0.18, 1.08, element.accent, 1.35, 0.66, 0);
    for (let index = 0; index < 4; index += 1) {
      const bearing = phaseDeg + index * modeSlotDeg + modeSlotDeg / 2;
      pushPolyline(
        `cross-star-flare-${index}`,
        makeTangentialSegment(
          result.center,
          radiusMeters * 0.82,
          bearing,
          -radiusMeters * 0.075,
          radiusMeters * 0.075
        ),
        "magic-stroke magic-pattern-mark magic-stroke--draw",
        index % 2 === 0 ? element.pale : element.primary,
        1.1,
        0.58,
        460,
        0.28
      );
    }
  }

  if (combinedShape === "bagua" && mode === 8) {
    pushCircle("bagua-taiji-ring", 0.24, element.pale, 1.15, 0.58, 520);
    pushPolyline(
      "bagua-taiji-curve",
      makeCirclePoints(
        destinationPoint(result.center, radiusMeters * 0.06, phaseDeg + 90),
        radiusMeters * 0.12,
        phaseDeg + 90,
        180,
        28
      ),
      "magic-stroke magic-pattern-mark magic-stroke--draw",
      element.primary,
      1.15,
      0.6,
      520,
      0.34
    );
    pushCircleAt(
      "bagua-taiji-dot-a",
      destinationPoint(result.center, radiusMeters * 0.08, phaseDeg),
      radiusMeters * 0.026,
      element.accent,
      0.9,
      0.62,
      360,
      "magic-circle magic-pattern-mark magic-circle--draw",
      0.18
    );
    pushCircleAt(
      "bagua-taiji-dot-b",
      destinationPoint(result.center, radiusMeters * 0.08, phaseDeg + 180),
      radiusMeters * 0.026,
      element.pale,
      0.9,
      0.62,
      360,
      "magic-circle magic-pattern-mark magic-circle--draw",
      0.18
    );

    for (let trigramIndex = 0; trigramIndex < 8; trigramIndex += 1) {
      const bearing = phaseDeg + trigramIndex * modeSlotDeg;
      for (let row = 0; row < 3; row += 1) {
        const trigramRadius = radiusMeters * (1.06 - row * 0.045);
        const halfLength = radiusMeters * 0.055;
        const gap = radiusMeters * 0.017;
        const isBroken = ((trigramIndex >> row) & 1) === 1;
        const idPrefix = `bagua-trigram-${trigramIndex}-${row}`;

        if (isBroken) {
          pushPolyline(
            `${idPrefix}-a`,
            makeTangentialSegment(
              result.center,
              trigramRadius,
              bearing,
              -halfLength,
              -gap
            ),
            "magic-stroke magic-pattern-mark magic-stroke--draw",
            row % 2 === 0 ? element.accent : element.pale,
            1.05,
            0.66,
            360,
            0.12
          );
          pushPolyline(
            `${idPrefix}-b`,
            makeTangentialSegment(
              result.center,
              trigramRadius,
              bearing,
              gap,
              halfLength
            ),
            "magic-stroke magic-pattern-mark magic-stroke--draw",
            row % 2 === 0 ? element.accent : element.pale,
            1.05,
            0.66,
            360,
            0.12
          );
        } else {
          pushPolyline(
            idPrefix,
            makeTangentialSegment(
              result.center,
              trigramRadius,
              bearing,
              -halfLength,
              halfLength
            ),
            "magic-stroke magic-pattern-mark magic-stroke--draw",
            row % 2 === 0 ? element.accent : element.pale,
            1.05,
            0.66,
            360,
            0.18
          );
        }
      }
    }
  }

  const chordStep =
    mode === 5
      ? 2
      : mode === 4
        ? 1
        : mode === 8
          ? 3 + (normalizedIndex % 2) * 2
          : 2 + (normalizedIndex % 3);
  const chordPoints = Array.from({ length: mode + 1 }, (_, index) =>
    destinationPoint(
      result.center,
      radiusMeters * 0.7,
      phaseDeg + ((index * chordStep) % mode) * modeSlotDeg
    )
  );
  pushPolyline(
    "chord-seal",
    chordPoints,
    "magic-stroke magic-stroke--draw",
    element.primary,
    1.05,
    0.54,
    760
  );

  result.points.forEach((point, index) => {
    const bearing = starRayBearings[index] ?? phaseDeg + index * modeSlotDeg;
    pushPolyline(
      `spoke-${index}`,
      [
        destinationPoint(result.center, radiusMeters * 0.46, bearing),
        pointFromPoi(point)
      ],
      "magic-stroke magic-spoke magic-stroke--draw",
      index % 2 === 0 ? element.accent : element.primary,
      1,
      0.5,
      520,
      0.5
    );
  });

  for (let index = 0; index < MAGIC_ANIMATION_COUNT; index += 1) {
    const bearing =
      phaseDeg + (FULL_CIRCLE_DEGREES * index) / MAGIC_ANIMATION_COUNT;
    pushPolyline(
      `rune-${index}`,
      makeRuneStroke({
        center: result.center,
        radiusMeters,
        bearing,
        shape: element.runeShape
      }),
      "magic-stroke magic-rune magic-stroke--draw",
      index % 3 === 0 ? element.pale : element.accent,
      element.runeShape === "orb" ? 1 : 1.25,
      0.74,
      430,
      0.34
    );
  }

  switch (element.id) {
    case "metal":
      addRadialTicks("metal-blade", 8, 0.82, 1.12, element.accent, 1.45, 0.72, 11);
      pushPolyline(
        "metal-octagon",
        makePolygonPoints(result.center, radiusMeters * 1.16, 8, phaseDeg + 22.5),
        "magic-stroke magic-stroke--draw",
        element.pale,
        1.15,
        0.56,
        700
      );
      break;
    case "wood":
      addRadialTicks("wood-root", mode * 2, 0.18, 0.74, element.primary, 1.2, 0.55, 8);
      for (let index = 0; index < mode; index += 1) {
        const bearing = starRayBearings[index] ?? phaseDeg + index * modeSlotDeg;
        pushPolyline(
          `wood-branch-${index}`,
          [
            destinationPoint(result.center, radiusMeters * 0.52, bearing),
            destinationPoint(result.center, radiusMeters * 0.67, bearing + 7),
            destinationPoint(result.center, radiusMeters * 0.82, bearing + 23)
          ],
          "magic-stroke magic-branch magic-stroke--draw",
          element.accent,
          1.15,
          0.58,
          620,
          0.56
        );
      }
      break;
    case "water":
      for (let index = 0; index < 4; index += 1) {
        pushPolyline(
          `water-wave-${index}`,
          makeCirclePoints(
            result.center,
            radiusMeters * (0.62 + index * 0.12),
            phaseDeg + index * 18,
            214,
            44
          ),
          "magic-stroke magic-flow magic-stroke--draw",
          index % 2 === 0 ? element.accent : element.primary,
          1.15,
          0.48,
          720,
          0.64
        );
      }
      break;
    case "fire":
      for (let index = 0; index < 10; index += 1) {
        const bearing = phaseDeg + index * 36;
        pushPolyline(
          `fire-flame-${index}`,
          makeZigZagLine(
            result.center,
            radiusMeters * 0.78,
            radiusMeters * 1.18,
            bearing,
            radiusMeters * 0.035,
            4
          ),
          "magic-stroke magic-flame magic-stroke--draw",
          index % 2 === 0 ? element.accent : element.primary,
          1.35,
          0.68,
          560,
          0.42
        );
      }
      break;
    case "earth":
      pushPolyline(
        "earth-square",
        makePolygonPoints(result.center, radiusMeters * 0.91, 4, phaseDeg + 45),
        "magic-stroke magic-stroke--draw",
        element.accent,
        1.55,
        0.64,
        760
      );
      addRadialTicks("earth-pillar", 4, 0.26, 1.03, element.primary, 1.45, 0.58, 45);
      break;
    case "ice":
      addRadialTicks("ice-snow", 12, 0.2, 1.1, element.pale, 1, 0.72, 0);
      for (let index = 0; index < 6; index += 1) {
        const bearing = phaseDeg + index * 60;
        pushPolyline(
          `ice-crystal-${index}`,
          [
            destinationPoint(result.center, radiusMeters * 0.7, bearing - 12),
            destinationPoint(result.center, radiusMeters * 0.84, bearing),
            destinationPoint(result.center, radiusMeters * 0.7, bearing + 12)
          ],
          "magic-stroke magic-crystal magic-stroke--draw",
          element.accent,
          1,
          0.66,
          520,
          0.46
        );
      }
      break;
    case "wind":
      for (let index = 0; index < 5; index += 1) {
        pushPolyline(
          `wind-spiral-${index}`,
          makeCirclePoints(
            result.center,
            radiusMeters * (0.34 + index * 0.15),
            phaseDeg + index * 41,
            154,
            32
          ),
          "magic-stroke magic-wind magic-stroke--draw",
          index % 2 === 0 ? element.accent : element.pale,
          1.05,
          0.44,
          600,
          0.48
        );
      }
      break;
    case "thunder":
      addRadialTicks("thunder-charge", 8, 0.72, 1.12, element.accent, 1.3, 0.7, 7);
      for (let index = 0; index < mode; index += 1) {
        const bearing = phaseDeg + index * modeSlotDeg + modeSlotDeg / 2;
        pushPolyline(
          `thunder-bolt-${index}`,
          makeZigZagLine(
            result.center,
            radiusMeters * 0.25,
            radiusMeters * 0.95,
            bearing,
            radiusMeters * 0.042,
            5
          ),
          "magic-stroke magic-bolt magic-stroke--draw",
          element.accent,
          1.35,
          0.72,
          520,
          0.46
        );
      }
      break;
    case "shadow":
      for (let index = 0; index < 6; index += 1) {
        pushPolyline(
          `shadow-broken-ring-${index}`,
          makeCirclePoints(
            result.center,
            radiusMeters * (0.52 + index * 0.09),
            phaseDeg + index * 47,
            58,
            16
          ),
          "magic-stroke magic-shadow magic-stroke--draw",
          index % 2 === 0 ? element.primary : element.accent,
          1.25,
          0.5,
          620,
          0.44
        );
      }
      break;
    case "blood":
      addRadialTicks("blood-vein", 12, 0.55, 1.03, element.primary, 1.25, 0.62, 5);
      for (let index = 0; index < 7; index += 1) {
        const bearing = phaseDeg + index * 51.4;
        pushPolyline(
          `blood-drip-${index}`,
          makeRadialLine(
            result.center,
            radiusMeters * 0.98,
            radiusMeters * (1.1 + (index % 3) * 0.035),
            bearing
          ),
          "magic-stroke magic-drip magic-stroke--draw",
          element.accent,
          1.5,
          0.72,
          460,
          0.36
        );
      }
      break;
    case "poison":
      for (let index = 0; index < 10; index += 1) {
        const bearing = phaseDeg + index * 36;
        const bubbleCenter = destinationPoint(
          result.center,
          radiusMeters * (0.38 + (index % 4) * 0.17),
          bearing
        );
        pushCircleAt(
          `poison-bubble-${index}`,
          bubbleCenter,
          radiusMeters * (0.025 + (index % 3) * 0.007),
          index % 2 === 0 ? element.accent : element.pale,
          1,
          0.6,
          420,
          "magic-circle magic-bubble magic-circle--draw",
          0.34
        );
      }
      break;
    case "undead":
      addRadialTicks("undead-bone", 8, 0.36, 0.98, element.pale, 1.12, 0.58, 22.5);
      for (let index = 0; index < 4; index += 1) {
        const bearing = phaseDeg + index * 90;
        pushPolyline(
          `undead-crossbar-${index}`,
          [
            destinationPoint(result.center, radiusMeters * 0.58, bearing - 9),
            destinationPoint(result.center, radiusMeters * 0.58, bearing + 9)
          ],
          "magic-stroke magic-bone magic-stroke--draw",
          element.accent,
          1.2,
          0.62,
          520,
          0.5
        );
      }
      break;
    case "sun":
      addRadialTicks("sun-ray", 16, 0.86, 1.2, element.accent, 1.45, 0.74, 0);
      pushCircle("sun-halo", 1.22, element.pale, 1.1, 0.48, 720, "magic-circle magic-halo magic-circle--draw");
      break;
    case "moon": {
      const crescentCenter = destinationPoint(
        result.center,
        radiusMeters * 0.12,
        phaseDeg + 135
      );
      pushCircleAt(
        "moon-crescent-outer",
        crescentCenter,
        radiusMeters * 0.36,
        element.accent,
        1.2,
        0.56,
        650,
        "magic-circle magic-moon magic-circle--draw"
      );
      for (let index = 0; index < 4; index += 1) {
        pushPolyline(
          `moon-tide-${index}`,
          makeCirclePoints(
            result.center,
            radiusMeters * (0.66 + index * 0.09),
            phaseDeg + 178 + index * 10,
            92,
            22
          ),
          "magic-stroke magic-moon magic-stroke--draw",
          element.pale,
          1,
          0.48,
          540,
          0.44
        );
      }
      break;
    }
    case "star":
      for (let index = 0; index < MAGIC_ANIMATION_COUNT; index += 1) {
        const bearing = phaseDeg + index * 22.5;
        const point = destinationPoint(
          result.center,
          radiusMeters * (0.34 + (index % 5) * 0.15),
          bearing
        );
        pushPolyline(
          `star-spark-${index}`,
          makePolygonPoints(point, radiusMeters * 0.026, 5, bearing),
          "magic-stroke magic-constellation magic-stroke--draw",
          index % 2 === 0 ? element.accent : element.pale,
          1,
          0.74,
          360,
          0.28
        );
      }
      break;
    case "soul":
      for (let index = 0; index < 6; index += 1) {
        const bearing = phaseDeg + index * 60;
        pushPolyline(
          `soul-wisp-${index}`,
          [
            destinationPoint(result.center, radiusMeters * 0.28, bearing),
            destinationPoint(result.center, radiusMeters * 0.52, bearing + 21),
            destinationPoint(result.center, radiusMeters * 0.76, bearing - 13),
            destinationPoint(result.center, radiusMeters * 1.02, bearing + 8)
          ],
          "magic-stroke magic-soul magic-stroke--draw",
          index % 2 === 0 ? element.accent : element.pale,
          1.1,
          0.5,
          680,
          0.48
        );
      }
      break;
    default:
      break;
  }

  pushCircle("core-ring", 0.16, element.accent, 1.2, 0.64, 560);
  pushPolyline(
    "core-axis",
    [
      destinationPoint(result.center, radiusMeters * 0.24, phaseDeg + 90),
      destinationPoint(result.center, radiusMeters * 0.24, phaseDeg + 270)
    ],
    "magic-stroke magic-stroke--draw",
    element.primary,
    1.15,
    0.58,
    480
  );

  pushSymbol(
    "center-symbol",
    result.center,
    "center",
    element.centerSymbol,
    46,
    element.primary,
    1,
    640,
    phaseDeg,
    0.52
  );

  result.points.forEach((point, index) => {
    const bearing = starRayBearings[index] ?? phaseDeg + index * modeSlotDeg;
    pushSymbol(
      `endpoint-symbol-${index}`,
      pointFromPoi(point),
      "endpoint",
      element.endpointSymbol,
      44,
      index % 2 === 0 ? element.accent : element.primary,
      1,
      520,
      bearing,
      0.24
    );
  });

  const ambientCount = element.ambientEffect === "ghosts" ? 9 : 8;
  for (let index = 0; index < ambientCount; index += 1) {
    const rayIndex = index % Math.max(1, starRayBearings.length);
    const bearing =
      starRayBearings[rayIndex] ?? phaseDeg + rayIndex * modeSlotDeg;
    const radiusScale = 0.28 + (Math.floor(index / mode) % 4) * 0.18;
    pushSymbol(
      `ambient-symbol-${index}`,
      destinationPoint(result.center, radiusMeters * radiusScale, bearing),
      "ambient",
      index % 2 === 0 ? element.endpointSymbol : element.centerSymbol,
      19 + (index % 3) * 2,
      index % 2 === 0 ? element.accent : element.pale,
      0.82,
      560,
      bearing,
      0.16
    );
  }

  return strokes;
};
