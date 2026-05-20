import { DEFAULT_CATEGORY_IDS, POI_CATEGORIES } from "../data/categories";
import type { StarMode } from "../types";

export const SETTINGS_STORAGE_KEY = "mapping-star:settings";

export interface AppSettings {
  radiusKm: number;
  starMode: StarMode;
  angleToleranceDeg: number;
  candidatesPerSlot: number;
  rotationStepDeg: number;
  showSectors: boolean;
  selectedCategoryIds: string[];
}

export const DEFAULT_APP_SETTINGS: AppSettings = {
  radiusKm: 30,
  starMode: 5,
  angleToleranceDeg: 36,
  candidatesPerSlot: 8,
  rotationStepDeg: 3,
  showSectors: true,
  selectedCategoryIds: DEFAULT_CATEGORY_IDS
};

const clampNumber = (value: unknown, min: number, max: number, fallback: number) => {
  const numberValue = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numberValue)) return fallback;
  return Math.min(max, Math.max(min, Math.round(numberValue)));
};

const parseStarMode = (value: unknown): StarMode =>
  value === 6 ? 6 : DEFAULT_APP_SETTINGS.starMode;

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
  const source =
    value && typeof value === "object"
      ? (value as Partial<AppSettings>)
      : DEFAULT_APP_SETTINGS;
  const starMode = parseStarMode(source.starMode);
  const maxAngleToleranceDeg = starMode === 5 ? 36 : 30;

  return {
    radiusKm: clampNumber(source.radiusKm, 1, 30, DEFAULT_APP_SETTINGS.radiusKm),
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
    showSectors:
      typeof source.showSectors === "boolean"
        ? source.showSectors
        : DEFAULT_APP_SETTINGS.showSectors,
    selectedCategoryIds: parseCategoryIds(source.selectedCategoryIds)
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

