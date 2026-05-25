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

const hasAny = (tags: Record<string, string>, keys: string[]) =>
  keys.some((key) => has(tags, key));

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

const CHAIN_RESTAURANT_AMENITIES = ["fast_food", "food_court"];
const CHAIN_RESTAURANT_TAGS = [
  "brand",
  "brand:en",
  "brand:zh",
  "brand:zh-Hant",
  "brand:wikidata",
  "franchise"
];

const CAFE_AMENITIES = ["cafe", "ice_cream"];
const CAFE_SHOPS = ["coffee", "tea", "beverages", "ice_cream"];
const NIGHTLIFE_AMENITIES = ["bar", "pub", "biergarten", "nightclub"];

const TRAFFIC_RAILWAY = ["station", "halt", "tram_stop", "subway_entrance"];
const TRAFFIC_AMENITIES = ["bus_station", "ferry_terminal"];
const TRAFFIC_BUILDINGS = ["train_station", "transportation"];

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

const COMMERCIAL_HIGH_RISE_BUILDINGS = ["commercial", "office", "retail"];
const HOTEL_MIXED_USE_BUILDINGS = ["hotel", "mixed_use"];
const RESIDENTIAL_HIGH_RISE_BUILDINGS = [
  "apartments",
  "detached",
  "dormitory",
  "house",
  "residential",
  "semidetached_house",
  "terrace"
];

const TOURISM_ATTRACTIONS = [
  "attraction",
  "viewpoint",
  "museum",
  "gallery",
  "zoo",
  "theme_park"
];

const WATER_FEATURE_NATURAL = ["waterfall", "spring", "bay"];
const WATER_BODY_VALUES = [
  "basin",
  "fishpond",
  "lagoon",
  "lake",
  "moat",
  "oxbow",
  "pond",
  "reflecting_pool",
  "reservoir"
];
const WATERWAY_VALUES = ["river", "stream", "canal"];

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

const matchesFastFoodOrChainRestaurant = (tags: Record<string, string>) =>
  matchAny(tags, "amenity", CHAIN_RESTAURANT_AMENITIES) ||
  (tags.amenity === "restaurant" && hasAny(tags, CHAIN_RESTAURANT_TAGS));

const matchesRestaurant = (tags: Record<string, string>) =>
  tags.amenity === "restaurant" && !hasAny(tags, CHAIN_RESTAURANT_TAGS);

const matchesCafe = (tags: Record<string, string>) =>
  matchAny(tags, "amenity", CAFE_AMENITIES) ||
  matchAny(tags, "shop", CAFE_SHOPS);

const matchesNightlife = (tags: Record<string, string>) =>
  matchAny(tags, "amenity", NIGHTLIFE_AMENITIES);

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

const isHighRiseBuilding = (tags: Record<string, string>) =>
  has(tags, "building") && hasAtLeastLevels(tags, HIGH_RISE_MIN_LEVELS);

const matchesResidentialHighRise = (tags: Record<string, string>) =>
  isHighRiseBuilding(tags) &&
  matchAny(tags, "building", RESIDENTIAL_HIGH_RISE_BUILDINGS);

const matchesHotelOrMixedUseHighRise = (tags: Record<string, string>) =>
  isHighRiseBuilding(tags) &&
  !matchesInstitutionalTarget(tags) &&
  (matchAny(tags, "building", HOTEL_MIXED_USE_BUILDINGS) ||
    tags.tourism === "hotel");

const matchesCommercialHighRise = (tags: Record<string, string>) =>
  isHighRiseBuilding(tags) &&
  !matchesInstitutionalTarget(tags) &&
  !matchesResidentialHighRise(tags) &&
  !matchesHotelOrMixedUseHighRise(tags) &&
  (matchAny(tags, "building", COMMERCIAL_HIGH_RISE_BUILDINGS) ||
    has(tags, "office") ||
    has(tags, "shop"));

const matchesHistoric = (tags: Record<string, string>) => has(tags, "historic");

const matchesTourismAttraction = (tags: Record<string, string>) =>
  matchAny(tags, "tourism", TOURISM_ATTRACTIONS) && !matchesHistoric(tags);

const matchesWaterFeature = (tags: Record<string, string>) =>
  matchAny(tags, "natural", WATER_FEATURE_NATURAL) ||
  (tags.natural === "water" &&
    (!tags.water || WATER_BODY_VALUES.includes(tags.water))) ||
  matchAny(tags, "water", WATER_BODY_VALUES) ||
  tags.waterway === "waterfall";

