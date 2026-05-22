import { describe, expect, it } from "vitest";
import { POI_CATEGORIES } from "../data/categories";
import { destinationPoint } from "../lib/geo";
import { solveStarFromPois, starLineSequences } from "../lib/solver";
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
    expect(starLineSequences(5)).toEqual([[0, 2, 4, 1, 3, 0]]);
    expect(starLineSequences(6)).toEqual([
      [0, 2, 4, 0],
      [1, 3, 5, 1]
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

  it("uses honeycomb corner priority by default", () => {
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
      rotationStepDeg: 6
    });

    expect(results).toHaveLength(1);
    expect(results[0].points[0].id).toBe(cornerPoint.id);
  });

  it("tries a complete honeycomb ring before widening to neighboring matches", () => {
    const honeycombPois = [0, 72, 144, 216, 288].map((bearing, index) =>
      makePoi(index, bearing, index % 2 === 0 ? 11000 : 14900)
    );
    const neighboringPois = [0, 72, 144, 216, 288].map((bearing, index) =>
      makePoi(index + 10, bearing, 6000)
    );

    const results = solveStarFromPois([...neighboringPois, ...honeycombPois], {
      mode: 5,
      center,
      radiusMeters: 15000,
      angleToleranceDeg: 30,
      candidatesPerSlot: 2,
      rotationStepDeg: 72,
      hexCellRadiusMeters: 10000,
      hexPriorityRings: 0
    });

    expect(results.length).toBeGreaterThan(0);
    expect(results[0].points.map((point) => point.id)).toEqual(
      honeycombPois.map((point) => point.id)
    );
  });

  it("continues searching neighboring honeycomb rings after the first result", () => {
    const honeycombPois = [0, 72, 144, 216, 288].map((bearing, index) =>
      makePoi(index, bearing, 11000)
    );
    const neighboringPois = [0, 72, 144, 216, 288].map((bearing, index) =>
      makePoi(index + 10, bearing, 6000)
    );

    const results = solveStarFromPois([...neighboringPois, ...honeycombPois], {
      mode: 5,
      center,
      radiusMeters: 15000,
      angleToleranceDeg: 30,
      candidatesPerSlot: 1,
      rotationStepDeg: 72,
      hexCellRadiusMeters: 10000,
      hexPriorityRings: 1
    });

    const neighboringIds = neighboringPois.map((point) => point.id);
    expect(results[0].points.map((point) => point.id)).toEqual(
      honeycombPois.map((point) => point.id)
    );
    expect(
      results.some(
        (result) =>
          result.points.map((point) => point.id).join("|") ===
          neighboringIds.join("|")
      )
    ).toBe(true);
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
