import { DEFAULT_CATEGORY_IDS, POI_CATEGORIES } from "../data/categories";
import type { SearchStrategy, StarMode } from "../types";
import { isStarMode, maxAngleToleranceForMode } from "./starPatterns";

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
  selectedCategoryGroups: string[];
  categoryGroupSelectionSnapshots: Record<string, string[]>;
  theme: ThemeMode;
  mapLayer: MapLayerId;
}

export const DEFAULT_APP_SETTINGS: AppSettings = {
  innerRadiusKm: 4,
  outerRadiusKm: 6,
  starMode: 5,
  angleToleranceDeg: 6,
  candidatesPerSlot: 4,
  rotationStepDeg: 3,
  searchStrategy: "honeycomb",
  hexCellRadiusKm: 0.5,
  showSectors: true,
  showHoneycomb: false,
  selectedCategoryIds: DEFAULT_CATEGORY_IDS,
  selectedCategoryGroups: [],
  categoryGroupSelectionSnapshots: {},
  theme: "light",
  mapLayer: "street"
};

type SettingsSource = Partial<AppSettings> & { radiusKm?: unknown };

const LEGACY_DEFAULT_OUTER_RADIUS_KM = 30;
const LEGACY_DEFAULT_INNER_RADIUS_KM = 0;
const LEGACY_DEFAULT_ANGLE_TOLERANCE_BY_MODE: Partial<Record<StarMode, number>> =
  {
    5: 36,
    6: 30
  };
const LEGACY_DEFAULT_CANDIDATES_PER_SLOT = 8;

const toFiniteNumber = (value: unknown) => {
  const numberValue = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numberValue) ? numberValue : null;
};

const matchesStoredNumber = (value: unknown, expected: number) =>
  toFiniteNumber(value) === expected;

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

const parseStarMode = (value: unknown): StarMode => {
  const numericValue = typeof value === "number" ? value : Number(value);
  return isStarMode(numericValue) ? numericValue : DEFAULT_APP_SETTINGS.starMode;
};

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

const CATEGORY_GROUPS = [
  ...new Set(POI_CATEGORIES.map((category) => category.group))
];
const CATEGORY_IDS_BY_GROUP = new Map(
  CATEGORY_GROUPS.map((group) => [
    group,
    POI_CATEGORIES.filter((category) => category.group === group).map(
      (category) => category.id
    )
  ])
);

const parseCategoryGroups = (value: unknown) => {
  const availableGroups = new Set(CATEGORY_GROUPS);
  const groups = Array.isArray(value)
    ? value.filter(
        (group): group is string =>
          typeof group === "string" && availableGroups.has(group)
      )
    : [];

  return [...new Set(groups)];
};

const getCategoryIdsForGroups = (groups: string[]) =>
  groups.flatMap((group) => CATEGORY_IDS_BY_GROUP.get(group) ?? []);

const parseCategoryGroupSelectionSnapshots = (
  value: unknown,
  selectedCategoryGroups: string[]
) => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};

  const selectedGroupSet = new Set(selectedCategoryGroups);
  const snapshots: Record<string, string[]> = {};

  for (const [group, ids] of Object.entries(value as Record<string, unknown>)) {
    if (!selectedGroupSet.has(group)) continue;

    const groupCategoryIdSet = new Set(CATEGORY_IDS_BY_GROUP.get(group) ?? []);
    snapshots[group] = Array.isArray(ids)
      ? [
          ...new Set(
            ids.filter(
              (id): id is string =>
                typeof id === "string" && groupCategoryIdSet.has(id)
            )
          )
        ]
      : [];
  }

  return snapshots;
};

const parseCategoryIds = (value: unknown, selectedCategoryGroups: string[]) => {
  const availableIds = new Set(POI_CATEGORIES.map((category) => category.id));
  const ids = Array.isArray(value)
    ? value.filter(
        (id): id is string => typeof id === "string" && availableIds.has(id)
      )
    : [];
  const groupCategoryIds = getCategoryIdsForGroups(selectedCategoryGroups);
  const mergedIds = [...new Set([...ids, ...groupCategoryIds])];

  return mergedIds.length > 0 ? mergedIds : DEFAULT_CATEGORY_IDS;
};

const migrateLegacyDefaultSettings = (source: SettingsSource): SettingsSource => {
  let migratedSource: SettingsSource | null = null;
  const mutableSource = () => {
    migratedSource ??= { ...source };
    return migratedSource;
  };
  const starMode = parseStarMode(source.starMode);
  const outerRadiusSource = source.outerRadiusKm ?? source.radiusKm;
  const hasLegacyDefaultRadiusRange =
    matchesStoredNumber(outerRadiusSource, LEGACY_DEFAULT_OUTER_RADIUS_KM) &&
    (source.innerRadiusKm === undefined ||
      matchesStoredNumber(source.innerRadiusKm, LEGACY_DEFAULT_INNER_RADIUS_KM));
  const legacyDefaultAngleTolerance =
    LEGACY_DEFAULT_ANGLE_TOLERANCE_BY_MODE[starMode];

  if (hasLegacyDefaultRadiusRange) {
    const nextSource = mutableSource();
    nextSource.innerRadiusKm = DEFAULT_APP_SETTINGS.innerRadiusKm;
    nextSource.outerRadiusKm = DEFAULT_APP_SETTINGS.outerRadiusKm;
  }

  if (
    legacyDefaultAngleTolerance !== undefined &&
    matchesStoredNumber(source.angleToleranceDeg, legacyDefaultAngleTolerance)
  ) {
    mutableSource().angleToleranceDeg = DEFAULT_APP_SETTINGS.angleToleranceDeg;
  }

  if (
    matchesStoredNumber(
      source.candidatesPerSlot,
      LEGACY_DEFAULT_CANDIDATES_PER_SLOT
    )
  ) {
    mutableSource().candidatesPerSlot = DEFAULT_APP_SETTINGS.candidatesPerSlot;
  }

  return migratedSource ?? source;
};

export const normalizeSettings = (value: unknown): AppSettings => {
  const rawSource: SettingsSource =
    value && typeof value === "object"
      ? (value as SettingsSource)
      : DEFAULT_APP_SETTINGS;
  const source = migrateLegacyDefaultSettings(rawSource);
  const starMode = parseStarMode(source.starMode);
  const maxAngleToleranceDeg = maxAngleToleranceForMode(starMode);
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
  const selectedCategoryGroups = parseCategoryGroups(
    source.selectedCategoryGroups
  );
  const categoryGroupSelectionSnapshots =
    parseCategoryGroupSelectionSnapshots(
      source.categoryGroupSelectionSnapshots,
      selectedCategoryGroups
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
      0.3,
      3,
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
    selectedCategoryIds: parseCategoryIds(
      source.selectedCategoryIds,
      selectedCategoryGroups
    ),
    selectedCategoryGroups,
    categoryGroupSelectionSnapshots,
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
  try {
    window.localStorage.setItem(
      SETTINGS_STORAGE_KEY,
      JSON.stringify(normalizeSettings(settings))
    );
  } catch {
    // Persisted settings are best-effort; keep the app usable if storage fails.
  }
};
