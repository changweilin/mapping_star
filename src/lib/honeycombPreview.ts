import { destinationPoint, normalizeDegrees } from "./geo";
import {
  getHexCellCenterPlanar,
  getHexRing,
  hexKey,
  normalizeHexCellRadius,
  pointToHex,
  toPlanarPoint
} from "./hexGrid";
import type {
  HoneycombSearchProfile,
  HoneycombTargetBand,
  HoneycombTargetNode
} from "./honeycombStrategy";
import type { OverpassBounds } from "./overpass";
import type { LatLng, Poi, StarMode } from "../types";

export const MAX_HONEYCOMB_PREVIEW_CELLS = 240;

export type HoneycombPreviewCell = {
  key: string;
  order: number;
  ring: number;
  center: LatLng;
  targetCenter: LatLng;
  targetLabel: string;
  polygon: LatLng[];
};

export type HoneycombSearchBatch = {
  cells: HoneycombPreviewCell[];
  isInitial: boolean;
  label: string;
};

export type HoneycombPreviewParams = {
  mode: StarMode;
  center: LatLng;
  innerRadiusMeters: number;
  outerRadiusMeters: number;
  targetRadiusMeters: number;
  rotationStepDeg: number;
  hexCellRadiusMeters: number;
  priorityRings: number;
  rotationSpanDeg?: number;
  targetBands: HoneycombTargetBand[];
  targetNodes: HoneycombTargetNode[];
};

export type HoneycombSearchBatchParams = HoneycombPreviewParams & {
  initialCellCount: number;
  cellsPerBatch: number;
};

const makeHoneycombLatLng = (center: LatLng, x: number, y: number) => {
  const distanceMeters = Math.hypot(x, y);
  const bearingDeg = normalizeDegrees((Math.atan2(x, y) * 180) / Math.PI);
  return destinationPoint(center, distanceMeters, bearingDeg);
};

const makeHoneycombPolygon = (center: LatLng, cellRadiusMeters: number) =>
  Array.from({ length: 6 }, (_, index) =>
    destinationPoint(center, cellRadiusMeters, index * 60)
  );

export const makeHoneycombPreviewCells = ({
  mode,
  center,
  innerRadiusMeters,
  outerRadiusMeters,
  targetRadiusMeters,
  rotationStepDeg,
  hexCellRadiusMeters,
  priorityRings,
  rotationSpanDeg: targetRotationSpanDeg,
  targetBands,
  targetNodes
}: HoneycombPreviewParams): HoneycombPreviewCell[] => {
  const activeTargetBands =
    targetBands.length > 0
      ? targetBands
      : [{ id: "perimeter", slots: mode, radius: "target" as const }];
  const activeTargetNodes = targetNodes.filter(
    (node) =>
      Number.isFinite(node.radiusScale) &&
      node.radiusScale > 0 &&
      Number.isFinite(node.bearingDeg)
  );
  const rotationSpanDeg = Math.min(
    360,
    Math.max(
      1,
      activeTargetNodes.length > 0
        ? targetRotationSpanDeg ?? 360 / mode
        : Math.min(
            ...activeTargetBands.map((band) => 360 / Math.max(1, band.slots))
          )
    )
  );
  const step = Math.max(1, Math.min(rotationSpanDeg, rotationStepDeg));
  const cellRadiusMeters = normalizeHexCellRadius(
    outerRadiusMeters,
    hexCellRadiusMeters
  );
  const rotations: number[] = [];
  const seen = new Set<string>();
  const cells: HoneycombPreviewCell[] = [];

  for (let rotationDeg = 0; rotationDeg < rotationSpanDeg; rotationDeg += step) {
    rotations.push(rotationDeg);
  }

  const makeTargetsForRotation = (rotationDeg: number) => {
    if (activeTargetNodes.length > 0) {
      return activeTargetNodes.map((node, index) => {
        const targetBearing = normalizeDegrees(rotationDeg + node.bearingDeg);
        const targetDistanceMeters = Math.max(
          1,
          targetRadiusMeters * node.radiusScale
        );
        return {
          id: node.id,
          label: node.label || `目標節點 ${index + 1}`,
          point: toPlanarPoint(targetDistanceMeters, targetBearing)
        };
      });
    }

    return activeTargetBands.flatMap((band) => {
      const bandSlots = Math.max(1, band.slots);
      const slotWidth = 360 / bandSlots;
      const bandRadiusMeters =
        band.radius === "target"
          ? targetRadiusMeters
          : Math.max(1, outerRadiusMeters * band.radius);

      return Array.from({ length: bandSlots }, (_, slotIndex) => {
        const targetBearing = normalizeDegrees(
          rotationDeg + (band.phaseOffsetDeg ?? 0) + slotWidth * slotIndex
        );
        return {
          id: `${band.id}-${slotIndex + 1}`,
          label: `${band.id} ${slotIndex + 1}`,
          point: toPlanarPoint(bandRadiusMeters, targetBearing)
        };
      });
    });
  };

  const addCellsForRotation = (
    rotationDeg: number,
    maxRing: number,
    minRing = 0
  ) => {
    for (const target of makeTargetsForRotation(rotationDeg)) {
      const targetCell = pointToHex(target.point, cellRadiusMeters);
      const targetCenter = makeHoneycombLatLng(
        center,
        target.point.x,
        target.point.y
      );

      for (let ring = minRing; ring <= maxRing; ring += 1) {
        for (const cell of getHexRing(targetCell, ring)) {
          const key = hexKey(cell);
          if (seen.has(key)) continue;

          const planarCenter = getHexCellCenterPlanar(cell, cellRadiusMeters);
          const distanceFromCenter = Math.hypot(planarCenter.x, planarCenter.y);
          const overlapsSearchRange =
            distanceFromCenter <= outerRadiusMeters + cellRadiusMeters &&
            distanceFromCenter >=
              Math.max(0, innerRadiusMeters - cellRadiusMeters);
          if (!overlapsSearchRange) continue;

          seen.add(key);
          const cellCenter = makeHoneycombLatLng(
            center,
            planarCenter.x,
            planarCenter.y
          );
          cells.push({
            key,
            order: cells.length + 1,
            ring,
            center: cellCenter,
            targetCenter,
            targetLabel: target.label,
            polygon: makeHoneycombPolygon(cellCenter, cellRadiusMeters)
          });

          if (cells.length >= MAX_HONEYCOMB_PREVIEW_CELLS) return cells;
        }
      }
    }
    return null;
  };

  if (rotations[0] !== undefined && addCellsForRotation(rotations[0], 0)) {
    return cells;
  }

  for (const rotationDeg of rotations.slice(1)) {
    if (addCellsForRotation(rotationDeg, 0)) return cells;
  }

  for (let ring = 1; ring <= priorityRings; ring += 1) {
    for (const rotationDeg of rotations) {
      if (addCellsForRotation(rotationDeg, ring, ring)) return cells;
    }
  }

  return cells;
};

