import type { PlaceSearchResult } from "../types";

const coordinatePattern =
  /^\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*$/;

export const parseCoordinateInput = (value: string): PlaceSearchResult | null => {
  const match = value.match(coordinatePattern);
  if (!match) return null;

  const lat = Number(match[1]);
  const lng = Number(match[2]);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;

  return {
    center: { lat, lng },
    label: `${lat.toFixed(6)}, ${lng.toFixed(6)}`
  };
};

export const searchPlace = async (value: string): Promise<PlaceSearchResult> => {
  const trimmed = value.trim();
  if (!trimmed) throw new Error("請輸入地標、地址或座標。");

  const coordinate = parseCoordinateInput(trimmed);
  if (coordinate) return coordinate;

  const params = new URLSearchParams({
    format: "jsonv2",
    limit: "1",
    q: trimmed,
    "accept-language": "zh-TW,zh,en"
  });
  const response = await fetch(
    `https://nominatim.openstreetmap.org/search?${params.toString()}`
  );

  if (!response.ok) {
    throw new Error(`地點搜尋失敗：HTTP ${response.status}`);
  }

  const results = (await response.json()) as Array<{
    lat: string;
    lon: string;
    display_name?: string;
    name?: string;
  }>;
  const first = results[0];
  if (!first) throw new Error("找不到這個地點，請換個名稱或輸入座標。");

  return {
    center: {
      lat: Number(first.lat),
      lng: Number(first.lon)
    },
    label: first.name || first.display_name || trimmed
  };
};
