import type { FavoriteItem, Poi, StarResult } from "../types";
import { normalizeFavoriteItem } from "./archiveValidation";
import { starModeLabel } from "./starPatterns";

export const FAVORITES_STORAGE_KEY = "mapping-star:favorites";
export const FAVORITES_ARCHIVE_TYPE = "mapping-star:favorites";
export const FAVORITES_ARCHIVE_VERSION = 1;

export interface FavoritesArchive {
  type: typeof FAVORITES_ARCHIVE_TYPE;
  version: typeof FAVORITES_ARCHIVE_VERSION;
  exportedAt: string;
  favorites: FavoriteItem[];
}

const normalizeFavoriteItems = (value: unknown) =>
  Array.isArray(value)
    ? value
        .map(normalizeFavoriteItem)
        .filter((favorite): favorite is FavoriteItem => Boolean(favorite))
    : [];

export const createFavoritesArchive = (
  favorites: FavoriteItem[]
): FavoritesArchive => ({
  type: FAVORITES_ARCHIVE_TYPE,
  version: FAVORITES_ARCHIVE_VERSION,
  exportedAt: new Date().toISOString(),
  favorites
});

export const normalizeFavoritesArchive = (
  value: unknown
): FavoritesArchive | null => {
  if (!value || typeof value !== "object") {
    return Array.isArray(value)
      ? createFavoritesArchive(normalizeFavoriteItems(value))
      : null;
  }

  if (Array.isArray(value)) {
    return createFavoritesArchive(normalizeFavoriteItems(value));
  }

  const source = value as Partial<FavoritesArchive>;
  if (
    source.type !== FAVORITES_ARCHIVE_TYPE &&
    !Array.isArray(source.favorites)
  ) {
    return null;
  }

  return {
    type: FAVORITES_ARCHIVE_TYPE,
    version: FAVORITES_ARCHIVE_VERSION,
    exportedAt:
      typeof source.exportedAt === "string"
        ? source.exportedAt
        : new Date().toISOString(),
    favorites: normalizeFavoriteItems(source.favorites)
  };
};

export const parseFavoritesArchive = (content: string) => {
  const parsed = JSON.parse(content);
  const archive = normalizeFavoritesArchive(parsed);
  if (!archive) {
    throw new Error("Invalid Mapping Star favorites archive.");
  }
  return archive;
};

export const loadFavorites = (): FavoriteItem[] => {
  try {
    const raw = window.localStorage.getItem(FAVORITES_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return normalizeFavoriteItems(parsed);
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
