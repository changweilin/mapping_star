import type { StarMode } from "../types";
import {
  ZODIAC_CONSTELLATIONS,
  ZODIAC_CONSTELLATION_SCALE
} from "./magicCircle";

export type HoneycombPatternShape =
  | "star"
  | "cross"
  | "bagua"
  | "rose"
  | "sierpinski"
  | "zodiac";

export type HoneycombTargetRadius = "target" | number;

export interface HoneycombTargetBand {
  id: string;
  slots: number;
  radius: HoneycombTargetRadius;
  phaseOffsetDeg?: number;
}

export interface HoneycombTargetNode {
  id: string;
  label: string;
  radiusScale: number;
  bearingDeg: number;
}

export interface HoneycombSearchProfile {
  key: string;
  ignoreInnerRadius: boolean;
  priorityRings: number;
  fastCandidatesPerSlot: number;
  fastRotationStepDeg: number;
  initialCellCount: number;
  cellsPerBatch: number;
  rotationSpanDeg?: number;
  targetBands: HoneycombTargetBand[];
  targetNodes: HoneycombTargetNode[];
}

interface HoneycombSearchProfileOptions {
  shape: HoneycombPatternShape;
  variantId: string;
  mode: StarMode;
}

const DEFAULT_CELLS_PER_BATCH = 10;

const perimeterBand = (slots: number): HoneycombTargetBand => ({
  id: "perimeter",
  slots,
  radius: "target"
});

const parseVariantNumber = (variantId: string, prefix: string, fallback: number) => {
  const rawValue = variantId.startsWith(prefix)
    ? variantId.slice(prefix.length)
    : variantId;
  const numericValue = Number(rawValue);

  return Number.isFinite(numericValue) ? Math.round(numericValue) : fallback;
};

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

const normalizeDegrees = (degrees: number) => {
  const normalized = degrees % 360;
  return normalized < 0 ? normalized + 360 : normalized;
};

const pointToNode = (
  id: string,
  label: string,
  x: number,
  y: number
): HoneycombTargetNode => ({
  id,
  label,
  radiusScale: Math.hypot(x, y),
  bearingDeg: normalizeDegrees((Math.atan2(x, y) * 180) / Math.PI)
});

const makeRoseTargetNodes = (petalFactor: number): HoneycombTargetNode[] => {
  const petalCount = petalFactor % 2 === 0 ? petalFactor * 2 : petalFactor;

  return Array.from({ length: petalCount }, (_, index) => ({
    id: `rose-tip-${index + 1}`,
    label: `玫瑰瓣尖 ${index + 1}`,
    radiusScale: 0.56,
    bearingDeg: (360 * index) / petalCount
  }));
};

type PlanarPoint = {
  x: number;
  y: number;
};

const makeTrianglePoint = (radiusScale: number, bearingDeg: number) => {
  const bearing = (bearingDeg * Math.PI) / 180;
  return {
    x: radiusScale * Math.sin(bearing),
    y: radiusScale * Math.cos(bearing)
  };
};

const midpoint = (first: PlanarPoint, second: PlanarPoint): PlanarPoint => ({
  x: (first.x + second.x) / 2,
  y: (first.y + second.y) / 2
});

const makeSierpinskiSegments = (
  radiusScale: number,
  depth: number
): PlanarPoint[][] => {
  const [top, right, left] = [0, 1, 2].map((index) =>
    makeTrianglePoint(radiusScale, index * 120)
  );

  const buildSegments = (
    a: PlanarPoint,
    b: PlanarPoint,
    c: PlanarPoint,
    remainingDepth: number
  ): PlanarPoint[][] => {
    if (remainingDepth <= 0) return [[a, b, c]];

    const ab = midpoint(a, b);
    const bc = midpoint(b, c);
    const ca = midpoint(c, a);

    return [
      ...buildSegments(a, ab, ca, remainingDepth - 1),
      ...buildSegments(ab, b, bc, remainingDepth - 1),
      ...buildSegments(ca, bc, c, remainingDepth - 1)
    ];
  };

  return buildSegments(top, right, left, depth);
};

const makeSierpinskiTargetNodes = (depth: number): HoneycombTargetNode[] => {
  const vertices = new Map<string, PlanarPoint>();
  for (const segment of makeSierpinskiSegments(0.82, depth)) {
    for (const point of segment) {
      vertices.set(`${point.x.toFixed(6)},${point.y.toFixed(6)}`, point);
    }
  }

  const limit = clamp(3 * (depth + 1), 6, 18);
  return [...vertices.values()]
    .sort((a, b) => {
      const radiusDelta = Math.hypot(b.x, b.y) - Math.hypot(a.x, a.y);
      if (Math.abs(radiusDelta) > 0.000001) return radiusDelta;
      return (
        normalizeDegrees((Math.atan2(a.x, a.y) * 180) / Math.PI) -
        normalizeDegrees((Math.atan2(b.x, b.y) * 180) / Math.PI)
      );
    })
    .slice(0, limit)
    .map((point, index) =>
      pointToNode(
        `sierpinski-vertex-${index + 1}`,
        `Sierpinski 節點 ${index + 1}`,
        point.x,
        point.y
      )
    );
};

const makeZodiacTargetNodes = (signNumber: number): HoneycombTargetNode[] => {
  const constellation = ZODIAC_CONSTELLATIONS[signNumber - 1]!;
  const rotationDeg = constellation.rotationDeg ?? 0;

  return constellation.points.map((point, index) => {
    const x = point.x * ZODIAC_CONSTELLATION_SCALE;
    const y = point.y * ZODIAC_CONSTELLATION_SCALE;
    return {
      ...pointToNode(
        `zodiac-${constellation.id}-${index + 1}`,
        `${constellation.name}星點 ${index + 1}`,
        x,
        y
      ),
      bearingDeg: normalizeDegrees(
        (Math.atan2(x, y) * 180) / Math.PI + rotationDeg
      )
    };
  });
};

