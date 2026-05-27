import type {
  AppSettings
} from "./settings";
import { normalizeSettings } from "./settings";
import type { CalculationRecord, LatLng, Poi, StarResult } from "../types";
import {
  normalizeCalculationRecord,
  normalizeLatLng,
  normalizePoi,
  normalizeStarResult
} from "./archiveValidation";

export const SEARCH_SESSION_STORAGE_KEY = "mapping-star:search-session";
export const SEARCH_SESSION_ARCHIVE_TYPE = "mapping-star:search-session";
export const SEARCH_SESSION_ARCHIVE_VERSION = 1;

export interface SearchSessionData {
  center: LatLng;
  centerName: string;
  searchText: string;
  pois: Poi[];
  results: StarResult[];
  calculationRecords: CalculationRecord[];
  selectedResultIndex: number;
  settings: AppSettings | null;
}

export interface SearchSessionArchive extends SearchSessionData {
  type: typeof SEARCH_SESSION_ARCHIVE_TYPE;
  version: typeof SEARCH_SESSION_ARCHIVE_VERSION;
  exportedAt: string;
}

const isObject = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const toString = (value: unknown, fallback = "") =>
  typeof value === "string" ? value : fallback;

const toInteger = (value: unknown, fallback = 0) => {
  const numberValue = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numberValue) ? Math.round(numberValue) : fallback;
};

const formatCoordinate = ({ lat, lng }: LatLng) =>
  `${lat.toFixed(6)}, ${lng.toFixed(6)}`;

export const createSearchSessionArchive = (
  session: SearchSessionData
): SearchSessionArchive => ({
  type: SEARCH_SESSION_ARCHIVE_TYPE,
  version: SEARCH_SESSION_ARCHIVE_VERSION,
  exportedAt: new Date().toISOString(),
  ...session
});

export const normalizeSearchSessionArchive = (
  value: unknown
): SearchSessionArchive | null => {
  if (!isObject(value)) return null;

  const source =
    value.type === SEARCH_SESSION_ARCHIVE_TYPE || "results" in value
      ? value
      : null;
  if (!source) return null;

  const pois = Array.isArray(source.pois)
    ? source.pois.map(normalizePoi).filter((poi): poi is Poi => Boolean(poi))
    : [];
  const results = Array.isArray(source.results)
    ? source.results
        .map(normalizeStarResult)
        .filter((result): result is StarResult => Boolean(result))
    : [];
  const calculationRecords = Array.isArray(source.calculationRecords)
    ? source.calculationRecords
        .map(normalizeCalculationRecord)
        .filter((record): record is CalculationRecord => Boolean(record))
    : [];
  const center = normalizeLatLng(source.center) ?? results[0]?.center ?? null;

  if (!center) return null;

  const selectedResultIndex = Math.max(
    0,
    Math.min(
      toInteger(source.selectedResultIndex),
      Math.max(0, results.length - 1)
    )
  );
  const settings = isObject(source.settings)
    ? normalizeSettings(source.settings)
    : null;

  return {
    type: SEARCH_SESSION_ARCHIVE_TYPE,
    version: SEARCH_SESSION_ARCHIVE_VERSION,
    exportedAt: toString(source.exportedAt, new Date().toISOString()),
    center,
    centerName: toString(source.centerName, formatCoordinate(center)),
    searchText: toString(source.searchText),
    pois,
    results,
    calculationRecords,
    selectedResultIndex,
    settings
  };
};

export const parseSearchSessionArchive = (content: string) => {
  const parsed = JSON.parse(content);
  const archive = normalizeSearchSessionArchive(parsed);
  if (!archive) {
    throw new Error("Invalid Mapping Star search session archive.");
  }
  return archive;
};

export const loadSearchSession = (): SearchSessionArchive | null => {
  try {
    const raw = window.localStorage.getItem(SEARCH_SESSION_STORAGE_KEY);
    if (!raw) return null;
    return normalizeSearchSessionArchive(JSON.parse(raw));
  } catch {
    return null;
  }
};

export const saveSearchSession = (session: SearchSessionData) => {
  try {
    window.localStorage.setItem(
      SEARCH_SESSION_STORAGE_KEY,
      JSON.stringify(createSearchSessionArchive(session))
    );
  } catch {
    // The last search is a convenience cache; keep the app usable if it is full.
  }
};
