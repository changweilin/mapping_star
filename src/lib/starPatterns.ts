import type { StarMode } from "../types";

export const STAR_PATTERN_OPTIONS = [
  { mode: 5, label: "五芒星" },
  { mode: 6, label: "六芒星" },
  { mode: 4, label: "十字星" },
  { mode: 8, label: "八卦圖" }
] as const satisfies readonly { mode: StarMode; label: string }[];

const STAR_PATTERN_LABELS = new Map<StarMode, string>(
  STAR_PATTERN_OPTIONS.map(({ mode, label }) => [mode, label])
);

export const isStarMode = (value: unknown): value is StarMode =>
  typeof value === "number" &&
  STAR_PATTERN_OPTIONS.some((option) => option.mode === value);

export const starModeLabel = (mode: StarMode) =>
  STAR_PATTERN_LABELS.get(mode) ?? "五芒星";

export const maxAngleToleranceForMode = (mode: StarMode) =>
  Math.floor(180 / mode);

export const defaultRotationStepForMode = (mode: StarMode) =>
  mode === 5 ? 6 : mode === 8 ? 4 : 5;

export const defaultCandidatesPerSlotForMode = (mode: StarMode) =>
  mode === 5 ? 5 : 4;

export const starLineSequencesForMode = (mode: StarMode): number[][] => {
  switch (mode) {
    case 4:
      return [
        [0, 2],
        [1, 3]
      ];
    case 6:
      return [
        [0, 2, 4, 0],
        [1, 3, 5, 1]
      ];
    case 8:
      return [
        [0, 1, 2, 3, 4, 5, 6, 7, 0],
        [0, 4],
        [1, 5],
        [2, 6],
        [3, 7]
      ];
    case 5:
    default:
      return [[0, 2, 4, 1, 3, 0]];
  }
};
