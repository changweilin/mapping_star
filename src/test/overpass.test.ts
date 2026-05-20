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
    expect(query).not.toContain('["religion"]');
  });

  it("builds a high-rise commercial building query", () => {
    const query = buildOverpassQuery(
      { lat: 25, lng: 121 },
      1000,
      [mustCategory("building")]
    );

    expect(query).toContain('["building"]["building:levels"]');
    expect(query).toContain('number(t["building:levels"]) >= 16');
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

  it("matches split shops, public, traffic, medical, education, high-rise, and renamed peaks", () => {
    const pois = parseOverpassElements(
      [
        {
          type: "way",
          id: 1,
          center: { lat: 25, lon: 121 },
          tags: {
            name: "Office tower",
            building: "yes",
            "building:levels": "16"
          }
        },
        {
          type: "way",
          id: 2,
          center: { lat: 25.001, lon: 121.001 },
          tags: {
            name: "Fifteen floors",
            building: "yes",
            "building:levels": "15"
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
          type: "way",
          id: 7,
          center: { lat: 25.006, lon: 121.006 },
          tags: {
            name: "Hospital",
            building: "hospital"
          }
        },
        {
          type: "way",
          id: 8,
          center: { lat: 25.007, lon: 121.007 },
          tags: {
            name: "University",
            amenity: "university"
          }
        },
        {
          type: "node",
          id: 9,
          lat: 25.008,
          lon: 121.008,
          tags: {
            name: "Peak",
            natural: "peak"
          }
        }
      ],
      { lat: 25, lng: 121 },
      POI_CATEGORIES
    );

    expect(pois.map((poi) => poi.name)).not.toContain("Fifteen floors");
    expect(pois.map((poi) => poi.categoryId)).toEqual([
      "building",
      "convenience",
      "market",
      "government",
      "station",
      "medical",
      "education",
      "peak"
    ]);
    expect(pois[0].categoryLabel).toBe("商辦/高樓");
    expect(pois[3].categoryLabel).toBe("公共建築");
    expect(pois[4].categoryLabel).toBe("交通");
    expect(pois[5].categoryLabel).toBe("醫療建築");
    expect(pois[6].categoryLabel).toBe("學校/學術");
    expect(pois[7].categoryLabel).toBe("山峰");
  });

  it("keeps institutional buildings out of the high-rise category", () => {
    const pois = parseOverpassElements(
      [
        {
          type: "way",
          id: 1,
          center: { lat: 25, lon: 121 },
          tags: {
            name: "Public tower",
            building: "public",
            "building:levels": "20"
          }
        },
        {
          type: "way",
          id: 2,
          center: { lat: 25.001, lon: 121.001 },
          tags: {
            name: "Medical tower",
            building: "hospital",
            "building:levels": "20"
          }
        },
        {
          type: "way",
          id: 3,
          center: { lat: 25.002, lon: 121.002 },
          tags: {
            name: "Campus tower",
            building: "school",
            "building:levels": "20"
          }
        },
        {
          type: "way",
          id: 4,
          center: { lat: 25.003, lon: 121.003 },
          tags: {
            name: "Transport tower",
            building: "transportation",
            "building:levels": "20"
          }
        },
        {
          type: "way",
          id: 5,
          center: { lat: 25.004, lon: 121.004 },
          tags: {
            name: "Commercial tower",
            building: "commercial",
            "building:levels": "20"
          }
        }
      ],
      { lat: 25, lng: 121 },
      [mustCategory("building")]
    );

    expect(pois.map((poi) => poi.name)).toEqual(["Commercial tower"]);
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

  it("falls back to individual filters when a multi-filter category times out", async () => {
    const timeoutError = Object.assign(new Error("aborted"), {
      name: "AbortError"
    });
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockRejectedValueOnce(timeoutError)
      .mockRejectedValueOnce(timeoutError)
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
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            elements: [
              {
                type: "way",
                id: 2,
                center: { lat: 25.001, lon: 121.001 },
                tags: {
                  name: "Shrine",
                  building: "shrine"
                }
              }
            ]
          }),
          { status: 200 }
        )
      );

    const result = await fetchPoisDetailed({ lat: 25, lng: 121 }, 1000, [
      mustCategory("religion")
    ]);

    expect(fetchMock).toHaveBeenCalledTimes(4);
    expect(result.pois.map((poi) => poi.name)).toEqual(["Temple", "Shrine"]);
    expect(result.warnings).toEqual([]);
  });

  it("continues with partial filter results when one fallback filter still times out", async () => {
    const timeoutError = Object.assign(new Error("aborted"), {
      name: "AbortError"
    });
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockRejectedValueOnce(timeoutError)
      .mockRejectedValueOnce(timeoutError)
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
      mustCategory("religion")
    ]);

    expect(fetchMock).toHaveBeenCalledTimes(5);
    expect(result.pois).toHaveLength(1);
    expect(result.pois[0].name).toBe("Temple");
    expect(result.warnings[0]).toContain("寺廟/宗教 的部分條件查詢失敗");
    expect(result.warnings[0]).toContain("請求逾時");
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
