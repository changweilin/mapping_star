import { afterEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_CATEGORY_IDS, POI_CATEGORIES } from "../data/categories";
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
    expect(DEFAULT_APP_SETTINGS.selectedCategoryGroups).toEqual([]);
    expect(DEFAULT_APP_SETTINGS.categoryGroupSelectionSnapshots).toEqual({});
    expect(DEFAULT_APP_SETTINGS.innerRadiusKm).toBe(4);
    expect(DEFAULT_APP_SETTINGS.outerRadiusKm).toBe(6);
    expect(DEFAULT_APP_SETTINGS.angleToleranceDeg).toBe(6);
    expect(DEFAULT_APP_SETTINGS.candidatesPerSlot).toBe(4);
    expect(DEFAULT_APP_SETTINGS.searchStrategy).toBe("honeycomb");
    expect(DEFAULT_APP_SETTINGS.hexCellRadiusKm).toBe(0.5);
    expect(DEFAULT_APP_SETTINGS.showHoneycomb).toBe(false);
    expect(DEFAULT_APP_SETTINGS.center).toEqual({
      lat: 25.033964,
      lng: 121.564468
    });
    expect(DEFAULT_APP_SETTINGS.magicDrawShape).toBe("star");
    expect(DEFAULT_APP_SETTINGS.magicPlaybackMode).toBe("continuous");
    expect(DEFAULT_APP_SETTINGS.magicSpeed).toBe(1);
  });

  it("migrates legacy persisted solver defaults to the current defaults", () => {
    const settings = normalizeSettings({
      innerRadiusKm: 0,
      outerRadiusKm: 30,
      starMode: 5,
      angleToleranceDeg: 36,
      candidatesPerSlot: 8
    });

    expect(settings.innerRadiusKm).toBe(4);
    expect(settings.outerRadiusKm).toBe(6);
    expect(settings.angleToleranceDeg).toBe(6);
    expect(settings.candidatesPerSlot).toBe(4);
  });

  it("migrates the old single-radius default to the current radius range", () => {
    const settings = normalizeSettings({
      radiusKm: 30,
      starMode: 6,
      angleToleranceDeg: 30,
      candidatesPerSlot: 8
    });

    expect(settings.innerRadiusKm).toBe(4);
    expect(settings.outerRadiusKm).toBe(6);
    expect(settings.angleToleranceDeg).toBe(6);
    expect(settings.candidatesPerSlot).toBe(4);
  });

  it("keeps custom persisted solver settings", () => {
    const settings = normalizeSettings({
      innerRadiusKm: 2,
      outerRadiusKm: 11,
      angleToleranceDeg: 12,
      candidatesPerSlot: 5
    });

    expect(settings.innerRadiusKm).toBe(2);
    expect(settings.outerRadiusKm).toBe(11);
    expect(settings.angleToleranceDeg).toBe(12);
    expect(settings.candidatesPerSlot).toBe(5);
  });

  it("clamps persisted radius range and solver controls to the current UI ranges", () => {
    const settings = normalizeSettings({
      innerRadiusKm: 40,
      outerRadiusKm: 100,
      starMode: 8,
      angleToleranceDeg: 36,
      candidatesPerSlot: 99,
      rotationStepDeg: 0,
      searchStrategy: "angular",
      hexCellRadiusKm: 99,
      showSectors: false,
      showHoneycomb: true,
      selectedCategoryIds: ["religion", "missing", "station", "station"],
      selectedCategoryGroups: ["missing"],
      categoryGroupSelectionSnapshots: { missing: ["station"] },
      center: { lat: 120, lng: 240 },
      centerName: 123,
      searchText: "台北龍山寺",
      magicDrawShape: "missing",
      magicDrawVariantByShape: { star: "8", missing: "x" },
      magicPlayback: "stopped",
      magicDirection: "sideways",
      magicSpeed: 3,
      magicPlaybackMode: "shuffle",
      magicAnimationIndex: 999,
      theme: "dark",
      mapLayer: "satellite"
    });

    expect(settings.innerRadiusKm).toBe(29);
    expect(settings.outerRadiusKm).toBe(30);
    expect(settings.starMode).toBe(8);
    expect(settings.angleToleranceDeg).toBe(22);
    expect(settings.candidatesPerSlot).toBe(12);
    expect(settings.rotationStepDeg).toBe(1);
    expect(settings.searchStrategy).toBe("angular");
    expect(settings.hexCellRadiusKm).toBe(3);
    expect(settings.showSectors).toBe(false);
    expect(settings.showHoneycomb).toBe(true);
    expect(settings.selectedCategoryIds).toEqual(["religion", "station"]);
    expect(settings.selectedCategoryGroups).toEqual([]);
    expect(settings.categoryGroupSelectionSnapshots).toEqual({});
    expect(settings.center).toEqual(DEFAULT_APP_SETTINGS.center);
    expect(settings.centerName).toBe(DEFAULT_APP_SETTINGS.centerName);
    expect(settings.searchText).toBe("台北龍山寺");
    expect(settings.magicDrawShape).toBe("star");
    expect(settings.magicDrawVariantByShape.star).toBe("8");
    expect(settings.magicPlayback).toBe("playing");
    expect(settings.magicDirection).toBe("forward");
    expect(settings.magicSpeed).toBe(1);
    expect(settings.magicPlaybackMode).toBe("continuous");
    expect(settings.magicAnimationIndex).toBeGreaterThan(0);
    expect(settings.theme).toBe("dark");
    expect(settings.mapLayer).toBe("satellite");
  });

  it("migrates the legacy single radius setting to an outer radius", () => {
    const settings = normalizeSettings({
      radiusKm: 12
    });

    expect(settings.innerRadiusKm).toBe(4);
    expect(settings.outerRadiusKm).toBe(12);
  });

  it("falls back to the default category when persisted category ids are empty", () => {
    const settings = normalizeSettings({
      selectedCategoryIds: ["missing"]
    });

    expect(settings.selectedCategoryIds).toEqual(["religion"]);
  });

  it("selects every child category when a category group is locked", () => {
    const group = POI_CATEGORIES.find((category) => category.id === "station")!
      .group;
    const expectedIds = POI_CATEGORIES.filter(
      (category) => category.group === group
    ).map((category) => category.id);

    const settings = normalizeSettings({
      selectedCategoryIds: [],
      selectedCategoryGroups: [group, "missing"]
    });

    expect(settings.selectedCategoryGroups).toEqual([group]);
    expect(settings.selectedCategoryIds).toEqual(expectedIds);
  });

  it("keeps the prior child selection snapshot for locked category groups", () => {
    const group = POI_CATEGORIES.find((category) => category.id === "station")!
      .group;
    const expectedIds = POI_CATEGORIES.filter(
      (category) => category.group === group
    ).map((category) => category.id);

    const settings = normalizeSettings({
      selectedCategoryIds: [],
      selectedCategoryGroups: [group],
      categoryGroupSelectionSnapshots: {
        [group]: ["station", "religion", "missing"]
      }
    });

    expect(settings.selectedCategoryIds).toEqual(expectedIds);
    expect(settings.categoryGroupSelectionSnapshots).toEqual({
      [group]: ["station"]
    });
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
      hexCellRadiusKm: 2.7,
      showSectors: false,
      showHoneycomb: true,
      selectedCategoryIds: ["religion", "station"],
      selectedCategoryGroups: [],
      categoryGroupSelectionSnapshots: {},
      center: { lat: 24.123, lng: 121.456 },
      centerName: "測試中心",
      searchText: "測試搜尋",
      magicDrawShape: "rose",
      magicDrawVariantByShape: {
        ...DEFAULT_APP_SETTINGS.magicDrawVariantByShape,
        rose: "k-9"
      },
      magicPlayback: "paused",
      magicDirection: "reverse",
      magicSpeed: 2,
      magicPlaybackMode: "loop-one",
      magicAnimationIndex: 3,
      theme: "dark",
      mapLayer: "terrain"
    });

    const loaded = loadSettings();
    expect(loaded.innerRadiusKm).toBe(4);
    expect(loaded.outerRadiusKm).toBe(12);
    expect(loaded.searchStrategy).toBe("angular");
    expect(loaded.hexCellRadiusKm).toBe(2.7);
    expect(loaded.showSectors).toBe(false);
    expect(loaded.showHoneycomb).toBe(true);
    expect(loaded.selectedCategoryIds).toEqual(["religion", "station"]);
    expect(loaded.selectedCategoryGroups).toEqual([]);
    expect(loaded.categoryGroupSelectionSnapshots).toEqual({});
    expect(loaded.center).toEqual({ lat: 24.123, lng: 121.456 });
    expect(loaded.centerName).toBe("測試中心");
    expect(loaded.searchText).toBe("測試搜尋");
    expect(loaded.magicDrawShape).toBe("rose");
    expect(loaded.magicDrawVariantByShape.rose).toBe("k-9");
    expect(loaded.magicPlayback).toBe("paused");
    expect(loaded.magicDirection).toBe("reverse");
    expect(loaded.magicSpeed).toBe(2);
    expect(loaded.magicPlaybackMode).toBe("loop-one");
    expect(loaded.magicAnimationIndex).toBe(3);
    expect(loaded.theme).toBe("dark");
    expect(loaded.mapLayer).toBe("terrain");
  });

  it("keeps running when settings cannot be persisted", () => {
    const localStorage = {
      getItem: vi.fn(() => null),
      setItem: vi.fn(() => {
        throw new Error("quota exceeded");
      })
    };
    vi.stubGlobal("window", { localStorage });

    expect(() => saveSettings(DEFAULT_APP_SETTINGS)).not.toThrow();
  });
});
