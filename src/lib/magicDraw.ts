import {
  ZODIAC_CONSTELLATIONS,
  type MagicCircleGeometryOptions,
  type MagicCombinedShape,
  type MagicGeometryPattern
} from "./magicCircle";
import { DEFAULT_MAGIC_DRAW_VARIANTS } from "./settings";
import type { MagicDrawShape, MagicPlaybackMode, StarMode } from "../types";

export type MagicDrawVariantOption = {
  id: string;
  label: string;
  mode?: StarMode;
  geometryPattern: MagicGeometryPattern;
  geometryOptions?: MagicCircleGeometryOptions;
};

export const MAGIC_PLAYBACK_MODES = [
  { id: "single", label: "單曲播放" },
  { id: "continuous", label: "連續播放" },
  { id: "loop-all", label: "循環播放" },
  { id: "loop-one", label: "單曲循環播放" }
] satisfies Array<{ id: MagicPlaybackMode; label: string }>;

const makeCombinedVariant = (
  id: string,
  label: string,
  mode: StarMode,
  combinedShape: MagicCombinedShape
): MagicDrawVariantOption => ({
  id,
  label,
  mode,
  geometryPattern: "combined",
  geometryOptions: { combinedShape }
});

export const MAGIC_DRAW_SHAPE_OPTIONS = [
  { id: "star", label: "星芒" },
  { id: "cross", label: "十字星" },
  { id: "bagua", label: "八卦陣" },
  { id: "rose", label: "玫瑰曲線" },
  { id: "sierpinski", label: "Sierpinski 三角形" },
  { id: "zodiac", label: "星座" }
] satisfies Array<{ id: MagicDrawShape; label: string }>;

export const MAGIC_DRAW_VARIANT_OPTIONS = {
  star: [
    makeCombinedVariant("5", "5", 5, "star"),
    makeCombinedVariant("6", "6", 6, "star"),
    makeCombinedVariant("7", "7", 7, "star"),
    makeCombinedVariant("8", "8", 8, "star")
  ],
  cross: [makeCombinedVariant("4", "4", 4, "cross")],
  bagua: [makeCombinedVariant("8", "8", 8, "bagua")],
  rose: [2, 3, 4, 5, 6, 7, 8, 9].map((petalFactor): MagicDrawVariantOption => ({
    id: `k-${petalFactor}`,
    label:
      petalFactor % 2 === 0
        ? `k=${petalFactor} (${petalFactor * 2}瓣)`
        : `k=${petalFactor}`,
    geometryPattern: "rose",
    geometryOptions: { rosePetalFactor: petalFactor }
  })),
  sierpinski: [1, 2, 3, 4].map((depth): MagicDrawVariantOption => ({
    id: `d-${depth}`,
    label: `d=${depth}`,
    geometryPattern: "sierpinski",
    geometryOptions: { sierpinskiDepth: depth }
  })),
  zodiac: ZODIAC_CONSTELLATIONS.map(
    (constellation, index): MagicDrawVariantOption => ({
      id: `${index + 1}`,
      label: `${index + 1} ${constellation.name}`,
      geometryPattern: "zodiac",
      geometryOptions: { zodiacIndex: index }
    })
  )
} satisfies Record<MagicDrawShape, MagicDrawVariantOption[]>;

export const isMagicDrawShape = (value: string): value is MagicDrawShape =>
  MAGIC_DRAW_SHAPE_OPTIONS.some((option) => option.id === value);

export const getMagicDrawShapeForMode = (mode: StarMode): MagicDrawShape =>
  mode === 4 ? "cross" : mode === 8 ? "bagua" : "star";

export const getMagicDrawVariantOption = (
  shape: MagicDrawShape,
  value: string | undefined
) => {
  const options = MAGIC_DRAW_VARIANT_OPTIONS[shape];
  return options.find((option) => option.id === value) ?? options[0]!;
};

export const makeInitialMagicDrawVariants = (mode: StarMode) => {
  const shape = getMagicDrawShapeForMode(mode);
  return {
    ...DEFAULT_MAGIC_DRAW_VARIANTS,
    [shape]: String(mode)
  };
};
