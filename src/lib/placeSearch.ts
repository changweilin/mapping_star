import type { PlaceSearchResult } from "../types";

const PLACE_SEARCH_RESULT_LIMIT = 20;
const PLACE_SEARCH_TIMEOUT_MS = 12000;
const coordinatePattern =
  /^\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*$/;

type NominatimSearchResult = {
  place_id?: number;
  osm_type?: string;
  osm_id?: number;
  lat: string;
  lon: string;
  display_name?: string;
  name?: string;
};

export interface SearchPlacesOptions {
  signal?: AbortSignal;
  timeoutMs?: number;
}

const makeAbortError = () => {
  const error = new Error("地點搜尋已取消。");
  error.name = "AbortError";
  return error;
};

const throwIfAborted = (signal?: AbortSignal) => {
  if (signal?.aborted) throw makeAbortError();
};

export const parseCoordinateInput = (value: string): PlaceSearchResult | null => {
  const match = value.match(coordinatePattern);
  if (!match) return null;

  const lat = Number(match[1]);
  const lng = Number(match[2]);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;

  return {
    id: `coordinate:${lat.toFixed(6)},${lng.toFixed(6)}`,
    center: { lat, lng },
    label: `${lat.toFixed(6)}, ${lng.toFixed(6)}`
  };
};

const getPlaceLabel = (result: NominatimSearchResult, fallback: string) => {
  const name = result.name?.trim();
  if (name) return name;

  const displayName = result.display_name?.trim();
  if (!displayName) return fallback;

  return displayName.split(",")[0]?.trim() || displayName;
};

const getPlaceId = (result: NominatimSearchResult, index: number) => {
  if (result.place_id !== undefined) return `place:${result.place_id}`;
  if (result.osm_type && result.osm_id !== undefined) {
    return `osm:${result.osm_type}:${result.osm_id}`;
  }
  return `place:${index}:${result.lat},${result.lon}`;
};

const makePlaceCandidate = (
  result: NominatimSearchResult,
  fallback: string,
  index: number
): PlaceSearchResult | null => {
  const lat = Number(result.lat);
  const lng = Number(result.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

  const label = getPlaceLabel(result, fallback);
  const displayName = result.display_name?.trim();

  return {
    id: getPlaceId(result, index),
    center: { lat, lng },
    label,
    detail: displayName && displayName !== label ? displayName : undefined
  };
};

const fetchPlaceSearch = async (
  url: string,
  { signal, timeoutMs = PLACE_SEARCH_TIMEOUT_MS }: SearchPlacesOptions = {}
) => {
  throwIfAborted(signal);

  const controller = new AbortController();
  let didTimeout = false;
  const abort = () => controller.abort();
  const timeoutId = setTimeout(() => {
    didTimeout = true;
    controller.abort();
  }, Math.max(1, timeoutMs));

  signal?.addEventListener("abort", abort, { once: true });

  try {
    return await fetch(url, { signal: controller.signal });
  } catch (error) {
    if (didTimeout) {
      throw new Error("地點搜尋逾時，請稍後重試。");
    }
    if (signal?.aborted || (error instanceof Error && error.name === "AbortError")) {
      throw makeAbortError();
    }
    throw error;
  } finally {
    signal?.removeEventListener("abort", abort);
    clearTimeout(timeoutId);
  }
};

export const searchPlaces = async (
  value: string,
  options: SearchPlacesOptions = {}
): Promise<PlaceSearchResult[]> => {
  const trimmed = value.trim();
  if (!trimmed) throw new Error("請輸入地標、地址或座標。");
  throwIfAborted(options.signal);

  const coordinate = parseCoordinateInput(trimmed);
  if (coordinate) return [coordinate];

  const params = new URLSearchParams({
    format: "jsonv2",
    limit: String(PLACE_SEARCH_RESULT_LIMIT),
    q: trimmed,
    "accept-language": "zh-TW,zh,en"
  });
  const response = await fetchPlaceSearch(
    `https://nominatim.openstreetmap.org/search?${params.toString()}`,
    options
  );

  if (!response.ok) {
    throw new Error(`地點搜尋失敗：HTTP ${response.status}`);
  }

  const results = (await response.json()) as NominatimSearchResult[];
  const candidates = results
    .map((result, index) => makePlaceCandidate(result, trimmed, index))
    .filter((result): result is PlaceSearchResult => result !== null);
  if (candidates.length === 0) {
    throw new Error("找不到這個地點，請換個名稱或輸入座標。");
  }

  return candidates;
};
