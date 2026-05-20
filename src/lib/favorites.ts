import type { FavoriteItem, Poi, StarResult } from "../types";

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
  window.localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(favorites));
};

export const makePoiFavorite = (poi: Poi): FavoriteItem => ({
  id: `poi-${poi.id}`,
  type: "poi",
  name: poi.name,
  createdAt: new Date().toISOString(),
  poi
});

export const makeStarFavorite = (star: StarResult): FavoriteItem => ({
  id: `star-${star.id}`,
  type: "star",
  name: `${star.mode === 5 ? "五芒星" : "六芒星"} ${new Date().toLocaleString(
    "zh-TW"
  )}`,
  createdAt: new Date().toISOString(),
  star
});
