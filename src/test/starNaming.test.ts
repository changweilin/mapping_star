import { describe, expect, it } from "vitest";
import type { FavoriteItem, Poi, StarResult } from "../types";
import { makeAutomaticStarName } from "../lib/starNaming";

const center = { lat: 25, lng: 121 };

const makePoi = (
  id: string,
  name: string,
  categoryId = "religion",
  distanceMeters = 200
): Poi => ({
  id,
  osmType: "node",
  osmId: Number(id),
  name,
  lat: center.lat,
  lng: center.lng + distanceMeters / 100000,
  categoryId,
  categoryLabel: categoryId,
  categoryColor: "#000",
  tags: {},
  distanceMeters,
  bearingDeg: 90
});

const makeStar = (mode: 5 | 6, radiusMeanMeters = 2400): StarResult => ({
  id: `star-${mode}`,
  mode,
  center,
  points: Array.from({ length: mode }, (_, index) =>
    makePoi(String(index + 1), `Point ${index + 1}`)
  ),
  score: 0,
  rotationDeg: 0,
  radiusMeanMeters,
  radiusStdMeters: 0,
  angleErrorDeg: 0,
  createdAt: "2026-05-22T00:00:00.000Z"
});

describe("automatic star naming", () => {
  it("uses the nearest checked target category before the searched center name", () => {
    const name = makeAutomaticStarName({
      center,
      centerName: "台北101",
      favorites: [],
      outerRadiusMeters: 1000,
      pois: [
        makePoi("1", "遠方咖啡", "cafe", 900),
        makePoi("2", "松山慈惠堂", "religion", 180)
      ],
      selectedCategoryIds: ["religion"],
      star: makeStar(5)
    });

    expect(name).toBe("松山慈惠堂 2.4km 五芒星");
  });

  it("uses the nearest favorite magic circle when no checked target is nearby", () => {
    const favorite: FavoriteItem = {
      id: "star-old",
      type: "star",
      name: "信義核心 3km 六芒星",
      createdAt: "2026-05-22T00:00:00.000Z",
      star: {
        ...makeStar(6, 3000),
        id: "old",
        name: "信義核心 3km 六芒星",
        center: { lat: 25.001, lng: 121.001 }
      }
    };

    const name = makeAutomaticStarName({
      center,
      centerName: "搜尋中心",
      favorites: [favorite],
      outerRadiusMeters: 1000,
      pois: [makePoi("9", "未勾選地點", "cafe", 100)],
      selectedCategoryIds: ["religion"],
      star: makeStar(6, 5000)
    });

    expect(name).toBe("信義核心 5km 六芒星");
  });
});
