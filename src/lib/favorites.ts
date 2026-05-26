import type { FavoriteItem, Poi, StarResult } from "../types";
import { starModeLabel } from "./starPatterns";

export const FAVORITES_STORAGE_KEY = "mapping-star:favorites";

export const loadFavorites = (): FavoriteItem[] => {
  try {
    const raw = window.localStorage.getItem(FAVORITES_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

export const saveFavorites = (favorites: FavoriteItem[]) => {
  try {
    window.localStorage.setItem(
      FAVORITES_STORAGE_KEY,
      JSON.stringify(favorites)
    );
  } catch {
    // Favorites still work for the current session if persistence is unavailable.
  }
};

export const makePoiFavorite = (poi: Poi): FavoriteItem => ({
  id: `poi-${poi.id}`,
  type: "poi",
  name: poi.name,
  createdAt: new Date().toISOString(),
  poi
});

export const makeStarFavorite = (
  star: StarResult,
  name = `${starModeLabel(star.mode)} ${new Date().toLocaleString(
    "zh-TW"
  )}`
): FavoriteItem => ({
  id: `star-${star.id}`,
  type: "star",
  name,
  createdAt: new Date().toISOString(),
  star: { ...star, name }
});
