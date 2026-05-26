import { MapPin, Star } from "lucide-react";
import { formatDistance } from "../lib/geo";
import type { Poi } from "../types";

type SelectedPoiDetailProps = {
  poi: Poi;
  isFavorite: boolean;
  disabled: boolean;
  onAddFavorite: (poi: Poi) => void;
};

export const SelectedPoiDetail = ({
  poi,
  isFavorite,
  disabled,
  onAddFavorite
}: SelectedPoiDetailProps) => (
  <div className="poi-detail selected-poi-detail">
    <div className="subsection-title">
      <MapPin aria-hidden="true" />
      <strong>選取地點</strong>
    </div>
    <strong>{poi.name}</strong>
    <span>{poi.categoryLabel}</span>
    <span>
      {formatDistance(poi.distanceMeters)} / {Math.round(poi.bearingDeg)}°
    </span>
    <a
      href={`https://www.openstreetmap.org/${poi.osmType}/${poi.osmId}`}
      target="_blank"
      rel="noreferrer"
    >
      OpenStreetMap
    </a>
    <button
      className="secondary-button"
      type="button"
      onClick={() => onAddFavorite(poi)}
      disabled={disabled || isFavorite}
    >
      <Star size={17} />
      {isFavorite ? "已收藏" : "加入我的最愛"}
    </button>
  </div>
);
