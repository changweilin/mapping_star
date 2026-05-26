import { describe, expect, it } from "vitest";
import { POI_CATEGORIES } from "../data/categories";
import { destinationPoint } from "../lib/geo";
import {
  solveStarFromPois,
  solveStarFromPoisSteps,
  starLineSequences
} from "../lib/solver";
import type { Poi } from "../types";

const center = { lat: 25.033964, lng: 121.564468 };
const category = POI_CATEGORIES[0];

const makePoi = (
  index: number,
  bearing: number,
  distanceMeters = 10000
): Poi => {
  const point = destinationPoint(center, distanceMeters, bearing);
  return {
    id: `node/${index}`,
    osmType: "node",
    osmId: index,
    name: `Point ${index}`,
    lat: point.lat,
    lng: point.lng,
    categoryId: category.id,
    categoryLabel: category.label,
    categoryColor: category.color,
    tags: {},
    distanceMeters: 0,
    bearingDeg: 0
  };
};

describe("star solver", () => {
  it("uses the expected line sequences", () => {
    expect(starLineSequences(4)).toEqual([
      [0, 2],
      [1, 3]
    ]);
    expect(starLineSequences(5)).toEqual([[0, 2, 4, 1, 3, 0]]);
    expect(starLineSequences(6)).toEqual([
      [0, 2, 4, 0],
      [1, 3, 5, 1]
    ]);
    expect(starLineSequences(8)).toEqual([
      [0, 1, 2, 3, 4, 5, 6, 7, 0],
      [0, 4],
      [1, 5],
      [2, 6],
      [3, 7]
    ]);
  });

  it("finds a five-point star from evenly distributed points", () => {
    const pois = [0, 72, 144, 216, 288].map((bearing, index) =>
      makePoi(index, bearing)
    );

    const results = solveStarFromPois(pois, {
      mode: 5,
      center,
      radiusMeters: 15000
    });

    expect(results).toHaveLength(1);
    expect(results[0].points.map((point) => point.id)).toHaveLength(5);
    expect(new Set(results[0].points.map((point) => point.id)).size).toBe(5);
    expect(results[0].angleErrorDeg).toBeLessThan(1);
    expect(results[0].centerErrorMeters).toBeLessThan(1);
  });

  it("honors one candidate per slot", () => {
    const pois = [0, 72, 144, 216, 288].map((bearing, index) =>
      makePoi(index, bearing)
    );

    const results = solveStarFromPois(pois, {
      mode: 5,
      center,
      radiusMeters: 15000,
      candidatesPerSlot: 1
    });

    expect(results).toHaveLength(1);
    expect(results[0].points).toHaveLength(5);
  });

  it("uses the inner and outer radius average as the honeycomb target", () => {
    const targetRadiusPoint = makePoi(0, 0, 7000);
    const outerRadiusPoint = makePoi(100, 2, 14000);
    const pois = [
      targetRadiusPoint,
      outerRadiusPoint,
      ...[72, 144, 216, 288].map((bearing, index) =>
        makePoi(index + 1, bearing, 7000)
      )
    ];

    const results = solveStarFromPois(pois, {
      mode: 5,
      center,
      radiusMeters: 15000,
      angleToleranceDeg: 6,
      candidatesPerSlot: 1,
      rotationStepDeg: 6
    });

    expect(results).toHaveLength(1);
    expect(results[0].points[0].id).toBe(targetRadiusPoint.id);
  });

  it("reports target honeycomb corners before radial expansion", () => {
    const targetPois = [0, 72, 144, 216, 288].map((bearing, index) =>
      makePoi(index, bearing, 10000)
    );
    const outerPois = [0, 72, 144, 216, 288].map((bearing, index) =>
      makePoi(index + 10, bearing, 14000)
    );

    const iterator = solveStarFromPoisSteps([...outerPois, ...targetPois], {
      mode: 5,
      center,
      radiusMeters: 15000,
      innerRadiusMeters: 5000,
      angleToleranceDeg: 30,
      candidatesPerSlot: 1,
      rotationStepDeg: 72,
      hexCellRadiusMeters: 10000,
      hexPriorityRings: 1
    });
    const firstProgress = iterator.next();

    expect(firstProgress.done).toBe(false);
    if (!firstProgress.done) {
      expect(firstProgress.value.stage).toBe("target-corners");
      expect(firstProgress.value.label).toContain("第 1 到 5 號目標蜂巢");
    }
  });

  it("finishes target-radius rotations before expanding inward and outward", () => {
    const targetPois = [0, 72, 144, 216, 288].map((bearing, index) =>
      makePoi(index, bearing, 10000)
    );
    const outerPois = [0, 72, 144, 216, 288].map((bearing, index) =>
      makePoi(index + 10, bearing, 12000)
    );

    const progress = Array.from(
      solveStarFromPoisSteps([...outerPois, ...targetPois], {
        mode: 5,
        center,
        radiusMeters: 15000,
        innerRadiusMeters: 5000,
        angleToleranceDeg: 30,
        candidatesPerSlot: 1,
        rotationStepDeg: 18,
        hexCellRadiusMeters: 2000,
        hexPriorityRings: 1
      })
    );

    const firstExpansionIndex = progress.findIndex(
      (step) => step.stage === "radius-expansion"
    );
    expect(firstExpansionIndex).toBeGreaterThan(0);
    expect(
      progress
        .slice(0, firstExpansionIndex)
        .every(
          (step) =>
            step.stage === "target-corners" ||
            step.stage === "target-rotation"
        )
    ).toBe(true);
  });

  it("continues radial expansion after target honeycomb cells", () => {
    const targetPois = [0, 72, 144, 216, 288].map((bearing, index) =>
      makePoi(index, bearing, 10000)
    );
    const neighboringPois = [0, 72, 144, 216, 288].map((bearing, index) =>
      makePoi(index + 10, bearing, 14000)
    );

    const progress = Array.from(
      solveStarFromPoisSteps([...neighboringPois, ...targetPois], {
        mode: 5,
        center,
        radiusMeters: 15000,
        innerRadiusMeters: 5000,
        angleToleranceDeg: 30,
        candidatesPerSlot: 1,
        rotationStepDeg: 72,
        hexCellRadiusMeters: 2000,
        hexPriorityRings: 6,
        maxResults: 40
      })
    );

    const targetIds = targetPois.map((point) => point.id);
    const firstResultProgress = progress.find((step) => step.results.length > 0);

    expect(firstResultProgress?.stage).toBe("radius-expansion");
    expect(firstResultProgress?.results[0].points.map((point) => point.id)).toEqual(
      targetIds
    );
  });

  it("can still use the legacy angular strategy", () => {
    const nearCenterPoint = makePoi(0, 0, 7000);
    const cornerPoint = makePoi(100, 2, 14000);
    const pois = [
      nearCenterPoint,
      cornerPoint,
      ...[72, 144, 216, 288].map((bearing, index) =>
        makePoi(index + 1, bearing, 14000)
      )
    ];

    const results = solveStarFromPois(pois, {
      mode: 5,
      center,
      radiusMeters: 15000,
      angleToleranceDeg: 6,
      candidatesPerSlot: 1,
      rotationStepDeg: 6,
      searchStrategy: "angular"
    });

    expect(results).toHaveLength(1);
    expect(results[0].points[0].id).toBe(nearCenterPoint.id);
  });

  it("finds a four-point cross star from cardinal points", () => {
    const pois = [0, 90, 180, 270].map((bearing, index) =>
      makePoi(index, bearing)
    );

    const results = solveStarFromPois(pois, {
      mode: 4,
      center,
      radiusMeters: 15000,
      rotationStepDeg: 5
    });

    expect(results).toHaveLength(1);
    expect(results[0].points).toHaveLength(4);
    expect(results[0].angleErrorDeg).toBeLessThan(1);
  });

  it("finds an eight-point bagua pattern from evenly distributed points", () => {
    const pois = [0, 45, 90, 135, 180, 225, 270, 315].map((bearing, index) =>
      makePoi(index, bearing)
    );

    const results = solveStarFromPois(pois, {
      mode: 8,
      center,
      radiusMeters: 15000,
      rotationStepDeg: 4,
      candidatesPerSlot: 1
    });

    expect(results).toHaveLength(1);
    expect(results[0].points).toHaveLength(8);
    expect(results[0].angleErrorDeg).toBeLessThan(1);
  });

  it("excludes points inside the inner radius", () => {
    const innerPois = [0, 72, 144, 216, 288].map((bearing, index) =>
      makePoi(index, bearing, 5000)
    );
    const ringPois = [0, 72, 144, 216, 288].map((bearing, index) =>
      makePoi(index + 10, bearing, 10000)
    );

    const results = solveStarFromPois([...innerPois, ...ringPois], {
      mode: 5,
      center,
      innerRadiusMeters: 8000,
      radiusMeters: 15000
    });

    expect(results).toHaveLength(1);
    expect(results[0].points.every((point) => point.osmId >= 10)).toBe(true);
  });

  it("does not let five-point angle tolerance overlap neighboring slots", () => {
    const pois = [0, 6, 60, 132, 204].map((bearing, index) =>
      makePoi(index, bearing)
    );

    expect(
      solveStarFromPois(pois, {
        mode: 5,
        center,
        radiusMeters: 15000
      })
    ).toHaveLength(0);

    const results = solveStarFromPois(pois, {
      mode: 5,
      center,
      radiusMeters: 15000,
      angleToleranceDeg: 45
    });

    expect(results).toHaveLength(0);
  });
});
