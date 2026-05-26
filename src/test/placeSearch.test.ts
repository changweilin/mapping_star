import { afterEach, describe, expect, it, vi } from "vitest";
import { parseCoordinateInput, searchPlaces } from "../lib/placeSearch";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("place search helpers", () => {
  it("parses latitude and longitude input without calling Nominatim", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const result = await searchPlaces("25.033964,121.564468");

    expect(result).toEqual([
      {
        id: "coordinate:25.033964,121.564468",
        center: { lat: 25.033964, lng: 121.564468 },
        label: "25.033964, 121.564468"
      }
    ]);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(parseCoordinateInput("91,121")).toBeNull();
  });

  it("normalizes Nominatim search results", async () => {
    const fetchMock = vi.fn(
      async (_input: RequestInfo | URL, _init?: RequestInit) =>
        new Response(
          JSON.stringify([
            {
              place_id: 42,
              lat: "25.0478",
              lon: "121.5319",
              name: "台北車站",
              display_name: "台北車站, 中正區, 台北市"
            }
          ])
        )
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await searchPlaces("台北車站");

    expect(result).toEqual([
      {
        id: "place:42",
        center: { lat: 25.0478, lng: 121.5319 },
        label: "台北車站",
        detail: "台北車站, 中正區, 台北市"
      }
    ]);
    const firstCall = fetchMock.mock.calls[0];
    expect(firstCall).toBeDefined();
    if (!firstCall) throw new Error("Expected fetch to be called.");
    expect(String(firstCall[0])).toContain("accept-language=zh-TW%2Czh%2Cen");
  });

  it("stops before fetch when the search is already aborted", async () => {
    const fetchMock = vi.fn();
    const controller = new AbortController();
    controller.abort();
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      searchPlaces("台北車站", { signal: controller.signal })
    ).rejects.toMatchObject({ name: "AbortError" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("times out stalled Nominatim requests", async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn(
      (_url: string | URL | Request, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => {
            const error = new Error("aborted");
            error.name = "AbortError";
            reject(error);
          });
        })
    );
    vi.stubGlobal("fetch", fetchMock);

    const search = expect(
      searchPlaces("台北車站", { timeoutMs: 5 })
    ).rejects.toThrow("地點搜尋逾時");
    await vi.advanceTimersByTimeAsync(5);

    await search;
  });
});
