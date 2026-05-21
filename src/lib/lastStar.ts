import type { StarResult } from "../types";

export const LAST_STAR_STORAGE_KEY = "mapping-star:last-star";

const isStoredStar = (value: unknown): value is StarResult => {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<StarResult>;
  return (
    typeof candidate.id === "string" &&
    (candidate.mode === 5 || candidate.mode === 6) &&
    typeof candidate.center?.lat === "number" &&
    typeof candidate.center.lng === "number" &&
    Array.isArray(candidate.points) &&
    candidate.points.length === candidate.mode
  );
};

export const loadLastStar = (): StarResult | null => {
  try {
    const raw = window.localStorage.getItem(LAST_STAR_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return isStoredStar(parsed) ? parsed : null;
  } catch {
    return null;
  }
};

export const saveLastStar = (star: StarResult) => {
  window.localStorage.setItem(LAST_STAR_STORAGE_KEY, JSON.stringify(star));
};
