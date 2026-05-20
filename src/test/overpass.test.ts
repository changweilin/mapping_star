import { afterEach, describe, expect, it, vi } from "vitest";
import { POI_CATEGORIES, categoryById } from "../data/categories";
import {
  buildOverpassQuery,
  fetchPois,
  fetchPoisDetailed,
  parseOverpassElements
} from "../lib/overpass";

afterEach(() => {
  vi.restoreAllMocks();
});

const mustCategory = (id: string) => {
  const category = categoryById(id);
  if (!category) throw new Error(`Missing test category: ${id}`);
  return category;
};

describe("overpass helpers", () => {
  it("builds a query for selected categories", () => {
    const query = buildOverpassQuery(
      { lat: 25, lng: 121 },
      1000,
      [mustCategory("religion")]
    );

    expect(query).toContain("[out:json]");
    expect(query).toContain("around:1000,25.000000,121.000000");
    expect(query).toContain("place_of_worship");
  });

  it("builds a high-rise building query", () => {
    const query = buildOverpassQuery(
      { lat: 25, lng: 121 },
      1000,
      [mustCategory("building")]
    );

    expect(query).toContain('["building"]["building:levels"]');
    expect(query).toContain('number(t["building:levels"]) > 6');
  });

  it("parses Overpass nodes and assigns categories", () => {
    const pois = parseOverpassElements(
      [
        {
          type: "node",
          id: 1,
          lat: 25,
          lon: 121,
          tags: {
            name: "Temple",
            amenity: "place_of_worship"
          }
        },
        {
          type: "way",
          id: 2,
          center: { lat: 25.1, lon: 121.1 },
          tags: {
            name: "Cafe",
            amenity: "cafe"
          }
        }
      ],
      { lat: 25, lng: 121 },
      POI_CATEGORIES
    );

    expect(pois).toHaveLength(2);
    expect(pois[0].name).toBe("Temple");
    expect(pois[1].categoryId).toBe("cafe");
  });

  it("matches split shops, high-rise buildings, government offices, stations, and renamed peaks", () => {
    const pois = parseOverpassElements(
      [
        {
          type: "way",
          id: 1,
          center: { lat: 25, lon: 121 },
          tags: {
            name: "Seven floors",
            building: "yes",
            "building:levels": "7"
          }
        },
        {
          type: "way",
          id: 2,
          center: { lat: 25.001, lon: 121.001 },
          tags: {
            name: "Six floors",
            building: "yes",
            "building:levels": "6"
          }
        },
        {
          type: "node",
          id: 3,
          lat: 25.002,
          lon: 121.002,
          tags: {
            name: "Convenience",
            shop: "convenience"
          }
        },
        {
          type: "node",
          id: 4,
          lat: 25.003,
          lon: 121.003,
          tags: {
            name: "Supermarket",
            shop: "supermarket"
          }
        },
        {
          type: "node",
          id: 5,
          lat: 25.004,
          lon: 121.004,
          tags: {
            name: "City Office",
            office: "government"
          }
        },
        {
          type: "node",
          id: 6,
          lat: 25.005,
          lon: 121.005,
          tags: {
            name: "Station",
            railway: "station"
          }
        },
        {
          type: "node",
          id: 7,
          lat: 25.006,
          lon: 121.006,
          tags: {
            name: "Peak",
            natural: "peak"
          }
        }
      ],
      { lat: 25, lng: 121 },
      POI_CATEGORIES
    );

    expect(pois.map((poi) => poi.name)).not.toContain("Six floors");
    expect(pois.map((poi) => poi.categoryId)).toEqual([
      "building",
      "convenience",
      "market",
      "government",
      "station",
      "peak"
    ]);
    expect(pois[5].categoryLabel).toBe("山峰");
  });

  it("tries another endpoint for transient Overpass failures", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response("", { status: 504 }))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            elements: [
              {
                type: "node",
                id: 1,
                lat: 25,
                lon: 121,
                tags: {
                  name: "Temple",
                  amenity: "place_of_worship"
                }
              }
            ]
          }),
          { status: 200 }
        )
      );

    const pois = await fetchPois({ lat: 25, lng: 121 }, 1000, [
      mustCategory("religion")
    ]);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(pois).toHaveLength(1);
    expect(pois[0].name).toBe("Temple");
  });

  it("queries selected categories separately", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(() =>
      Promise.resolve(
        new Response(JSON.stringify({ elements: [] }), {
          status: 200
        })
      )
    );

    await fetchPois({ lat: 25, lng: 121 }, 1000, [
      mustCategory("religion"),
      mustCategory("cafe")
    ]);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(String(fetchMock.mock.calls[0][1]?.body)).toContain(
      "place_of_worship"
    );
    expect(String(fetchMock.mock.calls[1][1]?.body)).toContain("cafe");
  });

  it("continues with successful categories when another category times out", async () => {
    const timeoutError = Object.assign(new Error("aborted"), {
      name: "AbortError"
    });
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            elements: [
              {
                type: "node",
                id: 1,
                lat: 25,
                lon: 121,
                tags: {
                  name: "Temple",
                  amenity: "place_of_worship"
                }
              }
            ]
          }),
          { status: 200 }
        )
      )
      .mockRejectedValueOnce(timeoutError)
      .mockRejectedValueOnce(timeoutError);

    const result = await fetchPoisDetailed({ lat: 25, lng: 121 }, 1000, [
      mustCategory("religion"),
      mustCategory("restaurant")
    ]);

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(result.pois).toHaveLength(1);
    expect(result.pois[0].name).toBe("Temple");
    expect(result.warnings[0]).toContain("餐廳");
    expect(result.warnings[0]).toContain("請求逾時");
  });
});
