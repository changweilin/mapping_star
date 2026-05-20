import { POI_CATEGORIES } from "../data/categories";
import type { LatLng, Poi, PoiCategory } from "../types";
import { bearingDegrees, haversineDistanceMeters } from "./geo";

const OVERPASS_ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.private.coffee/api/interpreter"
];
const MAX_OVERPASS_RESULTS = 1400;
const OVERPASS_REQUEST_TIMEOUT_MS = 45000;
const CATEGORY_QUERY_PAUSE_MS = 150;
const TRANSIENT_OVERPASS_STATUS = new Set([408, 429, 500, 502, 503, 504]);

interface OverpassElement {
  type: "node" | "way" | "relation";
  id: number;
  lat?: number;
  lon?: number;
  center?: {
    lat: number;
    lon: number;
  };
  tags?: Record<string, string>;
}

interface OverpassResponse {
  elements: OverpassElement[];
}

export interface FetchPoisResult {
  pois: Poi[];
  warnings: string[];
}

class OverpassHttpError extends Error {
  constructor(
    readonly endpoint: string,
    readonly status: number
  ) {
    super(`HTTP ${status}`);
  }
}

class OverpassQueryError extends Error {
  constructor(readonly failures: string[]) {
    super(
      `Overpass 查詢暫時失敗（${failures.join(
        "；"
      )}）。請稍後重試，或縮小半徑、減少類別。`
    );
  }
}

const getName = (tags: Record<string, string>, fallback: string) =>
  tags["name:zh"] ||
  tags["name:zh-Hant"] ||
  tags.name ||
  tags["name:en"] ||
  tags.brand ||
  fallback;

export const categoryForTags = (
  tags: Record<string, string>,
  categories: PoiCategory[] = POI_CATEGORIES
) => categories.find((category) => category.matches(tags));

export const buildOverpassQuery = (
  center: LatLng,
  radiusMeters: number,
  categories: PoiCategory[]
) => {
  const radius = Math.round(radiusMeters);
  const lat = center.lat.toFixed(6);
  const lng = center.lng.toFixed(6);
  const statements = categories.flatMap((category) =>
    category.overpassFilters.flatMap((filter) =>
      (["node", "way", "relation"] as const).map(
        (type) => `${type}(around:${radius},${lat},${lng})${filter};`
      )
    )
  );

  return `[out:json][timeout:35];
(
${statements.map((statement) => `  ${statement}`).join("\n")}
);
out center ${MAX_OVERPASS_RESULTS};`;
};

export const parseOverpassElements = (
  elements: OverpassElement[],
  center: LatLng,
  categories: PoiCategory[]
): Poi[] => {
  const seen = new Set<string>();
  const pois: Poi[] = [];

  for (const element of elements) {
    const lat = element.lat ?? element.center?.lat;
    const lng = element.lon ?? element.center?.lon;
    const tags = element.tags ?? {};
    if (typeof lat !== "number" || typeof lng !== "number") continue;

    const category = categoryForTags(tags, categories);
    if (!category) continue;

    const id = `${element.type}/${element.id}`;
    if (seen.has(id)) continue;
    seen.add(id);

    const position = { lat, lng };
    pois.push({
      id,
      osmType: element.type,
      osmId: element.id,
      name: getName(tags, `${category.label} ${element.id}`),
      lat,
      lng,
      categoryId: category.id,
      categoryLabel: category.label,
      categoryColor: category.color,
      tags,
      distanceMeters: haversineDistanceMeters(center, position),
      bearingDeg: bearingDegrees(center, position)
    });
  }

  return pois.sort((a, b) => a.distanceMeters - b.distanceMeters);
};

const sleep = (ms: number) =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

const fetchOverpassFromEndpoint = async (endpoint: string, query: string) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(
    () => controller.abort(),
    OVERPASS_REQUEST_TIMEOUT_MS
  );

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8"
      },
      body: new URLSearchParams({ data: query }),
      signal: controller.signal
    });

    if (!response.ok) {
      throw new OverpassHttpError(endpoint, response.status);
    }

    return (await response.json()) as OverpassResponse;
  } finally {
    clearTimeout(timeoutId);
  }
};

const isRetryableOverpassError = (error: unknown) => {
  if (error instanceof OverpassHttpError) {
    return TRANSIENT_OVERPASS_STATUS.has(error.status);
  }

  return error instanceof Error
    ? error.name === "AbortError" || error instanceof TypeError
    : false;
};

const formatEndpoint = (endpoint: string) => {
  try {
    return new URL(endpoint).hostname;
  } catch {
    return endpoint;
  }
};

const formatOverpassError = (error: unknown) => {
  if (error instanceof OverpassHttpError) {
    return `${formatEndpoint(error.endpoint)} HTTP ${error.status}`;
  }

  if (error instanceof Error && error.name === "AbortError") {
    return "請求逾時";
  }

  return error instanceof Error ? error.message : "未知錯誤";
};

const fetchOverpassElements = async (query: string) => {
  const failures: string[] = [];

  for (const endpoint of OVERPASS_ENDPOINTS) {
    try {
      const data = await fetchOverpassFromEndpoint(endpoint, query);
      return data.elements ?? [];
    } catch (error) {
      failures.push(formatOverpassError(error));

      if (!isRetryableOverpassError(error)) {
        break;
      }
    }
  }

  throw new OverpassQueryError(failures);
};

const formatCategoryFailure = (category: PoiCategory, error: unknown) => {
  const details =
    error instanceof OverpassQueryError
      ? error.failures.join("、")
      : error instanceof Error
        ? error.message
        : "未知錯誤";

  return `${category.label}：${details}`;
};

export const fetchPoisDetailed = async (
  center: LatLng,
  radiusMeters: number,
  categories: PoiCategory[]
): Promise<FetchPoisResult> => {
  if (categories.length === 0) {
    throw new Error("請至少選擇一種目標類別。");
  }

  const elements: OverpassElement[] = [];
  const failures: string[] = [];

  for (const category of categories) {
    const query = buildOverpassQuery(center, radiusMeters, [category]);
    try {
      elements.push(...(await fetchOverpassElements(query)));
    } catch (error) {
      failures.push(formatCategoryFailure(category, error));
    }

    if (categories.length > 1) {
      await sleep(CATEGORY_QUERY_PAUSE_MS);
    }
  }

  if (failures.length === categories.length) {
    throw new Error(
      `Overpass 查詢暫時失敗（${failures.join(
        "；"
      )}）。請稍後重試，或縮小半徑、減少類別。`
    );
  }

  const warnings =
    failures.length > 0
      ? [
          `部分類別查詢失敗，已使用成功取得的資料繼續：${failures.join(
            "；"
          )}。`
        ]
      : [];

  return {
    pois: parseOverpassElements(elements, center, categories),
    warnings
  };
};

export const fetchPois = async (
  center: LatLng,
  radiusMeters: number,
  categories: PoiCategory[]
) => (await fetchPoisDetailed(center, radiusMeters, categories)).pois;

export const overpassResultLimit = MAX_OVERPASS_RESULTS;
