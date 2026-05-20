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

const leadingNumber = (value: string | undefined) => {
  const match = value?.trim().match(/^-?\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : NaN;
};

const hasMoreThanSixLevels = (tags: Record<string, string>) =>
  leadingNumber(tags["building:levels"]) > 6;

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
    id: "convenience",
    label: "便利商店",
    description: "便利商店、小型日用品店與雜貨店",
    color: "#d8842f",
    overpassFilters: ['["shop"~"^(convenience|variety_store)$"]'],
    matches: (tags) => matchAny(tags, "shop", ["convenience", "variety_store"])
  },
  {
    id: "market",
    label: "賣場",
    description: "超市、量販店、百貨商場、購物中心與市場",
    color: "#a45b2a",
    overpassFilters: [
      '["shop"~"^(supermarket|department_store|mall|wholesale|general)$"]',
      '["amenity"="marketplace"]'
    ],
    matches: (tags) =>
      matchAny(tags, "shop", [
        "supermarket",
        "department_store",
        "mall",
        "wholesale",
        "general"
      ]) || tags.amenity === "marketplace"
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
    description: "OSM 有標記且 building:levels 高於 6 的高樓建築",
    color: "#5c6470",
    broad: true,
    overpassFilters: [
      '["building"]["building:levels"](if:number(t["building:levels"]) > 6)'
    ],
    matches: (tags) => has(tags, "building") && hasMoreThanSixLevels(tags)
  },
  {
    id: "government",
    label: "政府",
    description: "各級政府機關、行政單位、警消、法院與公務設施",
    color: "#55779f",
    overpassFilters: [
      '["office"="government"]',
      '["government"]',
      '["amenity"~"^(townhall|courthouse|police|fire_station|post_office|ranger_station|public_building)$"]',
      '["building"~"^(government|civic|public)$"]'
    ],
    matches: (tags) =>
      tags.office === "government" ||
      has(tags, "government") ||
      matchAny(tags, "amenity", [
        "townhall",
        "courthouse",
        "police",
        "fire_station",
        "post_office",
        "ranger_station",
        "public_building"
      ]) ||
      matchAny(tags, "building", ["government", "civic", "public"])
  },
  {
    id: "station",
    label: "車站",
    description: "鐵路、捷運、輕軌、纜車與公車轉運車站",
    color: "#4169a8",
    overpassFilters: [
      '["railway"~"^(station|halt|tram_stop|subway_entrance)$"]',
      '["public_transport"="station"]',
      '["amenity"="bus_station"]',
      '["aerialway"="station"]'
    ],
    matches: (tags) =>
      matchAny(tags, "railway", [
        "station",
        "halt",
        "tram_stop",
        "subway_entrance"
      ]) ||
      tags.public_transport === "station" ||
      tags.amenity === "bus_station" ||
      tags.aerialway === "station"
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
    label: "山峰",
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

export const DEFAULT_CATEGORY_IDS = ["religion"];

export const categoryById = (id: string) =>
  POI_CATEGORIES.find((category) => category.id === id);
