import { afterEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_CATEGORY_IDS } from "../data/categories";
import {
  DEFAULT_APP_SETTINGS,
  loadSettings,
  normalizeSettings,
  saveSettings
} from "../lib/settings";

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

describe("settings helpers", () => {
  it("defaults to only the religion category", () => {
    expect(DEFAULT_CATEGORY_IDS).toEqual(["religion"]);
    expect(DEFAULT_APP_SETTINGS.selectedCategoryIds).toEqual(["religion"]);
    expect(DEFAULT_APP_SETTINGS.searchStrategy).toBe("honeycomb");
    expect(DEFAULT_APP_SETTINGS.hexCellRadiusKm).toBe(0.5);
  });

  it("clamps persisted radius range and solver controls to the current UI ranges", () => {
    const settings = normalizeSettings({
      innerRadiusKm: 40,
      outerRadiusKm: 100,
      starMode: 6,
      angleToleranceDeg: 36,
      candidatesPerSlot: 99,
      rotationStepDeg: 0,
      searchStrategy: "angular",
      hexCellRadiusKm: 99,
      showSectors: false,
      selectedCategoryIds: ["religion", "missing", "station", "station"],
      theme: "dark",
      mapLayer: "satellite"
    });

    expect(settings.innerRadiusKm).toBe(29);
    expect(settings.outerRadiusKm).toBe(30);
    expect(settings.starMode).toBe(6);
    expect(settings.angleToleranceDeg).toBe(30);
    expect(settings.candidatesPerSlot).toBe(12);
    expect(settings.rotationStepDeg).toBe(1);
    expect(settings.searchStrategy).toBe("angular");
    expect(settings.hexCellRadiusKm).toBe(10);
    expect(settings.showSectors).toBe(false);
    expect(settings.selectedCategoryIds).toEqual(["religion", "station"]);
    expect(settings.theme).toBe("dark");
    expect(settings.mapLayer).toBe("satellite");
  });

  it("migrates the legacy single radius setting to an outer radius", () => {
    const settings = normalizeSettings({
      radiusKm: 12
    });

    expect(settings.innerRadiusKm).toBe(0);
    expect(settings.outerRadiusKm).toBe(12);
  });

  it("falls back to the default category when persisted category ids are empty", () => {
    const settings = normalizeSettings({
      selectedCategoryIds: ["missing"]
    });

    expect(settings.selectedCategoryIds).toEqual(["religion"]);
  });

  it("falls back to light mode when the persisted theme is invalid", () => {
    const settings = normalizeSettings({
      theme: "auto"
    });

    expect(settings.theme).toBe("light");
  });

  it("falls back to the street map layer when the persisted layer is invalid", () => {
    const settings = normalizeSettings({
      mapLayer: "cadastre"
    });

    expect(settings.mapLayer).toBe("street");
  });

  it("saves and loads settings from localStorage", () => {
    const localStorage = makeLocalStorage();
    vi.stubGlobal("window", { localStorage });

    saveSettings({
      ...DEFAULT_APP_SETTINGS,
      innerRadiusKm: 4,
      outerRadiusKm: 12,
      searchStrategy: "angular",
      hexCellRadiusKm: 7,
      showSectors: false,
      selectedCategoryIds: ["religion", "station"],
      theme: "dark",
      mapLayer: "terrain"
    });

    const loaded = loadSettings();
    expect(loaded.innerRadiusKm).toBe(4);
    expect(loaded.outerRadiusKm).toBe(12);
    expect(loaded.searchStrategy).toBe("angular");
    expect(loaded.hexCellRadiusKm).toBe(7);
    expect(loaded.showSectors).toBe(false);
    expect(loaded.selectedCategoryIds).toEqual(["religion", "station"]);
    expect(loaded.theme).toBe("dark");
    expect(loaded.mapLayer).toBe("terrain");
  });
});
