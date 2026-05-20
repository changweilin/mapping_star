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

const HIGH_RISE_MIN_LEVELS = 16;

const RELIGIOUS_BUILDINGS = [
  "temple",
  "church",
  "chapel",
  "shrine",
  "mosque",
  "synagogue"
];

const PUBLIC_AMENITIES = [
  "townhall",
  "courthouse",
  "police",
  "fire_station",
  "post_office",
  "ranger_station",
  "public_building",
  "community_centre",
  "library"
];

const PUBLIC_BUILDINGS = [
  "government",
  "civic",
  "public",
  "fire_station",
  "police",
  "post_office",
  "courthouse"
];

const TRAFFIC_RAILWAY = ["station", "halt", "tram_stop", "subway_entrance"];
const TRAFFIC_AMENITIES = ["bus_station", "ferry_terminal"];
const TRAFFIC_BUILDINGS = [
  "train_station",
  "transportation",
  "parking",
  "garage",
  "garages"
];

const MEDICAL_AMENITIES = ["hospital", "clinic", "doctors", "dentist"];
const MEDICAL_HEALTHCARE = [
  "hospital",
  "clinic",
  "doctor",
  "doctors",
  "dentist",
  "medical_centre"
];
const MEDICAL_BUILDINGS = ["hospital", "clinic"];

const EDUCATION_AMENITIES = [
  "school",
  "university",
  "college",
  "kindergarten",
  "research_institute"
];
const EDUCATION_BUILDINGS = ["school", "university", "college", "kindergarten"];
const EDUCATION_OFFICES = ["educational_institution", "research"];

const hasAtLeastLevels = (tags: Record<string, string>, minLevels: number) =>
  leadingNumber(tags["building:levels"]) >= minLevels;

const matchesReligion = (tags: Record<string, string>) =>
  matchAny(tags, "amenity", ["place_of_worship", "monastery"]) ||
  matchAny(tags, "building", RELIGIOUS_BUILDINGS) ||
  has(tags, "religion");

const matchesPublicBuilding = (tags: Record<string, string>) =>
  tags.office === "government" ||
  has(tags, "government") ||
  matchAny(tags, "amenity", PUBLIC_AMENITIES) ||
  matchAny(tags, "building", PUBLIC_BUILDINGS);

const matchesTraffic = (tags: Record<string, string>) =>
  matchAny(tags, "railway", TRAFFIC_RAILWAY) ||
  tags.public_transport === "station" ||
  matchAny(tags, "amenity", TRAFFIC_AMENITIES) ||
  tags.aerialway === "station" ||
  matchAny(tags, "building", TRAFFIC_BUILDINGS);

const matchesMedical = (tags: Record<string, string>) =>
  matchAny(tags, "amenity", MEDICAL_AMENITIES) ||
  matchAny(tags, "healthcare", MEDICAL_HEALTHCARE) ||
  matchAny(tags, "building", MEDICAL_BUILDINGS);

const matchesEducation = (tags: Record<string, string>) =>
  matchAny(tags, "amenity", EDUCATION_AMENITIES) ||
  matchAny(tags, "building", EDUCATION_BUILDINGS) ||
  matchAny(tags, "office", EDUCATION_OFFICES);

const matchesInstitutionalTarget = (tags: Record<string, string>) =>
  matchesReligion(tags) ||
  matchesPublicBuilding(tags) ||
  matchesTraffic(tags) ||
  matchesMedical(tags) ||
  matchesEducation(tags);

export const POI_CATEGORIES: PoiCategory[] = [
  {
    id: "religion",
    label: "寺廟/宗教",
    description: "神社、佛寺、教堂、修道院與其他宗教建築",
    color: "#b94b7a",
    overpassFilters: [
      '["amenity"~"^(place_of_worship|monastery)$"]',
      '["building"~"^(temple|church|chapel|shrine|mosque|synagogue)$"]'
    ],
    matches: matchesReligion
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
    id: "government",
    label: "公共建築",
    description: "政府機關、行政單位、警消、法院、圖書館與公共設施",
    color: "#55779f",
    overpassFilters: [
      '["office"="government"]',
      '["government"]',
      '["amenity"~"^(townhall|courthouse|police|fire_station|post_office|ranger_station|public_building|community_centre|library)$"]',
      '["building"~"^(government|civic|public|fire_station|police|post_office|courthouse)$"]'
    ],
    matches: matchesPublicBuilding
  },
  {
    id: "station",
    label: "交通",
    description: "鐵路、捷運、輕軌、纜車、公車轉運站與交通建築",
    color: "#4169a8",
    overpassFilters: [
      '["railway"~"^(station|halt|tram_stop|subway_entrance)$"]',
      '["public_transport"="station"]',
      '["amenity"~"^(bus_station|ferry_terminal)$"]',
      '["aerialway"="station"]',
      '["building"~"^(train_station|transportation|parking|garage|garages)$"]'
    ],
    matches: matchesTraffic
  },
  {
    id: "medical",
    label: "醫療建築",
    description: "醫院、診所、牙醫與主要醫療服務建築",
    color: "#b94d58",
    overpassFilters: [
      '["amenity"~"^(hospital|clinic|doctors|dentist)$"]',
      '["healthcare"~"^(hospital|clinic|doctor|doctors|dentist|medical_centre)$"]',
      '["building"~"^(hospital|clinic)$"]'
    ],
    matches: matchesMedical
  },
  {
    id: "education",
    label: "學校/學術",
    description: "學校、大學、幼兒園、研究機構與教育單位",
    color: "#6a62ad",
    overpassFilters: [
      '["amenity"~"^(school|university|college|kindergarten|research_institute)$"]',
      '["building"~"^(school|university|college|kindergarten)$"]',
      '["office"~"^(educational_institution|research)$"]'
    ],
    matches: matchesEducation
  },
  {
    id: "building",
    label: "商辦/高樓",
    description: `${HIGH_RISE_MIN_LEVELS} 層以上，且排除宗教、公共、交通、醫療與學校類目標`,
    color: "#5c6470",
    broad: true,
    overpassFilters: [
      `["building"]["building:levels"](if:number(t["building:levels"]) >= ${HIGH_RISE_MIN_LEVELS})`
    ],
    matches: (tags) =>
      has(tags, "building") &&
      hasAtLeastLevels(tags, HIGH_RISE_MIN_LEVELS) &&
      !matchesInstitutionalTarget(tags)
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
