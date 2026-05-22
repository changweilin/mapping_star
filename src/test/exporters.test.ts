import { describe, expect, it } from "vitest";
import { POI_CATEGORIES } from "../data/categories";
import { exportGpx, exportKml } from "../lib/exporters";
import type { Poi, StarResult } from "../types";

const category = POI_CATEGORIES[0];

const point = (id: number, lat: number, lng: number): Poi => ({
  id: `node/${id}`,
  osmType: "node",
  osmId: id,
  name: `Point ${id}`,
  lat,
  lng,
  categoryId: category.id,
  categoryLabel: category.label,
  categoryColor: category.color,
  tags: {},
  distanceMeters: 1000,
  bearingDeg: id * 72
});

const pois = [
  point(0, 25, 121),
  point(1, 25.1, 121.1),
  point(2, 25.2, 121.2),
  point(3, 25.3, 121.3),
  point(4, 25.4, 121.4)
];

const star: StarResult = {
  id: "star",
  mode: 5,
  center: { lat: 25, lng: 121 },
  points: pois,
  score: 0,
  rotationDeg: 0,
  radiusMeanMeters: 1000,
  radiusStdMeters: 0,
  angleErrorDeg: 0,
  centerErrorMeters: 0,
  createdAt: "2026-05-20T00:00:00.000Z"
};

describe("exporters", () => {
  it("exports GPX waypoints and routes", () => {
    const gpx = exportGpx("Test", [], [star]);

    expect(gpx).toContain("<gpx");
    expect(gpx).toContain("<wpt lat=\"25\" lon=\"121\">");
    expect(gpx).toContain("<rte>");
  });

  it("exports KML points and lines", () => {
    const kml = exportKml("Test", [], [star]);

    expect(kml).toContain("<kml");
    expect(kml).toContain("<Point><coordinates>121,25,0</coordinates></Point>");
    expect(kml).toContain("<LineString>");
  });

  it("uses stored star names when exporting routes", () => {
    const gpx = exportGpx("Test", [], [{ ...star, name: "台北101 1km 五芒星" }]);

    expect(gpx).toContain("<name>台北101 1km 五芒星</name>");
  });
});