const matchesWaterway = (tags: Record<string, string>) =>
  matchAny(tags, "waterway", WATERWAY_VALUES) ||
  matchAny(tags, "water", WATERWAY_VALUES);

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
    label: "咖啡/茶飲",
    description: "咖啡廳、茶飲、飲料與冰品店",
    color: "#8b6f47",
    overpassFilters: [
      '["amenity"~"^(cafe|ice_cream)$"]',
      '["shop"~"^(coffee|tea|beverages|ice_cream)$"]'
    ],
    matches: matchesCafe
  },
  {
    id: "nightlife",
    label: "酒吧/夜生活",
    description: "酒吧、酒館、啤酒花園與夜店",
    color: "#7b4ca0",
    overpassFilters: ['["amenity"~"^(bar|pub|biergarten|nightclub)$"]'],
    matches: matchesNightlife
  },
  {
    id: "restaurant",
    label: "餐廳",
    description: "一般餐廳，排除有品牌標籤的連鎖餐飲",
    color: "#c84f3f",
    overpassFilters: [
      '["amenity"="restaurant"][!"brand"][!"brand:en"][!"brand:zh"][!"brand:zh-Hant"][!"brand:wikidata"][!"franchise"]'
    ],
    matches: matchesRestaurant
  },
  {
    id: "fast-food-chain",
    label: "速食/連鎖餐飲集團",
    description: "速食、美食廣場與有品牌標籤的連鎖餐飲",
    color: "#e07a35",
    overpassFilters: [
      '["amenity"~"^(fast_food|food_court)$"]',
      '["amenity"="restaurant"]["brand"]',
      '["amenity"="restaurant"]["brand:en"]',
      '["amenity"="restaurant"]["brand:zh"]',
      '["amenity"="restaurant"]["brand:zh-Hant"]',
      '["amenity"="restaurant"]["brand:wikidata"]',
      '["amenity"="restaurant"]["franchise"]'
    ],
    matches: matchesFastFoodOrChainRestaurant
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
    description: "鐵路、捷運、輕軌、纜車、公車轉運站與交通建築，不含停車場",
    color: "#4169a8",
    overpassFilters: [
      '["railway"~"^(station|halt|tram_stop|subway_entrance)$"]',
      '["public_transport"="station"]',
      '["amenity"~"^(bus_station|ferry_terminal)$"]',
      '["aerialway"="station"]',
      '["building"~"^(train_station|transportation)$"]'
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
    label: "商辦/商業",
    description: `${HIGH_RISE_MIN_LEVELS} 層以上的商業、辦公與零售建築，排除住宅高樓`,
    color: "#5c6470",
    broad: true,
    overpassFilters: [
      `["building"~"^(commercial|office|retail)$"]["building:levels"](if:number(t["building:levels"]) >= ${HIGH_RISE_MIN_LEVELS})`,
      `["office"]["building"]["building:levels"](if:number(t["building:levels"]) >= ${HIGH_RISE_MIN_LEVELS})`,
      `["shop"]["building"]["building:levels"](if:number(t["building:levels"]) >= ${HIGH_RISE_MIN_LEVELS})`
    ],
    matches: matchesCommercialHighRise
  },
  {
    id: "hotel-mixed-use",
    label: "旅館/複合大樓",
    description: `${HIGH_RISE_MIN_LEVELS} 層以上的旅館與複合用途大樓`,
    color: "#7f6b54",
    broad: true,
    overpassFilters: [
      `["building"~"^(hotel|mixed_use)$"]["building:levels"](if:number(t["building:levels"]) >= ${HIGH_RISE_MIN_LEVELS})`,
      `["tourism"="hotel"]["building"]["building:levels"](if:number(t["building:levels"]) >= ${HIGH_RISE_MIN_LEVELS})`
    ],
    matches: matchesHotelOrMixedUseHighRise
  },
  {
    id: "attraction",
    label: "觀光景點/展館",
    description: "觀光景點、展館、觀景點與遊樂設施，排除古蹟歷史類",
    color: "#2e7d69",
    overpassFilters: [
      '["tourism"~"^(attraction|viewpoint|museum|gallery|zoo|theme_park)$"][!"historic"]'
    ],
    matches: matchesTourismAttraction
  },
  {
    id: "historic",
    label: "古蹟/歷史",
    description: "古蹟、歷史建築、紀念物與其他歷史地點",
    color: "#8a6a3a",
    overpassFilters: ['["historic"]'],
    matches: matchesHistoric
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
    label: "瀑布/泉水/湖泊水體",
    description: "瀑布、泉水、海灣、湖泊、池塘與水庫等水體",
    color: "#2f7fc1",
    overpassFilters: [
      '["natural"~"^(waterfall|spring|bay)$"]',
      '["natural"="water"][!"water"]',
      '["water"~"^(basin|fishpond|lagoon|lake|moat|oxbow|pond|reflecting_pool|reservoir)$"]',
      '["waterway"="waterfall"]'
    ],
    matches: matchesWaterFeature
  },
  {
    id: "waterway",
    label: "河流/水道",
    description: "河流、溪流、運河與其他線狀水道",
    color: "#1b6f8f",
    overpassFilters: [
      '["waterway"~"^(river|stream|canal)$"]',
      '["water"~"^(river|stream|canal)$"]'
    ],
    matches: matchesWaterway
  }
];

export const DEFAULT_CATEGORY_IDS = ["religion"];

export const categoryById = (id: string) =>
  POI_CATEGORIES.find((category) => category.id === id);
