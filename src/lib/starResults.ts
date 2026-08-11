import { normalizeDegrees } from "./geo";
import type { StarResult, StarResultAggregateStats } from "../types";

export type StarResultSortKey =
  | "score"
  | "radius"
  | "angle"
  | "circumference-error"
  | "center-error";
export type StarResultSortDirection = "asc" | "desc";

export const getStarCenterErrorMeters = (result: StarResult) =>
  typeof result.centerErrorMeters === "number" &&
  Number.isFinite(result.centerErrorMeters)
    ? result.centerErrorMeters
    : 0;

const compareNumber = (left: number, right: number) => {
  const delta = left - right;
  return Math.abs(delta) > 0.000001 ? delta : 0;
};

const compareStarResultsByScore = (left: StarResult, right: StarResult) =>
  compareNumber(left.score, right.score) ||
  compareNumber(left.radiusStdMeters, right.radiusStdMeters) ||
  compareNumber(getStarCenterErrorMeters(left), getStarCenterErrorMeters(right)) ||
  left.id.localeCompare(right.id);

export const sortStarResults = (
  results: StarResult[],
  sortKey: StarResultSortKey,
  direction: StarResultSortDirection
) => {
  const sorted = [...results].sort((left, right) => {
    switch (sortKey) {
      case "radius":
        return (
          compareNumber(left.radiusMeanMeters, right.radiusMeanMeters) ||
          compareStarResultsByScore(left, right)
        );
      case "angle":
        return (
          compareNumber(
            normalizeDegrees(left.rotationDeg),
            normalizeDegrees(right.rotationDeg)
          ) || compareStarResultsByScore(left, right)
        );
      case "circumference-error":
        return (
          compareNumber(left.radiusStdMeters, right.radiusStdMeters) ||
          compareStarResultsByScore(left, right)
        );
      case "center-error":
        return (
          compareNumber(
            getStarCenterErrorMeters(left),
            getStarCenterErrorMeters(right)
          ) || compareStarResultsByScore(left, right)
        );
      case "score":
      default:
        return compareStarResultsByScore(left, right);
    }
  });
  return direction === "asc" ? sorted : sorted.reverse();
};

const averageStarResultValue = (
  results: StarResult[],
  getValue: (result: StarResult) => number
) =>
  results.length === 0
    ? 0
    : results.reduce((total, result) => total + getValue(result), 0) /
      results.length;

export const getStarResultAggregateStats = (
  results: StarResult[]
): StarResultAggregateStats | null => {
  if (results.length === 0) return null;

  return {
    count: results.length,
    averageRadiusMeters: averageStarResultValue(
      results,
      (result) => result.radiusMeanMeters
    ),
    averageCircumferenceErrorMeters: averageStarResultValue(
      results,
      (result) => result.radiusStdMeters
    ),
    averageAngleErrorDeg: averageStarResultValue(
      results,
      (result) => result.angleErrorDeg
    ),
    averageCenterErrorMeters: averageStarResultValue(
      results,
      getStarCenterErrorMeters
    ),
    averageScore: averageStarResultValue(results, (result) => result.score)
  };
};
