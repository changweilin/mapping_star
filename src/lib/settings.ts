import { DEFAULT_CATEGORY_IDS, POI_CATEGORIES } from "../data/categories";
import type { SearchStrategy, StarMode } from "../types";

export const SETTINGS_STORAGE_KEY = "mapping-star:settings";

export type ThemeMode = "light" | "dark";
export type MapLayerId = "street" | "terrain" | "satellite";

export interface AppSettings {
  innerRadiusKm: number;
  outerRadiusKm: number;
  starMode: StarMode;
  angleToleranceDeg: number;
  candidatesPerSlot: number;
  rotationStepDeg: number;
  searchStrategy: SearchStrategy;
  hexCellRadiusKm: number;
  showSectors: boolean;
  showHoneycomb: boolean;
  selectedCategoryIds: string[];
  theme: ThemeMode;
  mapLayer: MapLayerId;
}

export const DEFAULT_APP_SETTINGS: AppSettings = {
  innerRadiusKm: 0,
  outerRadiusKm: 30,
  starMode: 5,
  angleToleranceDeg: 36,
  candidatesPerSlot: 8,
  rotationStepDeg: 3,
  searchStrategy: "honeycomb",
  hexCellRadiusKm: 0.5,
  showSectors: true,
  showHoneycomb: false,
  selectedCategoryIds: DEFAULT_CATEGORY_IDS,
  theme: "light",
  mapLayer: "street"
};

const clampNumber = (value: unknown, min: number, max: number, fallback: number) => {
  const numberValue = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numberValue)) return fallback;
  return Math.min(max, Math.max(min, Math.round(numberValue)));
};

const clampSteppedNumber = (
  value: unknown,
  min: number,
  max: number,
  fallback: number,
  step: number
) => {
  const numberValue = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numberValue)) return fallback;
  const clampedValue = Math.min(max, Math.max(min, numberValue));
  const decimals = step.toString().split(".")[1]?.length ?? 0;
  return Number((Math.round(clampedValue / step) * step).toFixed(decimals));
};

const parseStarMode = (value: unknown): StarMode =>
  value === 6 ? 6 : DEFAULT_APP_SETTINGS.starMode;

const parseSearchStrategy = (value: unknown): SearchStrategy =>
  value === "angular" || value === "honeycomb"
    ? value
    : DEFAULT_APP_SETTINGS.searchStrategy;

const parseTheme = (value: unknown): ThemeMode =>
  value === "dark" || value === "light" ? value : DEFAULT_APP_SETTINGS.theme;

const parseMapLayer = (value: unknown): MapLayerId =>
  value === "street" || value === "terrain" || value === "satellite"
    ? value
    : DEFAULT_APP_SETTINGS.mapLayer;

const parseCategoryIds = (value: unknown) => {
  const availableIds = new Set(POI_CATEGORIES.map((category) => category.id));
  const ids = Array.isArray(value)
    ? value.filter(
        (id): id is string => typeof id === "string" && availableIds.has(id)
      )
    : [];

  return ids.length > 0 ? [...new Set(ids)] : DEFAULT_CATEGORY_IDS;
};

export const normalizeSettings = (value: unknown): AppSettings => {
  const source: Partial<AppSettings> & { radiusKm?: unknown } =
    value && typeof value === "object"
      ? (value as Partial<AppSettings> & { radiusKm?: unknown })
      : DEFAULT_APP_SETTINGS;
  const starMode = parseStarMode(source.starMode);
  const maxAngleToleranceDeg = starMode === 5 ? 36 : 30;
  const outerRadiusKm = clampNumber(
    source.outerRadiusKm ?? source.radiusKm,
    1,
    30,
    DEFAULT_APP_SETTINGS.outerRadiusKm
  );
  const innerRadiusKm = clampNumber(
    source.innerRadiusKm,
    0,
    outerRadiusKm - 1,
    DEFAULT_APP_SETTINGS.innerRadiusKm
  );

  return {
    innerRadiusKm,
    outerRadiusKm,
    starMode,
    angleToleranceDeg: clampNumber(
      source.angleToleranceDeg,
      6,
      maxAngleToleranceDeg,
      Math.min(DEFAULT_APP_SETTINGS.angleToleranceDeg, maxAngleToleranceDeg)
    ),
    candidatesPerSlot: clampNumber(
      source.candidatesPerSlot,
      1,
      12,
      DEFAULT_APP_SETTINGS.candidatesPerSlot
    ),
    rotationStepDeg: clampNumber(
      source.rotationStepDeg,
      1,
      8,
      DEFAULT_APP_SETTINGS.rotationStepDeg
    ),
    searchStrategy: parseSearchStrategy(source.searchStrategy),
    hexCellRadiusKm: clampSteppedNumber(
      source.hexCellRadiusKm,
      0.1,
      10,
      DEFAULT_APP_SETTINGS.hexCellRadiusKm,
      0.1
    ),
    showSectors:
      typeof source.showSectors === "boolean"
        ? source.showSectors
        : DEFAULT_APP_SETTINGS.showSectors,
    showHoneycomb:
      typeof source.showHoneycomb === "boolean"
        ? source.showHoneycomb
        : DEFAULT_APP_SETTINGS.showHoneycomb,
    selectedCategoryIds: parseCategoryIds(source.selectedCategoryIds),
    theme: parseTheme(source.theme),
    mapLayer: parseMapLayer(source.mapLayer)
  };
};

export const loadSettings = (): AppSettings => {
  try {
    const raw = window.localStorage.getItem(SETTINGS_STORAGE_KEY);
    return normalizeSettings(raw ? JSON.parse(raw) : DEFAULT_APP_SETTINGS);
  } catch {
    return DEFAULT_APP_SETTINGS;
  }
};

export const saveSettings = (settings: AppSettings) => {
  window.localStorage.setItem(
    SETTINGS_STORAGE_KEY,
    JSON.stringify(normalizeSettings(settings))
  );
};
