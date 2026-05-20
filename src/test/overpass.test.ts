import { afterEach, describe, expect, it, vi } from "vitest";
import { POI_CATEGORIES } from "../data/categories";
import {
  buildOverpassQuery,
  fetchPois,
  parseOverpassElements
} from "../lib/overpass";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("overpass helpers", () => {
  it("builds a query for selected categories", () => {
    const query = buildOverpassQuery(
      { lat: 25, lng: 121 },
      1000,
      [POI_CATEGORIES[0]]
    );

    expect(query).toContain("[out:json]");
    expect(query).toContain("around:1000,25.000000,121.000000");
    expect(query).toContain("place_of_worship");
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
      POI_CATEGORIES[0]
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
      POI_CATEGORIES[0],
      POI_CATEGORIES[2]
    ]);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(String(fetchMock.mock.calls[0][1]?.body)).toContain(
      "place_of_worship"
    );
    expect(String(fetchMock.mock.calls[1][1]?.body)).toContain("cafe");
  });
});
