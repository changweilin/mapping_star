import { describe, expect, it } from "vitest";
import {
  getHexCellCenterPlanar,
  getHexRing,
  getHexTargetRadiusMeters,
  hexDistance,
  hexKey,
  normalizeHexCellRadius,
  pointToHex,
  toPlanarPoint
} from "../lib/hexGrid";

describe("hex grid helpers", () => {
  it("normalizes target and cell radii", () => {
    expect(getHexTargetRadiusMeters(10000, 4000)).toBe(7000);
    expect(getHexTargetRadiusMeters(10000, -500)).toBe(5000);
    expect(normalizeHexCellRadius(10000, 500)).toBe(500);
    expect(normalizeHexCellRadius(10000, 12000)).toBe(10000);
    expect(normalizeHexCellRadius(10000, undefined, 4000)).toBe(4000);
  });

  it("converts bearing coordinates into planar points and hex cells", () => {
    const eastPoint = toPlanarPoint(1000, 90);
    expect(eastPoint.x).toBeCloseTo(1000);
    expect(eastPoint.y).toBeCloseTo(0);
    expect(hexKey(pointToHex(eastPoint, 1000))).toBe("1,0");
  });

  it("returns complete rings around a center cell", () => {
    const center = { q: 2, r: -1 };
    const ring = getHexRing(center, 1);

    expect(ring).toHaveLength(6);
    expect(ring.every((cell) => hexDistance(center, cell) === 1)).toBe(true);
  });

  it("locates the planar center of a cell", () => {
    const center = getHexCellCenterPlanar({ q: 1, r: 0 }, 1000);

    expect(center.x).toBeCloseTo(Math.sqrt(3) * 1000);
    expect(center.y).toBe(0);
  });
});
