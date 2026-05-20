import { describe, expect, it } from "vitest";
import {
  angularDifferenceDegrees,
  bearingDegrees,
  destinationPoint,
  haversineDistanceMeters,
  normalizeDegrees
} from "../lib/geo";

describe("geo helpers", () => {
  it("normalizes and compares circular angles", () => {
    expect(normalizeDegrees(-10)).toBe(350);
    expect(normalizeDegrees(370)).toBe(10);
    expect(angularDifferenceDegrees(350, 10)).toBe(20);
  });

  it("computes distance and bearing between nearby points", () => {
    const origin = { lat: 25.033964, lng: 121.564468 };
    const east = destinationPoint(origin, 1000, 90);

    expect(haversineDistanceMeters(origin, east)).toBeCloseTo(1000, -1);
    expect(bearingDegrees(origin, east)).toBeCloseTo(90, 0);
  });
});
