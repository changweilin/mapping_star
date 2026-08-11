import L from "leaflet";
import { destinationPoint, normalizeDegrees } from "./geo";
import type { MagicSymbolStroke } from "./magicPlayback";
import type { MapLayerId } from "./settings";
import type { LatLng, StarResult } from "../types";

type MapTileLayerConfig = {
  url: string;
  options: L.TileLayerOptions;
};

const MAP_TILE_LAYERS: Record<MapLayerId, MapTileLayerConfig> = {
  street: {
    url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    options: {
      maxZoom: 19,
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
    }
  },
  terrain: {
    url: "https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png",
    options: {
      maxZoom: 19,
      maxNativeZoom: 17,
      attribution:
        'Map data: &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>, SRTM | Map style: &copy; <a href="https://opentopomap.org">OpenTopoMap</a>'
    }
  },
  satellite: {
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    options: {
      maxZoom: 19,
      attribution:
        'Tiles &copy; Esri, Maxar, Earthstar Geographics, and the GIS User Community'
    }
  }
};

export const createBaseTileLayer = (layerId: MapLayerId) => {
  const config = MAP_TILE_LAYERS[layerId];

  return L.tileLayer(config.url, {
    ...config.options,
    className: `map-base-tile map-base-tile--${layerId}`
  });
};

export const makeCenterIcon = () =>
  L.divIcon({
    className: "center-pin",
    html: '<span class="center-pin__ring"></span><span class="center-pin__dot"></span>',
    iconSize: [30, 30],
    iconAnchor: [15, 15]
  });

export const makeMagicSymbolIcon = (stroke: MagicSymbolStroke) =>
  L.divIcon({
    className: "magic-symbol-anchor",
    html: `<span class="${stroke.className}"><span class="magic-symbol__aura"></span><span class="magic-symbol__trail"></span><span class="magic-symbol__glyph"></span></span>`,
    iconSize: [0, 0],
    iconAnchor: [0, 0]
  });

export const makeHoneycombOrderIcon = (order: number, isCompleted = false) =>
  L.divIcon({
    className: `honeycomb-order-marker${
      isCompleted ? " honeycomb-order-marker--completed" : ""
    }`,
    html: `<span class="honeycomb-order-marker__target"></span><span class="honeycomb-order-marker__number">${order}</span>`,
    iconSize: [26, 26],
    iconAnchor: [13, 13]
  });

export const makeStarBounds = (result: StarResult) => {
  const bounds = L.latLngBounds(
    [
      [result.center.lat, result.center.lng],
      ...result.points.map((point) => [point.lat, point.lng])
    ] as L.LatLngExpression[]
  );
  const outerPointRadiusMeters = Math.max(
    result.radiusMeanMeters,
    ...result.points.map((point) => point.distanceMeters)
  );

  [0, 90, 180, 270].forEach((bearing) => {
    const edge = destinationPoint(result.center, outerPointRadiusMeters, bearing);
    bounds.extend([edge.lat, edge.lng]);
  });

  return bounds;
};

export const makeRadiusBounds = (center: LatLng, radiusMeters: number) => {
  const bounds = L.latLngBounds([
    [center.lat, center.lng]
  ] as L.LatLngExpression[]);

  [0, 90, 180, 270].forEach((bearing) => {
    const edge = destinationPoint(center, radiusMeters, bearing);
    bounds.extend([edge.lat, edge.lng]);
  });

  return bounds;
};

export const makeSectorPolygon = (
  center: LatLng,
  innerRadiusMeters: number,
  outerRadiusMeters: number,
  startDeg: number,
  endDeg: number
) => {
  const points: L.LatLngExpression[] = [];
  const span = normalizeDegrees(endDeg - startDeg) || 360;
  const steps = Math.max(8, Math.ceil(span / 6));
  const hasInnerRadius = innerRadiusMeters > 0;

  if (!hasInnerRadius) {
    points.push([center.lat, center.lng]);
  }

  for (let index = 0; index <= steps; index += 1) {
    const bearing = startDeg + (span * index) / steps;
    const point = destinationPoint(center, outerRadiusMeters, bearing);
    points.push([point.lat, point.lng]);
  }

  if (hasInnerRadius) {
    for (let index = steps; index >= 0; index -= 1) {
      const bearing = startDeg + (span * index) / steps;
      const point = destinationPoint(center, innerRadiusMeters, bearing);
      points.push([point.lat, point.lng]);
    }
  } else {
    points.push([center.lat, center.lng]);
  }

  return points;
};
