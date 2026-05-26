export interface LatLng {
  lat: number;
  lng: number;
}

export interface PoiCategory {
  id: string;
  group: string;
  label: string;
  description: string;
  color: string;
  broad?: boolean;
  overpassFilters: string[];
  matches: (tags: Record<string, string>) => boolean;
}

export interface Poi {
  id: string;
  osmType: "node" | "way" | "relation";
  osmId: number;
  name: string;
  lat: number;
  lng: number;
  categoryId: string;
  categoryLabel: string;
  categoryColor: string;
  tags: Record<string, string>;
  distanceMeters: number;
  bearingDeg: number;
}

export type StarMode = 4 | 5 | 6 | 7 | 8;
export type SearchStrategy = "angular" | "honeycomb";

export interface StarResult {
  id: string;
  name?: string;
  mode: StarMode;
  center: LatLng;
  points: Poi[];
  score: number;
  rotationDeg: number;
  radiusMeanMeters: number;
  radiusStdMeters: number;
  angleErrorDeg: number;
  centerErrorMeters: number;
  createdAt: string;
}

export interface StarResultAggregateStats {
  count: number;
  averageRadiusMeters: number;
  averageCircumferenceErrorMeters: number;
  averageAngleErrorDeg: number;
  averageCenterErrorMeters: number;
  averageScore: number;
}

export interface FavoritePoi {
  id: string;
  type: "poi";
  name: string;
  createdAt: string;
  poi: Poi;
}

export interface FavoriteStar {
  id: string;
  type: "star";
  name: string;
  createdAt: string;
  star: StarResult;
}

export type FavoriteItem = FavoritePoi | FavoriteStar;

export interface PlaceSearchResult {
  id: string;
  center: LatLng;
  label: string;
  detail?: string;
}
