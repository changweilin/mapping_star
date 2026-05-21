import { afterEach, describe, expect, it, vi } from "vitest";
import {
  LAST_STAR_STORAGE_KEY,
  loadLastStar,
  saveLastStar
} from "../lib/lastStar";
import type { Poi, StarResult } from "../types";

afterEach(() => {
  vi.unstubAllGlobals();
});

const makeLocalStorage = () => {
  const storage = new Map<string, string>();

  return {
    clear: vi.fn(() => storage.clear()),
    getItem: vi.fn((key: string) => storage.get(key) ?? null),
    removeItem: vi.fn((key: string) => storage.delete(key)),
    setItem: vi.fn((key: string, value: string) => {
      storage.set(key, value);
    })
  };
};

const makePoi = (id: string): Poi => ({
  id,
  osmType: "node",
  osmId: Number(id),
  name: `POI ${id}`,
  lat: 25 + Number(id) * 0.001,
  lng: 121 + Number(id) * 0.001,
  categoryId: "religion",
  categoryLabel: "寺廟/宗教",
  categoryColor: "#b43b73",
  tags: {},
  distanceMeters: 1000,
  bearingDeg: Number(id) * 72
});

const star: StarResult = {
  id: "star-cache",
  mode: 5,
  center: { lat: 25, lng: 121 },
  points: ["1", "2", "3", "4", "5"].map(makePoi),
  score: 0.1,
  rotationDeg: 12,
  radiusMeanMeters: 1000,
  radiusStdMeters: 10,
  angleErrorDeg: 1,
  createdAt: "2026-05-21T00:00:00.000Z"
};

describe("last star helpers", () => {
  it("saves and loads the last visible star from localStorage", () => {
    const localStorage = makeLocalStorage();
    vi.stubGlobal("window", { localStorage });

    saveLastStar(star);

    expect(loadLastStar()).toEqual(star);
    expect(localStorage.setItem).toHaveBeenCalledWith(
      LAST_STAR_STORAGE_KEY,
      JSON.stringify(star)
    );
  });

  it("ignores invalid stored values", () => {
    const localStorage = makeLocalStorage();
    vi.stubGlobal("window", { localStorage });
    localStorage.setItem(LAST_STAR_STORAGE_KEY, JSON.stringify({ mode: 7 }));

    expect(loadLastStar()).toBeNull();
  });
});
