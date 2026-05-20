import type { PoiCategory } from "../types";

const has = (tags: Record<string, string>, key: string, values?: string[]) => {
  const value = tags[key];
  if (!value) return false;
  return values ? values.includes(value) : true;
};

const matchAny = (
  tags: Record<string, string>,
  key: string,
  values: string[]
) => values.includes(tags[key]);

export const POI_CATEGORIES: PoiCategory[] = [
  {
    id: "religion",
    label: "寺廟/宗教",
    description: "神社、佛寺、教堂、修道院與其他宗教建築",
    color: "#b94b7a",
    overpassFilters: [
      '["amenity"~"^(place_of_worship|monastery)$"]',
      '["building"~"^(temple|church|chapel|shrine|mosque|synagogue)$"]',
      '["religion"]'
    ],
    matches: (tags) =>
      matchAny(tags, "amenity", ["place_of_worship", "monastery"]) ||
      matchAny(tags, "building", [
        "temple",
        "church",
        "chapel",
        "shrine",
        "mosque",
        "synagogue"
      ]) ||
      has(tags, "religion")
  },
  {
    id: "shop",
    label: "商店",
    description: "一般店鋪與零售設施",
    color: "#d8842f",
    broad: true,
    overpassFilters: ['["shop"]'],
    matches: (tags) => has(tags, "shop")
  },
  {
    id: "cafe",
    label: "咖啡/飲料",
    description: "咖啡廳、酒吧、飲料、茶與冰品店",
    color: "#8b6f47",
    overpassFilters: [
      '["amenity"~"^(cafe|bar|pub|biergarten|ice_cream)$"]',
      '["shop"~"^(coffee|tea|beverages|ice_cream)$"]'
    ],
    matches: (tags) =>
      matchAny(tags, "amenity", [
        "cafe",
        "bar",
        "pub",
        "biergarten",
        "ice_cream"
      ]) || matchAny(tags, "shop", ["coffee", "tea", "beverages", "ice_cream"])
  },
  {
    id: "restaurant",
    label: "餐廳",
    description: "餐廳、速食與美食廣場",
    color: "#c84f3f",
    overpassFilters: ['["amenity"~"^(restaurant|fast_food|food_court)$"]'],
    matches: (tags) =>
      matchAny(tags, "amenity", ["restaurant", "fast_food", "food_court"])
  },
  {
    id: "building",
    label: "建築",
    description: "OSM 有標記的建築輪廓或建物中心",
    color: "#5c6470",
    broad: true,
    overpassFilters: ['["building"]'],
    matches: (tags) => has(tags, "building")
  },
  {
    id: "attraction",
    label: "景點",
    description: "觀光景點、展館、觀景點與遊樂設施",
    color: "#2e7d69",
    overpassFilters: [
      '["tourism"~"^(attraction|viewpoint|museum|gallery|zoo|theme_park)$"]',
      '["historic"]'
    ],
    matches: (tags) =>
      matchAny(tags, "tourism", [
        "attraction",
        "viewpoint",
        "museum",
        "gallery",
        "zoo",
        "theme_park"
      ]) || has(tags, "historic")
  },
  {
    id: "park",
    label: "公園",
    description: "公園、花園、自然保護區與國家公園",
    color: "#3e8b3f",
    overpassFilters: [
      '["leisure"~"^(park|garden)$"]',
      '["boundary"="national_park"]',
      '["protect_class"]'
    ],
    matches: (tags) =>
      matchAny(tags, "leisure", ["park", "garden"]) ||
      tags.boundary === "national_park" ||
      has(tags, "protect_class")
  },
  {
    id: "peak",
    label: "山頂",
    description: "山峰、鞍部與自然地形高點",
    color: "#7b5f36",
    overpassFilters: ['["natural"~"^(peak|saddle|volcano)$"]'],
    matches: (tags) =>
      matchAny(tags, "natural", ["peak", "saddle", "volcano"])
  },
  {
    id: "water",
    label: "水域",
    description: "瀑布、湖泊、池塘、水庫、泉水與水道",
    color: "#2f7fc1",
    overpassFilters: [
      '["natural"~"^(water|waterfall|spring|bay)$"]',
      '["water"]',
      '["waterway"~"^(waterfall|river|stream|canal)$"]'
    ],
    matches: (tags) =>
      matchAny(tags, "natural", ["water", "waterfall", "spring", "bay"]) ||
      has(tags, "water") ||
      matchAny(tags, "waterway", ["waterfall", "river", "stream", "canal"])
  }
];

export const DEFAULT_CATEGORY_IDS = [
  "religion",
  "cafe",
  "restaurant",
  "attraction",
  "park",
  "peak",
  "water"
];

export const categoryById = (id: string) =>
  POI_CATEGORIES.find((category) => category.id === id);
