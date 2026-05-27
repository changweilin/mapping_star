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
export type MagicPlaybackMode = "single" | "continuous" | "loop-all" | "loop-one";
export type MagicPlayback = "playing" | "paused" | "ended";
export type MagicPlaybackDirection = "forward" | "reverse";
export type MagicDrawShape =
  | "star"
  | "cross"
  | "bagua"
  | "rose"
  | "sierpinski"
  | "zodiac";

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

export interface DrawSummary {
  id: string;
  sourceLabel: string;
  startedAtIso: string;
  finishedAtIso: string;
  firstResultAtIso: string | null;
  firstResultElapsedMs: number | null;
  firstResultSourceLabel: string | null;
  totalElapsedMs: number;
  searchElapsedMs: number | null;
  solveElapsedMs: number;
  previewSolveCount: number;
  previewSolveElapsedMs: number;
  renderElapsedMs: number;
  estimatedAnimationMs: number | null;
  resultCount: number;
  resultLimit: number;
  eligiblePoiCount: number;
  totalPoiCount: number;
  fetchedPoiCount: number | null;
  addedPoiCount: number | null;
  warningCount: number;
  categoryCount: number | null;
  mode: StarMode;
  centerLabel: string;
  centerCoordinate: string;
  radiusRangeLabel: string;
  searchStrategy: SearchStrategy;
  angleToleranceDeg: number;
  candidatesPerSlot: number;
  rotationStepDeg: number;
  hexCellRadiusKm: number;
  animationLabel: string;
  magicSpeed: number;
  notes: string[];
}

export interface CalculationRecord {
  id: string;
  status: "completed" | "empty" | "cancelled" | "failed";
  sourceLabel: string;
  title: string;
  message: string;
  startedAtIso: string;
  finishedAtIso: string;
  totalElapsedMs: number;
  summary: DrawSummary | null;
}
