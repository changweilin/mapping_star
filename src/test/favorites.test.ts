import { afterEach, describe, expect, it, vi } from "vitest";
import {
  FAVORITES_STORAGE_KEY,
  loadFavorites,
  saveFavorites
} from "../lib/favorites";

afterEach(() => {
  vi.unstubAllGlobals();
});

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
