import type {
  CalculationRecord,
  DrawSummary,
  FavoriteItem,
  LatLng,
  Poi,
  SearchStrategy,
  StarResult
} from "../types";
import { isStarMode } from "./starPatterns";

const isObject = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const toFiniteNumber = (value: unknown) => {
  const numberValue = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numberValue) ? numberValue : null;
};

const toNumber = (value: unknown, fallback = 0) =>
  toFiniteNumber(value) ?? fallback;

const toNullableNumber = (value: unknown) =>
  value === null || value === undefined ? null : toFiniteNumber(value);

const toString = (value: unknown, fallback = "") =>
  typeof value === "string" ? value : fallback;

const toStringArray = (value: unknown) =>
  Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];

const normalizeStringRecord = (value: unknown): Record<string, string> => {
  if (!isObject(value)) return {};

  return Object.fromEntries(
    Object.entries(value).filter(
      (entry): entry is [string, string] => typeof entry[1] === "string"
    )
  );
};

export const normalizeLatLng = (value: unknown): LatLng | null => {
  if (!isObject(value)) return null;

  const lat = toFiniteNumber(value.lat);
  const lng = toFiniteNumber(value.lng);
  if (
    lat === null ||
    lng === null ||
    lat < -90 ||
    lat > 90 ||
    lng < -180 ||
    lng > 180
  ) {
    return null;
  }

  return { lat, lng };
};

export const normalizePoi = (value: unknown): Poi | null => {
  if (!isObject(value)) return null;

  const id = toString(value.id);
  const osmType = value.osmType;
  const osmId = toFiniteNumber(value.osmId);
  const latLng = normalizeLatLng(value);
  const distanceMeters = toFiniteNumber(value.distanceMeters);
  const bearingDeg = toFiniteNumber(value.bearingDeg);

  if (
    !id ||
    (osmType !== "node" && osmType !== "way" && osmType !== "relation") ||
    osmId === null ||
    latLng === null ||
    distanceMeters === null ||
    bearingDeg === null
  ) {
    return null;
  }

  return {
    id,
    osmType,
    osmId,
    name: toString(value.name, id),
    lat: latLng.lat,
    lng: latLng.lng,
    categoryId: toString(value.categoryId),
    categoryLabel: toString(value.categoryLabel),
    categoryColor: toString(value.categoryColor, "#44546a"),
    tags: normalizeStringRecord(value.tags),
    distanceMeters,
    bearingDeg
  };
};

export const normalizeStarResult = (value: unknown): StarResult | null => {
  if (!isObject(value)) return null;

  const id = toString(value.id);
  const modeValue = toFiniteNumber(value.mode);
  const center = normalizeLatLng(value.center);
  const points = Array.isArray(value.points)
    ? value.points.map(normalizePoi).filter((poi): poi is Poi => Boolean(poi))
    : [];

  if (!id || !isStarMode(modeValue) || center === null || points.length === 0) {
    return null;
  }

  const result: StarResult = {
    id,
    mode: modeValue,
    center,
    points,
    score: toNumber(value.score),
    rotationDeg: toNumber(value.rotationDeg),
    radiusMeanMeters: toNumber(value.radiusMeanMeters),
    radiusStdMeters: toNumber(value.radiusStdMeters),
    angleErrorDeg: toNumber(value.angleErrorDeg),
    centerErrorMeters: toNumber(value.centerErrorMeters),
    createdAt: toString(value.createdAt, new Date(0).toISOString())
  };

  if (typeof value.name === "string") {
    result.name = value.name;
  }

  return result;
};

const parseSearchStrategy = (value: unknown): SearchStrategy =>
  value === "angular" || value === "honeycomb" ? value : "honeycomb";

export const normalizeDrawSummary = (value: unknown): DrawSummary | null => {
  if (!isObject(value)) return null;

  const id = toString(value.id);
  const modeValue = toFiniteNumber(value.mode);
  if (!id || !isStarMode(modeValue)) return null;

  return {
    id,
    sourceLabel: toString(value.sourceLabel),
    startedAtIso: toString(value.startedAtIso),
    finishedAtIso: toString(value.finishedAtIso),
    firstResultAtIso: toString(value.firstResultAtIso) || null,
    firstResultElapsedMs: toNullableNumber(value.firstResultElapsedMs),
    firstResultSourceLabel: toString(value.firstResultSourceLabel) || null,
    totalElapsedMs: toNumber(value.totalElapsedMs),
    searchElapsedMs: toNullableNumber(value.searchElapsedMs),
    solveElapsedMs: toNumber(value.solveElapsedMs),
    previewSolveCount: toNumber(value.previewSolveCount),
    previewSolveElapsedMs: toNumber(value.previewSolveElapsedMs),
    renderElapsedMs: toNumber(value.renderElapsedMs),
    estimatedAnimationMs: toNullableNumber(value.estimatedAnimationMs),
    resultCount: toNumber(value.resultCount),
    resultLimit: toNumber(value.resultLimit),
    eligiblePoiCount: toNumber(value.eligiblePoiCount),
    totalPoiCount: toNumber(value.totalPoiCount),
    fetchedPoiCount: toNullableNumber(value.fetchedPoiCount),
    addedPoiCount: toNullableNumber(value.addedPoiCount),
    warningCount: toNumber(value.warningCount),
    categoryCount: toNullableNumber(value.categoryCount),
    mode: modeValue,
    centerLabel: toString(value.centerLabel),
    centerCoordinate: toString(value.centerCoordinate),
    radiusRangeLabel: toString(value.radiusRangeLabel),
    searchStrategy: parseSearchStrategy(value.searchStrategy),
    angleToleranceDeg: toNumber(value.angleToleranceDeg),
    candidatesPerSlot: toNumber(value.candidatesPerSlot),
    rotationStepDeg: toNumber(value.rotationStepDeg),
    hexCellRadiusKm: toNumber(value.hexCellRadiusKm),
    animationLabel: toString(value.animationLabel),
    magicSpeed: toNumber(value.magicSpeed, 1),
    notes: toStringArray(value.notes)
  };
};

export const normalizeCalculationRecord = (
  value: unknown
): CalculationRecord | null => {
  if (!isObject(value)) return null;

  const id = toString(value.id);
  const status = value.status;
  if (
    !id ||
    (status !== "completed" &&
      status !== "empty" &&
      status !== "cancelled" &&
      status !== "failed")
  ) {
    return null;
  }

  return {
    id,
    status,
    sourceLabel: toString(value.sourceLabel),
    title: toString(value.title),
    message: toString(value.message),
    startedAtIso: toString(value.startedAtIso),
    finishedAtIso: toString(value.finishedAtIso),
    totalElapsedMs: toNumber(value.totalElapsedMs),
    summary: normalizeDrawSummary(value.summary)
  };
};

export const normalizeFavoriteItem = (value: unknown): FavoriteItem | null => {
  if (!isObject(value)) return null;

  const id = toString(value.id);
  const name = toString(value.name, id);
  const createdAt = toString(value.createdAt, new Date(0).toISOString());
  if (!id || !name) return null;

  if (value.type === "poi") {
    const poi = normalizePoi(value.poi);
    return poi ? { id, type: "poi", name, createdAt, poi } : null;
  }

  if (value.type === "star") {
    const star = normalizeStarResult(value.star);
    return star ? { id, type: "star", name, createdAt, star } : null;
  }

  return null;
};