const starProfile = (mode: StarMode): HoneycombSearchProfile => {
  const denseMode = mode >= 7;

  return {
    key: `star:${mode}`,
    ignoreInnerRadius: false,
    priorityRings: denseMode ? 3 : 2,
    fastCandidatesPerSlot: denseMode ? 5 : 4,
    fastRotationStepDeg: denseMode ? 4 : 6,
    initialCellCount: mode,
    cellsPerBatch: denseMode ? 12 : DEFAULT_CELLS_PER_BATCH,
    targetBands: [perimeterBand(mode)],
    targetNodes: []
  };
};

const crossProfile = (): HoneycombSearchProfile => ({
  key: "cross:4",
  ignoreInnerRadius: true,
  priorityRings: 2,
  fastCandidatesPerSlot: 4,
  fastRotationStepDeg: 6,
  initialCellCount: 8,
  cellsPerBatch: DEFAULT_CELLS_PER_BATCH,
  targetBands: [
    perimeterBand(4),
    { id: "inner-axis", slots: 4, radius: 0.42 }
  ],
  targetNodes: []
});

const baguaProfile = (): HoneycombSearchProfile => ({
  key: "bagua:8",
  ignoreInnerRadius: true,
  priorityRings: 3,
  fastCandidatesPerSlot: 5,
  fastRotationStepDeg: 4,
  initialCellCount: 12,
  cellsPerBatch: 12,
  targetBands: [
    perimeterBand(8),
    { id: "inner-gates", slots: 8, radius: 0.52, phaseOffsetDeg: 22.5 },
    { id: "center-cardinals", slots: 4, radius: 0.24, phaseOffsetDeg: 45 }
  ],
  targetNodes: []
});

const roseProfile = (variantId: string): HoneycombSearchProfile => {
  const petalFactor = clamp(parseVariantNumber(variantId, "k-", 7), 1, 12);
  const densePetals = petalFactor >= 7;
  const targetNodes = makeRoseTargetNodes(petalFactor);

  return {
    key: `rose:k-${petalFactor}`,
    ignoreInnerRadius: true,
    priorityRings: densePetals ? 4 : 3,
    fastCandidatesPerSlot: clamp(Math.ceil(petalFactor / 2), 4, 8),
    fastRotationStepDeg: densePetals ? 3 : 4,
    initialCellCount: clamp(petalFactor * 2, 4, 18),
    cellsPerBatch: densePetals ? 14 : 12,
    targetBands: [
      { id: "petal-tips", slots: petalFactor, radius: 0.62 },
      {
        id: "petal-inner",
        slots: petalFactor,
        radius: 0.34,
        phaseOffsetDeg: 180 / petalFactor
      },
      ...(densePetals
        ? [
            {
              id: "petal-core",
              slots: petalFactor,
              radius: 0.18,
              phaseOffsetDeg: 90 / petalFactor
            }
          ]
        : [])
    ],
    rotationSpanDeg: 360 / targetNodes.length,
    targetNodes
  };
};

const sierpinskiProfile = (variantId: string): HoneycombSearchProfile => {
  const depth = clamp(parseVariantNumber(variantId, "d-", 3), 1, 4);
  const deepPattern = depth >= 3;
  const targetNodes = makeSierpinskiTargetNodes(depth);

  return {
    key: `sierpinski:d-${depth}`,
    ignoreInnerRadius: true,
    priorityRings: deepPattern ? 4 : 3,
    fastCandidatesPerSlot: deepPattern ? 6 : 4,
    fastRotationStepDeg: deepPattern ? 3 : 4,
    initialCellCount: clamp(3 * (depth + 1), 6, 18),
    cellsPerBatch: deepPattern ? 14 : 12,
    targetBands: [
      { id: "triangle-corners", slots: 3, radius: 0.82 },
      { id: "edge-midpoints", slots: 3, radius: 0.5, phaseOffsetDeg: 60 },
      ...(deepPattern
        ? [{ id: "inner-triangles", slots: 6, radius: 0.28, phaseOffsetDeg: 30 }]
        : [])
    ],
    rotationSpanDeg: 120,
    targetNodes
  };
};

const zodiacProfile = (variantId: string): HoneycombSearchProfile => {
  const signNumber = clamp(parseVariantNumber(variantId, "", 1), 1, 12);
  const targetNodes = makeZodiacTargetNodes(signNumber);

  return {
    key: `zodiac:${signNumber}`,
    ignoreInnerRadius: true,
    priorityRings: 4,
    fastCandidatesPerSlot: 6,
    fastRotationStepDeg: 3,
    initialCellCount: 12,
    cellsPerBatch: 14,
    targetBands: [
      { id: "zodiac-gates", slots: 12, radius: 0.92 },
      { id: "constellation-core", slots: 6, radius: 0.52, phaseOffsetDeg: 15 },
      { id: "constellation-stars", slots: 8, radius: 0.28, phaseOffsetDeg: 7.5 }
    ],
    rotationSpanDeg: 30,
    targetNodes
  };
};

export const getHoneycombSearchProfile = ({
  shape,
  variantId,
  mode
}: HoneycombSearchProfileOptions): HoneycombSearchProfile => {
  switch (shape) {
    case "cross":
      return crossProfile();
    case "bagua":
      return baguaProfile();
    case "rose":
      return roseProfile(variantId);
    case "sierpinski":
      return sierpinskiProfile(variantId);
    case "zodiac":
      return zodiacProfile(variantId);
    case "star":
    default:
      return starProfile(mode);
  }
};