export const makeHoneycombSearchBatches = (
  params: HoneycombSearchBatchParams
): HoneycombSearchBatch[] => {
  const cells = makeHoneycombPreviewCells(params);
  const batches: HoneycombSearchBatch[] = [];
  const firstBatchSize = Math.min(params.initialCellCount, cells.length);

  if (firstBatchSize > 0) {
    batches.push({
      cells: cells.slice(0, firstBatchSize),
      isInitial: true,
      label: `首批 ${firstBatchSize} 個目標蜂巢`
    });
  }

  for (
    let offset = firstBatchSize;
    offset < cells.length;
    offset += params.cellsPerBatch
  ) {
    const batchCells = cells.slice(offset, offset + params.cellsPerBatch);
    batches.push({
      cells: batchCells,
      isInitial: false,
      label: `背景蜂巢 ${offset + 1}-${offset + batchCells.length}`
    });
  }

  return batches;
};

export const makeHoneycombSearchParams = ({
  profile,
  mode,
  center,
  innerRadiusMeters,
  outerRadiusMeters,
  targetRadiusMeters,
  rotationStepDeg,
  hexCellRadiusMeters
}: {
  profile: HoneycombSearchProfile;
  mode: StarMode;
  center: LatLng;
  innerRadiusMeters: number;
  outerRadiusMeters: number;
  targetRadiusMeters: number;
  rotationStepDeg: number;
  hexCellRadiusMeters: number;
}): HoneycombSearchBatchParams => ({
  mode,
  center,
  innerRadiusMeters,
  outerRadiusMeters,
  targetRadiusMeters,
  rotationStepDeg,
  hexCellRadiusMeters,
  priorityRings: profile.priorityRings,
  rotationSpanDeg: profile.rotationSpanDeg,
  targetBands: profile.targetBands,
  targetNodes: profile.targetNodes,
  initialCellCount: profile.initialCellCount,
  cellsPerBatch: profile.cellsPerBatch
});

const getBoundsForPoints = (points: LatLng[]): OverpassBounds => {
  const lats = points.map((point) => point.lat);
  const lngs = points.map((point) => point.lng);
  return {
    south: Math.min(...lats),
    west: Math.min(...lngs),
    north: Math.max(...lats),
    east: Math.max(...lngs)
  };
};

export const getHoneycombCellBounds = (cell: HoneycombPreviewCell) =>
  getBoundsForPoints(cell.polygon);

export const filterPoisByHoneycombCells = (
  pois: Poi[],
  cellKeys: Set<string>,
  cellRadiusMeters: number
) =>
  pois.filter((poi) => {
    const point = toPlanarPoint(poi.distanceMeters, poi.bearingDeg);
    return cellKeys.has(hexKey(pointToHex(point, cellRadiusMeters)));
  });
