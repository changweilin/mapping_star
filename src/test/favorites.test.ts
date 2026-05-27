import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createFavoritesArchive,
  FAVORITES_STORAGE_KEY,
  loadFavorites,
  parseFavoritesArchive,
  saveFavorites
} from "../lib/favorites";
import type { FavoriteItem, Poi, StarResult } from "../types";

afterEach(() => {
  vi.unstubAllGlobals();
});

const poi: Poi = {
  id: "node/1",
  osmType: "node",
  osmId: 1,
  name: "POI 1",
  lat: 25,
  lng: 121,
  categoryId: "religion",
  categoryLabel: "宗教",
  categoryColor: "#b43b73",
  tags: {},
  distanceMeters: 1000,
  bearingDeg: 72
};

const star: StarResult = {
  id: "star-1",
  mode: 5,
  center: { lat: 25, lng: 121 },
  points: [0, 1, 2, 3, 4].map((index) => ({
    ...poi,
    id: `node/${index + 1}`,
    osmId: index + 1,
    lat: 25 + index * 0.001,
    lng: 121 + index * 0.001
  })),
  score: 0.1,
  rotationDeg: 12,
  radiusMeanMeters: 1000,
  radiusStdMeters: 10,
  angleErrorDeg: 1,
  centerErrorMeters: 0,
  createdAt: "2026-05-21T00:00:00.000Z"
};

const favorites: FavoriteItem[] = [
  {
    id: "poi-node/1",
    type: "poi",
    name: "POI 1",
    createdAt: "2026-05-21T00:00:00.000Z",
    poi
  },
  {
    id: "star-star-1",
    type: "star",
    name: "Star 1",
    createdAt: "2026-05-21T00:00:00.000Z",
    star
  }
];

describe("favorites helpers", () => {
  it("loads an empty list when storage is empty", () => {
    vi.stubGlobal("window", {
      localStorage: {
        getItem: vi.fn(() => null)
      }
    });

    expect(loadFavorites()).toEqual([]);
  });

  it("saves favorites to localStorage", () => {
    const localStorage = {
      getItem: vi.fn(() => null),
      setItem: vi.fn()
    };
    vi.stubGlobal("window", { localStorage });

    saveFavorites([]);

    expect(localStorage.setItem).toHaveBeenCalledWith(
      FAVORITES_STORAGE_KEY,
      "[]"
    );
  });

  it("exports and imports a versioned favorites archive", () => {
    const archive = createFavoritesArchive(favorites);
    const parsed = parseFavoritesArchive(JSON.stringify(archive));

    expect(parsed.type).toBe("mapping-star:favorites");
    expect(parsed.favorites).toEqual(favorites);
  });

  it("imports legacy favorite arrays", () => {
    expect(parseFavoritesArchive(JSON.stringify(favorites)).favorites).toEqual(
      favorites
    );
  });

  it("keeps running when favorites cannot be persisted", () => {
    const localStorage = {
      getItem: vi.fn(() => null),
      setItem: vi.fn(() => {
        throw new Error("quota exceeded");
      })
    };
    vi.stubGlobal("window", { localStorage });

    expect(() => saveFavorites([])).not.toThrow();
  });
});
