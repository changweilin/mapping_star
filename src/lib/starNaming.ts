import type { FavoriteItem, LatLng, Poi, StarMode, StarResult } from "../types";
import { haversineDistanceMeters } from "./geo";

export const starModeLabel = (mode: StarMode) =>
  mode === 5 ? "五芒星" : "六芒星";

export const formatStarNameDistance = (meters: number) => {
  const kilometers = Math.max(0, meters / 1000);
  const precision = kilometers >= 10 ? 0 : 1;
  return `${kilometers.toFixed(precision).replace(/\.0$/, "")}km`;
};

const trailingStarNamePattern =
  /\s+\d+(?:\.\d+)?km\s+(?:五芒星|六芒星)$/;

const cleanNamePart = (value: string) =>
  value
    .split(",")[0]
    .replace(trailingStarNamePattern, "")
    .replace(/\s+/g, " ")
    .trim();

const findNearestSelectedPoi = ({
  center,
  outerRadiusMeters,
  pois,
  selectedCategoryIds
}: {
  center: LatLng;
  outerRadiusMeters: number;
  pois: Poi[];
  selectedCategoryIds: string[];
}) => {
  const selectedIds = new Set(selectedCategoryIds);
  if (selectedIds.size === 0) return null;

  return pois
    .filter((poi) => selectedIds.has(poi.categoryId))
    .map((poi) => ({
      poi,
      distanceMeters: haversineDistanceMeters(center, {
        lat: poi.lat,
        lng: poi.lng
      })
    }))
    .filter(({ distanceMeters }) => distanceMeters <= outerRadiusMeters)
    .sort((a, b) => a.distanceMeters - b.distanceMeters)[0]?.poi ?? null;
};

const findNearestFavoriteStarName = ({
  center,
  favorites
}: {
  center: LatLng;
  favorites: FavoriteItem[];
}) =>
  favorites
    .filter(
      (favorite): favorite is Extract<FavoriteItem, { type: "star" }> =>
        favorite.type === "star"
    )
    .map((favorite) => ({
      name: favorite.star.name ?? favorite.name,
      distanceMeters: haversineDistanceMeters(center, favorite.star.center)
    }))
    .sort((a, b) => a.distanceMeters - b.distanceMeters)[0]?.name ?? null;

export const makeAutomaticStarName = ({
  center,
  centerName,
  favorites,
  outerRadiusMeters,
  pois,
  selectedCategoryIds,
  star
}: {
  center: LatLng;
  centerName: string;
  favorites: FavoriteItem[];
  outerRadiusMeters: number;
  pois: Poi[];
  selectedCategoryIds: string[];
  star: StarResult;
}) => {
  const selectedPoi = findNearestSelectedPoi({
    center,
    outerRadiusMeters,
    pois,
    selectedCategoryIds
  });
  const favoriteStarName = selectedPoi
    ? null
    : findNearestFavoriteStarName({ center, favorites });
  const baseName =
    cleanNamePart(selectedPoi?.name ?? favoriteStarName ?? centerName) ||
    "中心點";

  return `${baseName} ${formatStarNameDistance(
    star.radiusMeanMeters
  )} ${starModeLabel(star.mode)}`;
};
