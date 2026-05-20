import type { LatLng, Poi, StarMode, StarResult } from "../types";
import {
  angularDifferenceDegrees,
  bearingDegrees,
  haversineDistanceMeters,
  normalizeDegrees
} from "./geo";

interface SolveOptions {
  mode: StarMode;
  center: LatLng;
  radiusMeters: number;
  maxResults?: number;
  angleToleranceMultiplier?: number;
  angleToleranceDeg?: number;
  candidatesPerSlot?: number;
  rotationStepDeg?: number;
  minDistanceMeters?: number;
}

interface Evaluation {
  score: number;
  radiusMeanMeters: number;
  radiusStdMeters: number;
  angleErrorDeg: number;
}

export const starLineSequences = (mode: StarMode) =>
  mode === 5
    ? [[0, 2, 4, 1, 3, 0]]
    : [
        [0, 2, 4, 0],
        [1, 3, 5, 1]
      ];

const getTargets = (mode: StarMode, rotationDeg: number) =>
  Array.from({ length: mode }, (_, index) =>
    normalizeDegrees(rotationDeg + (360 / mode) * index)
  );

const cartesianUnique = (
  slots: Poi[][],
  onCombination: (points: Poi[]) => void
) => {
  const selected: Poi[] = [];
  const used = new Set<string>();

  const visit = (slotIndex: number) => {
    if (slotIndex === slots.length) {
      onCombination([...selected]);
      return;
    }

    for (const candidate of slots[slotIndex]) {
      if (used.has(candidate.id)) continue;
      used.add(candidate.id);
      selected.push(candidate);
      visit(slotIndex + 1);
      selected.pop();
      used.delete(candidate.id);
    }
  };

  visit(0);
};

const evaluate = (
  points: Poi[],
  targets: number[],
  radiusMeters: number
): Evaluation => {
  const radii = points.map((point) => point.distanceMeters);
  const radiusMeanMeters =
    radii.reduce((total, radius) => total + radius, 0) / radii.length;
  const radiusVariance =
    radii.reduce(
      (total, radius) => total + (radius - radiusMeanMeters) ** 2,
      0
    ) / radii.length;
  const radiusStdMeters = Math.sqrt(radiusVariance);

  const angleErrors = points.map((point, index) =>
    angularDifferenceDegrees(point.bearingDeg, targets[index])
  );
  const angleErrorDeg =
    angleErrors.reduce((total, error) => total + error, 0) /
    angleErrors.length;

  const halfSlot = 180 / points.length;
  const angleScore =
    angleErrors.reduce((total, error) => total + (error / halfSlot) ** 2, 0) /
    angleErrors.length;
  const radialScore =
    radiusMeanMeters > 0 ? Math.min(1.5, radiusStdMeters / radiusMeanMeters) : 1;
  const radiusUsePenalty = Math.max(0, 1 - radiusMeanMeters / radiusMeters);

  return {
    score: angleScore * 0.56 + radialScore * 0.34 + radiusUsePenalty * 0.1,
    radiusMeanMeters,
    radiusStdMeters,
    angleErrorDeg
  };
};

const insertBest = (
  results: StarResult[],
  result: StarResult,
  maxResults: number
) => {
  const signature = result.points
    .map((point) => point.id)
    .sort()
    .join("|");
  const alreadyExists = results.some(
    (existing) =>
      existing.points
        .map((point) => point.id)
        .sort()
        .join("|") === signature
  );
  if (alreadyExists) return;

  results.push(result);
  results.sort((a, b) => a.score - b.score);
  if (results.length > maxResults) results.length = maxResults;
};

export const preparePois = (pois: Poi[], center: LatLng): Poi[] =>
  pois.map((poi) => {
    const position = { lat: poi.lat, lng: poi.lng };
    return {
      ...poi,
      distanceMeters: haversineDistanceMeters(center, position),
      bearingDeg: bearingDegrees(center, position)
    };
  });

export const solveStarFromPois = (
  pois: Poi[],
  {
    mode,
    center,
    radiusMeters,
    maxResults = 5,
    angleToleranceMultiplier = 1,
    angleToleranceDeg,
    candidatesPerSlot,
    rotationStepDeg,
    minDistanceMeters = 30
  }: SolveOptions
): StarResult[] => {
  const prepared = preparePois(pois, center).filter(
    (poi) =>
      poi.distanceMeters > minDistanceMeters &&
      poi.distanceMeters <= radiusMeters
  );

  if (prepared.length < mode) return [];

  const results: StarResult[] = [];
  const slotWidth = 360 / mode;
  const halfSlot = slotWidth / 2;
  const step = Math.max(
    1,
    Math.min(slotWidth, rotationStepDeg ?? (mode === 5 ? 6 : 5))
  );
  const toleranceDeg = Math.max(
    1,
    Math.min(halfSlot, angleToleranceDeg ?? halfSlot * angleToleranceMultiplier)
  );
  const slotCandidateLimit = Math.max(
    1,
    Math.min(16, Math.floor(candidatesPerSlot ?? (mode === 5 ? 5 : 4)))
  );
  const resultPool = Math.max(maxResults * 8, 24);

  for (let rotationDeg = 0; rotationDeg < slotWidth; rotationDeg += step) {
    const targets = getTargets(mode, rotationDeg);
    const slots = targets.map((target) =>
      prepared
        .map((poi) => ({
          poi,
          error: angularDifferenceDegrees(poi.bearingDeg, target)
        }))
        .filter(({ error }) => error <= toleranceDeg)
        .sort((a, b) => {
          const angleDelta = a.error - b.error;
          if (Math.abs(angleDelta) > 0.0001) return angleDelta;
          return b.poi.distanceMeters - a.poi.distanceMeters;
        })
        .slice(0, slotCandidateLimit)
        .map(({ poi }) => poi)
    );

    if (slots.some((slot) => slot.length === 0)) continue;

    cartesianUnique(slots, (points) => {
      const evaluated = evaluate(points, targets, radiusMeters);
      insertBest(
        results,
        {
          id: `star-${mode}-${Date.now()}-${Math.random()
            .toString(36)
            .slice(2)}`,
          mode,
          center,
          points,
          rotationDeg,
          createdAt: new Date().toISOString(),
          ...evaluated
        },
        resultPool
      );
    });
  }

  return results.slice(0, maxResults);
};
