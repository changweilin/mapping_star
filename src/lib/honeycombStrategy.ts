import type { StarMode } from "../types";

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

export interface HoneycombSearchProfile {
  key: string;
  ignoreInnerRadius: boolean;
  priorityRings: number;
  fastCandidatesPerSlot: number;
  fastRotationStepDeg: number;
  initialCellCount: number;
  cellsPerBatch: number;
  targetBands: HoneycombTargetBand[];
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
    targetBands: [perimeterBand(mode)]
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
  ]
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
  ]
});

const roseProfile = (variantId: string): HoneycombSearchProfile => {
  const petalFactor = clamp(parseVariantNumber(variantId, "k-", 7), 1, 12);
  const densePetals = petalFactor >= 7;

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
    ]
  };
};

const sierpinskiProfile = (variantId: string): HoneycombSearchProfile => {
  const depth = clamp(parseVariantNumber(variantId, "d-", 3), 1, 4);
  const deepPattern = depth >= 3;

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
    ]
  };
};

const zodiacProfile = (variantId: string): HoneycombSearchProfile => {
  const signNumber = clamp(parseVariantNumber(variantId, "", 1), 1, 12);

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
    ]
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
