import { afterEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_APP_SETTINGS } from "../lib/settings";
import {
  createSearchSessionArchive,
  loadSearchSession,
  parseSearchSessionArchive,
  saveSearchSession,
  SEARCH_SESSION_STORAGE_KEY
} from "../lib/searchSession";
import type { CalculationRecord, Poi, StarResult } from "../types";

afterEach(() => {
  vi.unstubAllGlobals();
});

const makeLocalStorage = () => {
  const storage = new Map<string, string>();

  return {
    getItem: vi.fn((key: string) => storage.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => {
      storage.set(key, value);
    })
  };
};

const poi = (id: number): Poi => ({
  id: `node/${id}`,
  osmType: "node",
  osmId: id,
  name: `POI ${id}`,
  lat: 25 + id * 0.001,
  lng: 121 + id * 0.001,
  categoryId: "religion",
  categoryLabel: "宗教",
  categoryColor: "#b43b73",
  tags: {},
  distanceMeters: 1000 + id,
  bearingDeg: id * 72
});

const points = [1, 2, 3, 4, 5].map(poi);

const star: StarResult = {
  id: "star-session",
  mode: 5,
  center: { lat: 25, lng: 121 },
  points,
  score: 0.1,
  rotationDeg: 12,
  radiusMeanMeters: 1000,
  radiusStdMeters: 10,
  angleErrorDeg: 1,
  centerErrorMeters: 0,
  createdAt: "2026-05-21T00:00:00.000Z"
};

const record: CalculationRecord = {
  id: "calculation-1",
  status: "completed",
  sourceLabel: "搜索繪製",
  title: "搜索繪製完成",
  message: "完成",
  startedAtIso: "2026-05-21T00:00:00.000Z",
  finishedAtIso: "2026-05-21T00:00:01.000Z",
  totalElapsedMs: 1000,
  summary: null
};

const session = {
  center: { lat: 25, lng: 121 },
  centerName: "測試中心",
  searchText: "台北",
  pois: points,
  results: [star],
  calculationRecords: [record],
  selectedResultIndex: 0,
  settings: {
    ...DEFAULT_APP_SETTINGS,
    center: { lat: 25, lng: 121 },
    centerName: "測試中心",
    searchText: "台北",
    magicPlayback: "paused" as const,
    magicSpeed: 2 as const
  }
};

describe("search session helpers", () => {
  it("exports and imports the last search session archive", () => {
    const archive = createSearchSessionArchive(session);
    const parsed = parseSearchSessionArchive(JSON.stringify(archive));

    expect(parsed.type).toBe("mapping-star:search-session");
    expect(parsed.centerName).toBe("測試中心");
    expect(parsed.pois).toEqual(points);
    expect(parsed.results).toEqual([star]);
    expect(parsed.calculationRecords).toEqual([record]);
    expect(parsed.settings?.magicPlayback).toBe("paused");
  });

  it("saves and loads the search session from localStorage", () => {
    const localStorage = makeLocalStorage();
    vi.stubGlobal("window", { localStorage });

    saveSearchSession(session);

    expect(localStorage.setItem).toHaveBeenCalledWith(
      SEARCH_SESSION_STORAGE_KEY,
      expect.any(String)
    );
    expect(loadSearchSession()?.results).toEqual([star]);
  });

  it("ignores invalid session archives", () => {
    expect(() =>
      parseSearchSessionArchive(JSON.stringify({ results: "bad" }))
    ).toThrow();
  });

  it("keeps running when the search session cannot be persisted", () => {
    const localStorage = {
      getItem: vi.fn(() => null),
      setItem: vi.fn(() => {
        throw new Error("quota exceeded");
      })
    };
    vi.stubGlobal("window", { localStorage });

    expect(() => saveSearchSession(session)).not.toThrow();
  });
});
