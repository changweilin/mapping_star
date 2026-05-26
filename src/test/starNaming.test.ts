import { describe, expect, it } from "vitest";
import type { StarMode, StarResult } from "../types";
import { makeAutomaticStarName } from "../lib/starNaming";

const center = { lat: 25, lng: 121 };

const makeStar = (
  mode: StarMode,
  radiusMeanMeters = 2400,
  rotationDeg = 13,
  angleErrorDeg = 1.2
): StarResult => ({
  id: `star-${mode}`,
  mode,
  center,
  points: Array.from({ length: mode }, (_, index) => ({
    id: String(index + 1),
    osmType: "node",
    osmId: index + 1,
    name: `Point ${index + 1}`,
    lat: center.lat,
    lng: center.lng + (index + 1) / 100000,
    categoryId: "religion",
    categoryLabel: "寺廟/宗教",
    categoryColor: "#000",
    tags: {},
    distanceMeters: 200,
    bearingDeg: 90
  })),
  score: 0,
  rotationDeg,
  radiusMeanMeters,
  radiusStdMeters: 0,
  angleErrorDeg,
  centerErrorMeters: 0,
  createdAt: "2026-05-22T00:00:00.000Z"
});

describe("automatic star naming", () => {
  it("uses center, pattern, radius, angle, and error in that order", () => {
    const name = makeAutomaticStarName({
      centerName: "台北101",
      star: makeStar(5)
    });

    expect(name).toBe("台北101 五芒星 半徑2.4km 角度13° 誤差1.2°");
  });

  it("ignores nearby targets and keeps the searched center as the base name", () => {
    const name = makeAutomaticStarName({
      centerName: "搜尋中心",
      star: makeStar(6, 5000, 0, 0)
    });

    expect(name).toBe("搜尋中心 六芒星 半徑5km 角度0° 誤差0°");
  });

  it("preserves coordinate center names", () => {
    const name = makeAutomaticStarName({
      centerName: "25.033964, 121.564468",
      star: makeStar(5, 2400, 6, 0.4)
    });

    expect(name).toBe("25.033964,121.564468 五芒星 半徑2.4km 角度6° 誤差0.4°");
  });

  it("strips an existing generated suffix before renaming", () => {
    const name = makeAutomaticStarName({
      centerName: "台北101 五芒星 半徑2.4km 角度13° 誤差1.2°",
      star: makeStar(6, 5000, 0, 0)
    });

    expect(name).toBe("台北101 六芒星 半徑5km 角度0° 誤差0°");
  });

  it("names the new cross star and bagua patterns", () => {
    expect(
      makeAutomaticStarName({
        centerName: "台北101",
        star: makeStar(4, 3200, 45, 0.8)
      })
    ).toBe("台北101 十字星 半徑3.2km 角度45° 誤差0.8°");

    expect(
      makeAutomaticStarName({
        centerName: "台北101 十字星 半徑3.2km 角度45° 誤差0.8°",
        star: makeStar(8, 4200, 22, 0.5)
      })
    ).toBe("台北101 八卦圖 半徑4.2km 角度22° 誤差0.5°");
  });
});
