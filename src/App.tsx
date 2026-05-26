import {
  type ChangeEvent,
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent,
  type TouchEvent,
  type WheelEvent,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState
} from "react";
import L from "leaflet";
import {
  ChevronDown,
  ChevronUp,
  Crosshair,
  Download,
  LocateFixed,
  Map as MapIcon,
  MapPin,
  Moon,
  Mountain,
  Pause,
  Play,
  Satellite,
  Search,
  Sparkles,
  Star,
  Sun,
  Trash2,
  UserRound
} from "lucide-react";
import {
  DrawSummaryDetails,
  getSearchStrategyLabel,
  type DrawSummary
} from "./components/DrawSummaryDetails";
import { MarqueeSelect } from "./components/MarqueeSelect";
import { PlaceCandidateList } from "./components/PlaceCandidateList";
import { RadiusRangeControl } from "./components/RadiusRangeControl";
import { ResultAggregateSummary } from "./components/ResultAggregateSummary";
import { ResultMetric } from "./components/ResultMetric";
import {
  ResultSortToolbar,
  type StarResultSortDirection,
  type StarResultSortKey
} from "./components/ResultSortToolbar";
import { SelectedPoiDetail } from "./components/SelectedPoiDetail";
import { POI_CATEGORIES } from "./data/categories";
import { exportGpx, exportKml, splitFavorites } from "./lib/exporters";
import {
  makePoiFavorite,
  makeStarFavorite,
  loadFavorites,
  saveFavorites
} from "./lib/favorites";
import {
  destinationPoint,
  formatDistance,
  normalizeDegrees
} from "./lib/geo";
import {
  getHexCellCenterPlanar as getHoneycombCellCenterPlanar,
  getHexRing as getHoneycombRing,
  getHexTargetRadiusMeters as getHoneycombTargetRadiusMeters,
  hexKey as getHoneycombCellKey,
  normalizeHexCellRadius as normalizeHoneycombCellRadius,
  pointToHex as honeycombPointToCell,
  toPlanarPoint as makeHoneycombPlanarPoint,
  type HexCell
} from "./lib/hexGrid";
import {
  getHoneycombSearchProfile,
  type HoneycombSearchProfile,
  type HoneycombTargetBand,
  type HoneycombTargetNode
} from "./lib/honeycombStrategy";
import { loadLastStar, saveLastStar } from "./lib/lastStar";
import {
  getMagicElement,
  getMagicAnimationOptions,
  MAGIC_SPEED_OPTIONS,
  ZODIAC_CONSTELLATIONS,
  makeMagicCircleStrokes,
  type MagicCircleStroke,
  type MagicCircleGeometryOptions,
  type MagicCombinedShape,
  type MagicGeometryPattern,
  type MagicSpeed
} from "./lib/magicCircle";
import {
  fetchPoisDetailed,
  fetchPoisForBoundsDetailed,
  overpassResultLimit,
  type OverpassBounds
} from "./lib/overpass";
import { searchPlaces } from "./lib/placeSearch";
import {
  DEFAULT_APP_SETTINGS,
  loadSettings,
  saveSettings,
  type MapLayerId
} from "./lib/settings";
import {
  maxAngleToleranceForMode,
  starModeLabel
} from "./lib/starPatterns";
import { formatClockTime, formatElapsedMs } from "./lib/timeFormat";
import {
  solveStarFromPois,
  solveStarFromPoisSteps,
  type SolveProgress
} from "./lib/solver";
import { makeAutomaticStarName } from "./lib/starNaming";
import type {
  FavoriteItem,
  LatLng,
  PlaceSearchResult,
  Poi,
  SearchStrategy,
  StarMode,
  StarResultAggregateStats,
  StarResult
} from "./types";

type MagicPlaybackMode = "single" | "continuous" | "loop-all" | "loop-one";
type MagicDrawShape =
  | "star"
  | "cross"
  | "bagua"
  | "rose"
  | "sierpinski"
  | "zodiac";
type MagicDrawVariantOption = {
  id: string;
  label: string;
  mode?: StarMode;
  geometryPattern: MagicGeometryPattern;
  geometryOptions?: MagicCircleGeometryOptions;
};
type MobileSettingsTab =
  | "search"
  | "categories"
  | "drawing"
  | "logs"
  | "results"
  | "favorites";

const DEFAULT_CENTER: LatLng = { lat: 25.033964, lng: 121.564468 };
const MAX_RENDERED_POIS = 350;
const MAX_RADIUS_KM = 30;
const MAX_STAR_RESULTS = 50;
const MAX_HONEYCOMB_PREVIEW_CELLS = 240;
const HONEYCOMB_BATCH_RESULT_LIMIT = 900;
const MAGIC_POINT_DELAY_MS = 1880;
const MAGIC_POINT_STEP_MS = 90;
const MAGIC_POINT_DURATION_MS = 520;
const MAGIC_TIMELINE_END_PADDING_MS = 140;
const MAGIC_SELECT_LONG_PRESS_MS = 360;
const MAGIC_SELECT_SCROLL_CANCEL_PX = 10;
const MAGIC_SELECT_TOUCH_STEP_PX = 26;
const MOBILE_SPLITTER_DOUBLE_TAP_MS = 320;
const MOBILE_SPLITTER_DOUBLE_TAP_PX = 14;
const MAGIC_PLAYBACK_MODES = [
  { id: "single", label: "單曲播放" },
  { id: "continuous", label: "連續播放" },
  { id: "loop-all", label: "循環播放" },
  { id: "loop-one", label: "單曲循環播放" }
] satisfies Array<{ id: MagicPlaybackMode; label: string }>;
const makeCombinedVariant = (
  id: string,
  label: string,
  mode: StarMode,
  combinedShape: MagicCombinedShape
): MagicDrawVariantOption => ({
  id,
  label,
  mode,
  geometryPattern: "combined",
  geometryOptions: { combinedShape }
});
const MAGIC_DRAW_SHAPE_OPTIONS = [
  { id: "star", label: "星芒" },
  { id: "cross", label: "十字星" },
  { id: "bagua", label: "八卦陣" },
  { id: "rose", label: "玫瑰曲線" },
  { id: "sierpinski", label: "Sierpinski 三角形" },
  { id: "zodiac", label: "星座" }
] satisfies Array<{ id: MagicDrawShape; label: string }>;
const MAGIC_DRAW_VARIANT_OPTIONS = {
  star: [
    makeCombinedVariant("5", "5", 5, "star"),
    makeCombinedVariant("6", "6", 6, "star"),
    makeCombinedVariant("7", "7", 7, "star"),
    makeCombinedVariant("8", "8", 8, "star")
  ],
  cross: [makeCombinedVariant("4", "4", 4, "cross")],
  bagua: [makeCombinedVariant("8", "8", 8, "bagua")],
  rose: [2, 3, 4, 5, 6, 7, 8, 9].map((petalFactor): MagicDrawVariantOption => ({
    id: `k-${petalFactor}`,
    label:
      petalFactor % 2 === 0
        ? `k=${petalFactor} (${petalFactor * 2}瓣)`
        : `k=${petalFactor}`,
    geometryPattern: "rose",
    geometryOptions: { rosePetalFactor: petalFactor }
  })),
  sierpinski: [1, 2, 3, 4].map((depth): MagicDrawVariantOption => ({
    id: `d-${depth}`,
    label: `d=${depth}`,
    geometryPattern: "sierpinski",
    geometryOptions: { sierpinskiDepth: depth }
  })),
  zodiac: ZODIAC_CONSTELLATIONS.map(
    (constellation, index): MagicDrawVariantOption => ({
      id: `${index + 1}`,
      label: `${index + 1} ${constellation.name}`,
      geometryPattern: "zodiac",
      geometryOptions: { zodiacIndex: index }
    })
  )
} satisfies Record<MagicDrawShape, MagicDrawVariantOption[]>;
const DEFAULT_MAGIC_DRAW_VARIANTS = {
  star: "5",
  cross: "4",
  bagua: "8",
  rose: "k-7",
  sierpinski: "d-3",
  zodiac: "1"
} satisfies Record<MagicDrawShape, string>;

const MOBILE_SETTINGS_TABS = [
  { id: "search", label: "搜索中心" },
  { id: "categories", label: "目標類別" },
  { id: "drawing", label: "繪圖設定" },
  { id: "logs", label: "計算紀錄" },
  { id: "results", label: "繪圖結果" },
  { id: "favorites", label: "我的最愛" }
] satisfies Array<{ id: MobileSettingsTab; label: string }>;

const DEFAULT_DESKTOP_SECTION_EXPANSION = {
  search: true,
  categories: false,
  drawing: true,
  logs: true,
  results: true,
  favorites: false
} satisfies Record<MobileSettingsTab, boolean>;

const CATEGORY_GROUP_ORDER = [
  "人文觀光",
  "自然",
  "公共機構",
  "餐飲",
  "商業"
] as const;

const CATEGORY_GROUPS = CATEGORY_GROUP_ORDER.map((group) => ({
  group,
  categories: POI_CATEGORIES.filter((category) => category.group === group)
})).filter(({ categories }) => categories.length > 0);

type MagicPlayback = "playing" | "paused" | "ended";
type MagicPlaybackDirection = "forward" | "reverse";
type MagicSymbolStroke = Extract<MagicCircleStroke, { kind: "symbol" }>;
type MagicSelectTouchState = {
  startY: number;
  lastStepY: number;
  isLongPressActive: boolean;
  timerId: number | null;
};
type MobileSettingsSwipeState = {
  isSwipeGesture: boolean;
  startX: number;
  startY: number;
};
type MagicSelectTouchRef = {
  current: MagicSelectTouchState | null;
};
type MagicSelectScrollLockState = {
  bodyOverflow: string;
  bodyTouchAction: string;
  htmlOverflow: string;
};
type MobileSplitterTapState = {
  atMs: number;
  pointerType: string;
  x: number;
  y: number;
};
type CalculationProgress = {
  label: string;
  percent: number;
};
type HoneycombPreviewCell = {
  key: string;
  order: number;
  ring: number;
  center: LatLng;
  targetCenter: LatLng;
  targetLabel: string;
  polygon: LatLng[];
};
type HoneycombSearchBatch = {
  cells: HoneycombPreviewCell[];
  isInitial: boolean;
  label: string;
};
type HoneycombPreviewParams = {
  mode: StarMode;
  center: LatLng;
  innerRadiusMeters: number;
  outerRadiusMeters: number;
  rotationStepDeg: number;
  hexCellRadiusMeters: number;
  priorityRings: number;
  rotationSpanDeg?: number;
  targetBands: HoneycombTargetBand[];
  targetNodes: HoneycombTargetNode[];
};
type HoneycombSearchBatchParams = HoneycombPreviewParams & {
  initialCellCount: number;
  cellsPerBatch: number;
};
type CalculationRecord = {
  id: string;
  status: "completed" | "empty" | "cancelled" | "failed";
  sourceLabel: string;
  title: string;
  message: string;
  startedAtIso: string;
  finishedAtIso: string;
  totalElapsedMs: number;
  summary: DrawSummary | null;
};
type CompletionNotice = {
  id: string;
  title: string;
  message: string;
};
type MapTileLayerConfig = {
  url: string;
  options: L.TileLayerOptions;
};

const MAP_LAYER_OPTIONS = [
  { id: "street", label: "街道", Icon: MapIcon },
  { id: "terrain", label: "地形", Icon: Mountain },
  { id: "satellite", label: "衛星", Icon: Satellite }
] satisfies Array<{
  id: MapLayerId;
  label: string;
  Icon: typeof MapIcon;
}>;

const MAP_TILE_LAYERS: Record<MapLayerId, MapTileLayerConfig> = {
  street: {
    url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    options: {
      maxZoom: 19,
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
    }
  },
  terrain: {
    url: "https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png",
    options: {
      maxZoom: 19,
      maxNativeZoom: 17,
      attribution:
        'Map data: &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>, SRTM | Map style: &copy; <a href="https://opentopomap.org">OpenTopoMap</a>'
    }
  },
  satellite: {
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    options: {
      maxZoom: 19,
      attribution:
        'Tiles &copy; Esri, Maxar, Earthstar Geographics, and the GIS User Community'
    }
  }
};

const ABOUT_LINKS = [
  {
    label: "GitHub",
    href: "https://github.com/changweilin",
    favicon:
      "https://www.google.com/s2/favicons?domain_url=https://github.com/changweilin&sz=32"
  },
  {
    label: "LinkedIn",
    href: "https://www.linkedin.com/in/wei-lin-chang-ba38049a/",
    favicon:
      "https://www.google.com/s2/favicons?domain_url=https://www.linkedin.com/in/wei-lin-chang-ba38049a/&sz=32"
  },
  {
    label: "Demo Link",
    href: "https://changweilin.github.io/demo_link/",
    favicon:
      "https://www.google.com/s2/favicons?domain_url=https://changweilin.github.io/demo_link/&sz=32"
  }
];

const createBaseTileLayer = (layerId: MapLayerId) => {
  const config = MAP_TILE_LAYERS[layerId];

  return L.tileLayer(config.url, {
    ...config.options,
    className: `map-base-tile map-base-tile--${layerId}`
  });
};

const formatCoordinate = ({ lat, lng }: LatLng) =>
  `${lat.toFixed(6)}, ${lng.toFixed(6)}`;

const formatDegrees = (value: number) => `${normalizeDegrees(value).toFixed(1)}°`;

const getStarCenterErrorMeters = (result: StarResult) =>
  typeof result.centerErrorMeters === "number" &&
  Number.isFinite(result.centerErrorMeters)
    ? result.centerErrorMeters
    : 0;

const compareNumber = (left: number, right: number) => {
  const delta = left - right;
  return Math.abs(delta) > 0.000001 ? delta : 0;
};

const compareStarResultsByScore = (left: StarResult, right: StarResult) =>
  compareNumber(left.score, right.score) ||
  compareNumber(left.radiusStdMeters, right.radiusStdMeters) ||
  compareNumber(getStarCenterErrorMeters(left), getStarCenterErrorMeters(right)) ||
  left.id.localeCompare(right.id);

const sortStarResults = (
  results: StarResult[],
  sortKey: StarResultSortKey,
  direction: StarResultSortDirection
) => {
  const sorted = [...results].sort((left, right) => {
    switch (sortKey) {
      case "radius":
        return (
          compareNumber(left.radiusMeanMeters, right.radiusMeanMeters) ||
          compareStarResultsByScore(left, right)
        );
      case "angle":
        return (
          compareNumber(
            normalizeDegrees(left.rotationDeg),
            normalizeDegrees(right.rotationDeg)
          ) || compareStarResultsByScore(left, right)
        );
      case "circumference-error":
        return (
          compareNumber(left.radiusStdMeters, right.radiusStdMeters) ||
          compareStarResultsByScore(left, right)
        );
      case "center-error":
        return (
          compareNumber(
            getStarCenterErrorMeters(left),
            getStarCenterErrorMeters(right)
          ) || compareStarResultsByScore(left, right)
        );
      case "score":
      default:
        return compareStarResultsByScore(left, right);
    }
  });
  return direction === "asc" ? sorted : sorted.reverse();
};

const averageStarResultValue = (
  results: StarResult[],
  getValue: (result: StarResult) => number
) =>
  results.length === 0
    ? 0
    : results.reduce((total, result) => total + getValue(result), 0) /
      results.length;

const getStarResultAggregateStats = (
  results: StarResult[]
): StarResultAggregateStats | null => {
  if (results.length === 0) return null;

  return {
    count: results.length,
    averageRadiusMeters: averageStarResultValue(
      results,
      (result) => result.radiusMeanMeters
    ),
    averageCircumferenceErrorMeters: averageStarResultValue(
      results,
      (result) => result.radiusStdMeters
    ),
    averageAngleErrorDeg: averageStarResultValue(
      results,
      (result) => result.angleErrorDeg
    ),
    averageCenterErrorMeters: averageStarResultValue(
      results,
      getStarCenterErrorMeters
    ),
    averageScore: averageStarResultValue(results, (result) => result.score)
  };
};

const getNowMs = () =>
  typeof performance === "undefined" ? Date.now() : performance.now();

const getStarModeLabel = starModeLabel;

const isMagicDrawShape = (value: string): value is MagicDrawShape =>
  MAGIC_DRAW_SHAPE_OPTIONS.some((option) => option.id === value);

const getMagicDrawShapeForMode = (mode: StarMode): MagicDrawShape =>
  mode === 4 ? "cross" : mode === 8 ? "bagua" : "star";

const getMagicDrawVariantOption = (
  shape: MagicDrawShape,
  value: string | undefined
) => {
  const options = MAGIC_DRAW_VARIANT_OPTIONS[shape];
  return options.find((option) => option.id === value) ?? options[0]!;
};

const makeInitialMagicDrawVariants = (mode: StarMode) => {
  const shape = getMagicDrawShapeForMode(mode);
  return {
    ...DEFAULT_MAGIC_DRAW_VARIANTS,
    [shape]: String(mode)
  };
};

const formatDrawSummaryProgressLabel = (summary: DrawSummary) =>
  summary.resultCount > 0
    ? `魔法陣完成 · ${summary.resultCount} 組 · ${formatElapsedMs(
        summary.totalElapsedMs
      )}`
    : `計算完成 · 0 組 · ${formatElapsedMs(summary.totalElapsedMs)}`;

const formatDrawSummaryStatus = (summary: DrawSummary) => {
  const starLabel = getStarModeLabel(summary.mode);
  const firstResultText =
    summary.firstResultElapsedMs === null
      ? "未產生第一個魔法陣"
      : `${formatElapsedMs(summary.firstResultElapsedMs)}（${formatClockTime(
          summary.firstResultAtIso
        )}）`;
  const resultText =
    summary.resultCount > 0
      ? `共找到 ${summary.resultCount} 組${starLabel}魔法陣`
      : `未找到符合條件的${starLabel}魔法陣`;
  const warningText =
    summary.warningCount > 0 ? `；另有 ${summary.warningCount} 則提醒` : "";

  return `${summary.sourceLabel}完成：首個 ${firstResultText}，總耗時 ${formatElapsedMs(
    summary.totalElapsedMs
  )}，${resultText}。候選點 ${summary.eligiblePoiCount}/${
    summary.totalPoiCount
  }，範圍 ${summary.radiusRangeLabel}，策略 ${getSearchStrategyLabel(
    summary
  )}${warningText}。`;
};

const interpolateProgress = (
  startPercent: number,
  endPercent: number,
  completed: number,
  total: number
) => {
  const ratio = total <= 0 ? 0 : Math.max(0, Math.min(1, completed / total));
  return startPercent + (endPercent - startPercent) * ratio;
};

const getCategoryDownloadProgressPercent = (
  searchStrategy: SearchStrategy,
  completedCategories: number,
  totalCategories: number
) =>
  searchStrategy === "honeycomb"
    ? interpolateProgress(34, 58, completedCategories, totalCategories)
    : interpolateProgress(34, 66, completedCategories, totalCategories);

const getAnalyzeProgressPercent = (searchStrategy: SearchStrategy) =>
  searchStrategy === "honeycomb" ? 62 : 68;

const getSolveProgressPercent = (
  searchStrategy: SearchStrategy,
  progress: SolveProgress
) =>
  searchStrategy === "honeycomb"
    ? interpolateProgress(64, 90, progress.completedSteps, progress.totalSteps)
    : interpolateProgress(70, 88, progress.completedSteps, progress.totalSteps);

const getSolveProgressLabel = (progress: SolveProgress) => {
  const resultText =
    progress.results.length > 0 ? ` · 暫得 ${progress.results.length} 組` : "";
  return `${progress.label}${resultText}`;
};

const makeCalculationRecordFromSummary = (
  summary: DrawSummary
): CalculationRecord => {
  const status = summary.resultCount > 0 ? "completed" : "empty";

  return {
    id: summary.id,
    status,
    sourceLabel: summary.sourceLabel,
    title:
      status === "completed"
        ? `${summary.sourceLabel}完成`
        : `${summary.sourceLabel}完成，尚無魔法陣`,
    message: formatDrawSummaryStatus(summary),
    startedAtIso: summary.startedAtIso,
    finishedAtIso: summary.finishedAtIso,
    totalElapsedMs: summary.totalElapsedMs,
    summary
  };
};

const makeCalculationMessageRecord = ({
  status,
  sourceLabel,
  title,
  message,
  startedAtIso,
  startedAtMs,
  finishedAtMs
}: {
  status: "cancelled" | "failed";
  sourceLabel: string;
  title: string;
  message: string;
  startedAtIso: string;
  startedAtMs: number;
  finishedAtMs: number;
}): CalculationRecord => ({
  id: `calculation-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  status,
  sourceLabel,
  title,
  message,
  startedAtIso,
  finishedAtIso: new Date().toISOString(),
  totalElapsedMs: finishedAtMs - startedAtMs,
  summary: null
});

const mergePois = (currentPois: Poi[], nextPois: Poi[]) => {
  const byId = new Map(currentPois.map((poi) => [poi.id, poi]));
  nextPois.forEach((poi) => byId.set(poi.id, poi));
  return [...byId.values()];
};

const waitForPaint = () =>
  typeof window === "undefined"
    ? Promise.resolve()
    : new Promise<void>((resolve) => {
        window.requestAnimationFrame(() => {
          window.requestAnimationFrame(() => resolve());
        });
      });

const makeStarBounds = (result: StarResult) => {
  const bounds = L.latLngBounds(
    [
      [result.center.lat, result.center.lng],
      ...result.points.map((point) => [point.lat, point.lng])
    ] as L.LatLngExpression[]
  );
  const outerPointRadiusMeters = Math.max(
    result.radiusMeanMeters,
    ...result.points.map((point) => point.distanceMeters)
  );

  [0, 90, 180, 270].forEach((bearing) => {
    const edge = destinationPoint(result.center, outerPointRadiusMeters, bearing);
    bounds.extend([edge.lat, edge.lng]);
  });

  return bounds;
};

const makeRadiusBounds = (center: LatLng, radiusMeters: number) => {
  const bounds = L.latLngBounds([
    [center.lat, center.lng]
  ] as L.LatLngExpression[]);

  [0, 90, 180, 270].forEach((bearing) => {
    const edge = destinationPoint(center, radiusMeters, bearing);
    bounds.extend([edge.lat, edge.lng]);
  });

  return bounds;
};

const makeAutoSolveKey = ({
  mode,
  center,
  innerRadiusKm,
  outerRadiusKm,
  angleToleranceDeg,
  candidatesPerSlot,
  rotationStepDeg,
  searchStrategy,
  hexCellRadiusKm,
  honeycombProfileKey
}: {
  mode: StarMode;
  center: LatLng;
  innerRadiusKm: number;
  outerRadiusKm: number;
  angleToleranceDeg: number;
  candidatesPerSlot: number;
  rotationStepDeg: number;
  searchStrategy: SearchStrategy;
  hexCellRadiusKm: number;
  honeycombProfileKey: string;
}) =>
  [
    mode,
    center.lat,
    center.lng,
    innerRadiusKm,
    outerRadiusKm,
    angleToleranceDeg,
    candidatesPerSlot,
    rotationStepDeg,
    searchStrategy,
    hexCellRadiusKm,
    honeycombProfileKey
  ].join("|");

const makeCenterIcon = () =>
  L.divIcon({
    className: "center-pin",
    html: '<span class="center-pin__ring"></span><span class="center-pin__dot"></span>',
    iconSize: [30, 30],
    iconAnchor: [15, 15]
  });

const makeMagicSymbolHtml = (stroke: MagicSymbolStroke) =>
  `<span class="${stroke.className}"><span class="magic-symbol__aura"></span><span class="magic-symbol__trail"></span><span class="magic-symbol__glyph"></span></span>`;

const makeMagicSymbolIcon = (stroke: MagicSymbolStroke) =>
  L.divIcon({
    className: "magic-symbol-anchor",
    html: makeMagicSymbolHtml(stroke),
    iconSize: [0, 0],
    iconAnchor: [0, 0]
  });

const makeHoneycombOrderIcon = (order: number, isCompleted = false) =>
  L.divIcon({
    className: `honeycomb-order-marker${
      isCompleted ? " honeycomb-order-marker--completed" : ""
    }`,
    html: `<span class="honeycomb-order-marker__target"></span><span class="honeycomb-order-marker__number">${order}</span>`,
    iconSize: [26, 26],
    iconAnchor: [13, 13]
  });

const downloadText = (filename: string, content: string, type: string) => {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};

const formatMagicSpeed = (speed: MagicSpeed) => `${speed}x`;

const parseMagicSpeed = (value: string): MagicSpeed => {
  const numericValue = Number(value);
  return (
    MAGIC_SPEED_OPTIONS.find((option) => option === numericValue) ??
    MAGIC_SPEED_OPTIONS[0]
  );
};

const getMagicTimelineDurationMs = (
  result: StarResult,
  strokes: MagicCircleStroke[]
) => {
  const strokeEndMs = strokes.reduce(
    (latestEndMs, stroke) =>
      Math.max(latestEndMs, stroke.delayMs + stroke.durationMs),
    0
  );
  const pointEndMs =
    result.points.length > 0
      ? MAGIC_POINT_DELAY_MS +
        (result.points.length - 1) * MAGIC_POINT_STEP_MS +
        MAGIC_POINT_DURATION_MS
      : 0;

  return Math.max(strokeEndMs, pointEndMs);
};

const getMagicDelayMs = (
  delayMs: number,
  durationMs: number,
  direction: MagicPlaybackDirection,
  timelineDurationMs: number,
  timelinePositionMs: number
) => {
  const directedDelayMs =
    direction === "reverse"
      ? Math.max(0, timelineDurationMs - delayMs - durationMs)
      : delayMs;
  const directedPositionMs =
    direction === "reverse"
      ? Math.max(0, timelineDurationMs - timelinePositionMs)
      : timelinePositionMs;

  return directedDelayMs - directedPositionMs;
};

const clampMagicTimelinePosition = (positionMs: number, durationMs: number) =>
  Math.max(0, Math.min(durationMs, positionMs));

const getMagicBoundaryPosition = (
  direction: MagicPlaybackDirection,
  durationMs: number
) => (direction === "reverse" ? durationMs : 0);

const getSteppedOption = <T,>(
  options: readonly T[],
  value: T,
  step: number
) => {
  if (options.length === 0) return value;
  const currentIndex = Math.max(0, options.indexOf(value));
  return options[
    (currentIndex + step + options.length) % options.length
  ] as T;
};

const getLayerElement = (layer: L.Layer) => {
  const pathLayer = layer as L.Layer & {
    getElement?: () => HTMLElement | SVGElement | null;
  };

  return typeof pathLayer.getElement === "function"
    ? pathLayer.getElement()
    : null;
};

const setElementAnimationPlayback = (
  element: HTMLElement | SVGElement,
  playback: MagicPlayback,
  direction: MagicPlaybackDirection
) => {
  const animationPlayState =
    playback === "playing" ? "running" : "paused";
  const animationDirection =
    direction === "reverse" ? "reverse" : "normal";
  const applyAnimationState = (target: HTMLElement | SVGElement) => {
    target.style.animationPlayState = animationPlayState;
    target.style.animationDirection = animationDirection;
    if (direction === "reverse") {
      target.style.animationFillMode = "both";
    } else {
      target.style.removeProperty("animation-fill-mode");
    }
  };

  applyAnimationState(element);
  element
    .querySelectorAll<HTMLElement | SVGElement>("*")
    .forEach(applyAnimationState);
};

const applyMagicStrokeTiming = (
  layer: L.Layer,
  stroke: MagicCircleStroke,
  speed: MagicSpeed,
  playback: MagicPlayback,
  direction: MagicPlaybackDirection,
  timelineDurationMs: number,
  timelinePositionMs: number
) => {
  const element = getLayerElement(layer);
  if (!element) return;

  element.classList.add("magic-drawable");
  if (stroke.kind !== "symbol" && element instanceof SVGElement) {
    element.setAttribute("pathLength", "1");
  }
  element.style.setProperty(
    "--magic-delay",
    `${
      getMagicDelayMs(
        stroke.delayMs,
        stroke.durationMs,
        direction,
        timelineDurationMs,
        timelinePositionMs
      ) / speed
    }ms`
  );
  element.style.setProperty(
    "--magic-duration",
    `${stroke.durationMs / speed}ms`
  );
  if (stroke.kind === "symbol") {
    element.style.setProperty("--magic-symbol-size", `${stroke.sizePx}px`);
    element.style.setProperty("--magic-symbol-rotate", `${stroke.bearingDeg}deg`);
    element.style.setProperty("--magic-symbol-color", stroke.color);
    element.style.setProperty("--magic-symbol-accent", stroke.accent);
    element.style.setProperty("--magic-symbol-pale", stroke.pale);
    element.style.setProperty("--magic-symbol-opacity", `${stroke.opacity}`);
    element.style.setProperty("--magic-symbol-phase", `${stroke.phase}deg`);
  }
  setElementAnimationPlayback(element, playback, direction);
};

const applyMagicMarkerTiming = (
  element: SVGElement,
  delayMs: number,
  durationMs: number,
  speed: MagicSpeed,
  playback: MagicPlayback,
  direction: MagicPlaybackDirection,
  timelineDurationMs: number,
  timelinePositionMs: number
) => {
  element.style.setProperty(
    "--magic-delay",
    `${
      getMagicDelayMs(
        delayMs,
        durationMs,
        direction,
        timelineDurationMs,
        timelinePositionMs
      ) / speed
    }ms`
  );
  element.style.setProperty("--magic-duration", `${durationMs / speed}ms`);
  setElementAnimationPlayback(element, playback, direction);
};

const setMagicLayerPlayback = (
  group: L.LayerGroup | null,
  playback: MagicPlayback,
  direction: MagicPlaybackDirection
) => {
  group?.eachLayer((layer) => {
    const element = getLayerElement(layer);
    if (!element?.classList.contains("magic-drawable")) return;
    setElementAnimationPlayback(element, playback, direction);
  });
};

const makeSectorPolygon = (
  center: LatLng,
  innerRadiusMeters: number,
  outerRadiusMeters: number,
  startDeg: number,
  endDeg: number
) => {
  const points: L.LatLngExpression[] = [];
  const span = normalizeDegrees(endDeg - startDeg) || 360;
  const steps = Math.max(8, Math.ceil(span / 6));
  const hasInnerRadius = innerRadiusMeters > 0;

  if (!hasInnerRadius) {
    points.push([center.lat, center.lng]);
  }

  for (let index = 0; index <= steps; index += 1) {
    const bearing = startDeg + (span * index) / steps;
    const point = destinationPoint(center, outerRadiusMeters, bearing);
    points.push([point.lat, point.lng]);
  }

  if (hasInnerRadius) {
    for (let index = steps; index >= 0; index -= 1) {
      const bearing = startDeg + (span * index) / steps;
      const point = destinationPoint(center, innerRadiusMeters, bearing);
      points.push([point.lat, point.lng]);
    }
  } else {
    points.push([center.lat, center.lng]);
  }

  return points;
};

const makeHoneycombLatLng = (center: LatLng, x: number, y: number) => {
  const distanceMeters = Math.hypot(x, y);
  const bearingDeg = normalizeDegrees((Math.atan2(x, y) * 180) / Math.PI);
  return destinationPoint(center, distanceMeters, bearingDeg);
};

const makeHoneycombPolygon = (
  center: LatLng,
  cellRadiusMeters: number
) =>
  Array.from({ length: 6 }, (_, index) =>
    destinationPoint(center, cellRadiusMeters, index * 60)
  );

const makeHoneycombPreviewCells = ({
  mode,
  center,
  innerRadiusMeters,
  outerRadiusMeters,
  rotationStepDeg,
  hexCellRadiusMeters,
  priorityRings,
  rotationSpanDeg: targetRotationSpanDeg,
  targetBands,
  targetNodes
}: HoneycombPreviewParams): HoneycombPreviewCell[] => {
  const activeTargetBands =
    targetBands.length > 0
      ? targetBands
      : [{ id: "perimeter", slots: mode, radius: "target" as const }];
  const activeTargetNodes = targetNodes.filter(
    (node) =>
      Number.isFinite(node.radiusScale) &&
      node.radiusScale > 0 &&
      Number.isFinite(node.bearingDeg)
  );
  const rotationSpanDeg = Math.min(
    360,
    Math.max(
      1,
      activeTargetNodes.length > 0
        ? targetRotationSpanDeg ?? 360 / mode
        : Math.min(
            ...activeTargetBands.map((band) => 360 / Math.max(1, band.slots))
          )
    )
  );
  const step = Math.max(1, Math.min(rotationSpanDeg, rotationStepDeg));
  const cellRadiusMeters = normalizeHoneycombCellRadius(
    outerRadiusMeters,
    hexCellRadiusMeters
  );
  const targetRadiusMeters = getHoneycombTargetRadiusMeters(
    outerRadiusMeters,
    innerRadiusMeters
  );
  const rotations: number[] = [];
  const seen = new Set<string>();
  const cells: HoneycombPreviewCell[] = [];

  for (let rotationDeg = 0; rotationDeg < rotationSpanDeg; rotationDeg += step) {
    rotations.push(rotationDeg);
  }

  const makeTargetsForRotation = (rotationDeg: number) => {
    if (activeTargetNodes.length > 0) {
      return activeTargetNodes.map((node, index) => {
        const targetBearing = normalizeDegrees(rotationDeg + node.bearingDeg);
        const targetDistanceMeters = Math.max(
          1,
          targetRadiusMeters * node.radiusScale
        );
        return {
          id: node.id,
          label: node.label || `目標節點 ${index + 1}`,
          point: makeHoneycombPlanarPoint(targetDistanceMeters, targetBearing)
        };
      });
    }

    return activeTargetBands.flatMap((band) => {
      const bandSlots = Math.max(1, band.slots);
      const slotWidth = 360 / bandSlots;
      const bandRadiusMeters =
        band.radius === "target"
          ? targetRadiusMeters
          : Math.max(1, outerRadiusMeters * band.radius);

      return Array.from({ length: bandSlots }, (_, slotIndex) => {
        const targetBearing = normalizeDegrees(
          rotationDeg + (band.phaseOffsetDeg ?? 0) + slotWidth * slotIndex
        );
        return {
          id: `${band.id}-${slotIndex + 1}`,
          label: `${band.id} ${slotIndex + 1}`,
          point: makeHoneycombPlanarPoint(bandRadiusMeters, targetBearing)
        };
      });
    });
  };

  const addCellsForRotation = (
    rotationDeg: number,
    maxRing: number,
    minRing = 0
  ) => {
    for (const target of makeTargetsForRotation(rotationDeg)) {
      const targetCell = honeycombPointToCell(target.point, cellRadiusMeters);
      const targetCenter = makeHoneycombLatLng(
        center,
        target.point.x,
        target.point.y
      );

      for (let ring = minRing; ring <= maxRing; ring += 1) {
        for (const cell of getHoneycombRing(targetCell, ring)) {
          const key = getHoneycombCellKey(cell);
          if (seen.has(key)) continue;

          const planarCenter = getHoneycombCellCenterPlanar(
            cell,
            cellRadiusMeters
          );
          const distanceFromCenter = Math.hypot(
            planarCenter.x,
            planarCenter.y
          );
          const overlapsSearchRange =
            distanceFromCenter <= outerRadiusMeters + cellRadiusMeters &&
            distanceFromCenter >=
              Math.max(0, innerRadiusMeters - cellRadiusMeters);
          if (!overlapsSearchRange) continue;

          seen.add(key);
          const cellCenter = makeHoneycombLatLng(
            center,
            planarCenter.x,
            planarCenter.y
          );
          cells.push({
            key,
            order: cells.length + 1,
            ring,
            center: cellCenter,
            targetCenter,
            targetLabel: target.label,
            polygon: makeHoneycombPolygon(cellCenter, cellRadiusMeters)
          });

          if (cells.length >= MAX_HONEYCOMB_PREVIEW_CELLS) return cells;
        }
      }
    }
    return null;
  };

  if (rotations[0] !== undefined && addCellsForRotation(rotations[0], 0)) {
    return cells;
  }

  for (const rotationDeg of rotations.slice(1)) {
    if (addCellsForRotation(rotationDeg, 0)) return cells;
  }

  for (let ring = 1; ring <= priorityRings; ring += 1) {
    for (const rotationDeg of rotations) {
      if (addCellsForRotation(rotationDeg, ring, ring)) return cells;
    }
  }

  return cells;
};

const makeHoneycombSearchBatches = (
  params: HoneycombSearchBatchParams
): HoneycombSearchBatch[] => {
  const cells = makeHoneycombPreviewCells(params);
  const batches: HoneycombSearchBatch[] = [];
  const firstBatchSize = Math.min(params.initialCellCount, cells.length);

  if (firstBatchSize > 0) {
    batches.push({
      cells: cells.slice(0, firstBatchSize),
      isInitial: true,
      label: `首批 ${firstBatchSize} 個目標蜂巢`
    });
  }

  for (
    let offset = firstBatchSize;
    offset < cells.length;
    offset += params.cellsPerBatch
  ) {
    const batchCells = cells.slice(
      offset,
      offset + params.cellsPerBatch
    );
    batches.push({
      cells: batchCells,
      isInitial: false,
      label: `背景蜂巢 ${offset + 1}-${offset + batchCells.length}`
    });
  }

  return batches;
};

const makeHoneycombSearchParams = ({
  profile,
  mode,
  center,
  innerRadiusMeters,
  outerRadiusMeters,
  rotationStepDeg,
  hexCellRadiusMeters
}: {
  profile: HoneycombSearchProfile;
  mode: StarMode;
  center: LatLng;
  innerRadiusMeters: number;
  outerRadiusMeters: number;
  rotationStepDeg: number;
  hexCellRadiusMeters: number;
}): HoneycombSearchBatchParams => ({
  mode,
  center,
  innerRadiusMeters,
  outerRadiusMeters,
  rotationStepDeg,
  hexCellRadiusMeters,
  priorityRings: profile.priorityRings,
  rotationSpanDeg: profile.rotationSpanDeg,
  targetBands: profile.targetBands,
  targetNodes: profile.targetNodes,
  initialCellCount: profile.initialCellCount,
  cellsPerBatch: profile.cellsPerBatch
});

const getBoundsForPoints = (points: LatLng[]): OverpassBounds => {
  const lats = points.map((point) => point.lat);
  const lngs = points.map((point) => point.lng);
  return {
    south: Math.min(...lats),
    west: Math.min(...lngs),
    north: Math.max(...lats),
    east: Math.max(...lngs)
  };
};

const getHoneycombCellBounds = (cell: HoneycombPreviewCell) =>
  getBoundsForPoints(cell.polygon);

const filterPoisByHoneycombCells = (
  pois: Poi[],
  cellKeys: Set<string>,
  cellRadiusMeters: number
) =>
  pois.filter((poi) => {
    const point = makeHoneycombPlanarPoint(poi.distanceMeters, poi.bearingDeg);
    return cellKeys.has(
      getHoneycombCellKey(honeycombPointToCell(point, cellRadiusMeters))
    );
  });

function App() {
  const appShellRef = useRef<HTMLElement | null>(null);
  const appHeaderRef = useRef<HTMLElement | null>(null);
  const sidebarRef = useRef<HTMLElement | null>(null);
  const magicPlayerRef = useRef<HTMLElement | null>(null);
  const magicDrawActionsRef = useRef<HTMLElement | null>(null);
  const mapElementRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const centerLayerRef = useRef<L.LayerGroup | null>(null);
  const poiLayerRef = useRef<L.LayerGroup | null>(null);
  const starLayerRef = useRef<L.LayerGroup | null>(null);
  const sectorLayerRef = useRef<L.LayerGroup | null>(null);
  const honeycombLayerRef = useRef<L.LayerGroup | null>(null);
  const skipNextAutoSolveRef = useRef<string | null>(null);
  const [initialSettings] = useState(() =>
    typeof window === "undefined" ? DEFAULT_APP_SETTINGS : loadSettings()
  );
  const [initialLastStar] = useState(() =>
    typeof window === "undefined" ? null : loadLastStar()
  );

  const [center, setCenter] = useState<LatLng>(
    initialLastStar?.center ?? DEFAULT_CENTER
  );
  const [centerName, setCenterName] = useState(
    initialLastStar?.name ??
      formatCoordinate(initialLastStar?.center ?? DEFAULT_CENTER)
  );
  const [searchText, setSearchText] = useState("");
  const [placeCandidates, setPlaceCandidates] = useState<PlaceSearchResult[]>(
    []
  );
  const [placeCandidateQuery, setPlaceCandidateQuery] = useState("");
  const [selectedPlaceCandidateId, setSelectedPlaceCandidateId] = useState<
    string | null
  >(null);
  const [innerRadiusKm, setInnerRadiusKm] = useState(
    initialSettings.innerRadiusKm
  );
  const [outerRadiusKm, setOuterRadiusKm] = useState(
    initialSettings.outerRadiusKm
  );
  const [starMode, setStarMode] = useState<StarMode>(
    initialLastStar?.mode ?? initialSettings.starMode
  );
  const [angleToleranceDeg, setAngleToleranceDeg] = useState(
    initialSettings.angleToleranceDeg
  );
  const [candidatesPerSlot, setCandidatesPerSlot] = useState(
    initialSettings.candidatesPerSlot
  );
  const [rotationStepDeg, setRotationStepDeg] = useState(
    initialSettings.rotationStepDeg
  );
  const [searchStrategy, setSearchStrategy] = useState<SearchStrategy>(
    initialSettings.searchStrategy
  );
  const [hexCellRadiusKm, setHexCellRadiusKm] = useState(
    initialSettings.hexCellRadiusKm
  );
  const [showSectors, setShowSectors] = useState(
    initialSettings.showSectors
  );
  const [showHoneycomb, setShowHoneycomb] = useState(
    initialSettings.showHoneycomb
  );
  const [theme, setTheme] = useState(initialSettings.theme);
  const [mapLayer, setMapLayer] = useState<MapLayerId>(
    initialSettings.mapLayer
  );
  const [selectedCategoryIds, setSelectedCategoryIds] =
    useState<string[]>(initialSettings.selectedCategoryIds);
  const [selectedCategoryGroups, setSelectedCategoryGroups] = useState<
    string[]
  >(initialSettings.selectedCategoryGroups);
  const [
    categoryGroupSelectionSnapshots,
    setCategoryGroupSelectionSnapshots
  ] = useState<Record<string, string[]>>(
    initialSettings.categoryGroupSelectionSnapshots
  );
  const [expandedDesktopSections, setExpandedDesktopSections] = useState<
    Record<MobileSettingsTab, boolean>
  >(DEFAULT_DESKTOP_SECTION_EXPANSION);
  const [pois, setPois] = useState<Poi[]>([]);
  const [results, setResults] = useState<StarResult[]>(
    initialLastStar ? [initialLastStar] : []
  );
  const [selectedResultIndex, setSelectedResultIndex] = useState(0);
  const [starResultSort, setStarResultSort] =
    useState<StarResultSortKey>("score");
  const [starResultSortDirection, setStarResultSortDirection] =
    useState<StarResultSortDirection>("asc");
  const [expandedResultId, setExpandedResultId] = useState<string | null>(null);
  const [expandedFavoriteId, setExpandedFavoriteId] = useState<string | null>(
    null
  );
  const [selectedPoi, setSelectedPoi] = useState<Poi | null>(null);
  const [magicAnimationIndex, setMagicAnimationIndex] = useState(0);
  const [magicDrawShape, setMagicDrawShape] = useState<MagicDrawShape>(() =>
    getMagicDrawShapeForMode(initialLastStar?.mode ?? initialSettings.starMode)
  );
  const [magicDrawVariantByShape, setMagicDrawVariantByShape] = useState<
    Record<MagicDrawShape, string>
  >(() =>
    makeInitialMagicDrawVariants(
      initialLastStar?.mode ?? initialSettings.starMode
    )
  );
  const [magicPlayback, setMagicPlayback] =
    useState<MagicPlayback>("playing");
  const magicPlaybackRef = useRef<MagicPlayback>("playing");
  const [magicDirection, setMagicDirection] =
    useState<MagicPlaybackDirection>("forward");
  const magicDirectionRef = useRef<MagicPlaybackDirection>("forward");
  const [magicSpeed, setMagicSpeed] = useState<MagicSpeed>(1);
  const magicSpeedRef = useRef<MagicSpeed>(1);
  const [magicPlaybackMode, setMagicPlaybackMode] =
    useState<MagicPlaybackMode>("continuous");
  const [magicReplayKey, setMagicReplayKey] = useState(0);
  const [favorites, setFavorites] = useState<FavoriteItem[]>(() =>
    typeof window === "undefined" ? [] : loadFavorites()
  );
  const progressClearTimerRef = useRef<number | null>(null);
  const completionNoticeTimerRef = useRef<number | null>(null);
  const magicPlaybackTimerRef = useRef<number | null>(null);
  const magicPlaybackStartedAtRef = useRef<number | null>(null);
  const magicTimelineDurationMsRef = useRef(0);
  const magicTimelinePositionMsRef = useRef(0);
  const magicPlaybackModeTouchRef = useRef<MagicSelectTouchState | null>(null);
  const magicAnimationTouchRef = useRef<MagicSelectTouchState | null>(null);
  const magicSpeedTouchRef = useRef<MagicSelectTouchState | null>(null);
  const magicSelectScrollLockRef =
    useRef<MagicSelectScrollLockState | null>(null);
  const mobileSplitDraggingRef = useRef(false);
  const mobileSplitterTapRef = useRef<MobileSplitterTapState | null>(null);
  const mobileSplitterSnapAtRef = useRef(0);
  const mobileSettingsSwipeRef = useRef<MobileSettingsSwipeState | null>(null);
  const placeSearchAbortControllerRef = useRef<AbortController | null>(null);
  const placeSearchRequestIdRef = useRef(0);
  const searchAbortControllerRef = useRef<AbortController | null>(null);
  const isMagicCenterLockedRef = useRef(false);
  const [loading, setLoading] = useState(false);
  const [isSearchDrawing, setIsSearchDrawing] = useState(false);
  const [calculationProgress, setCalculationProgress] =
    useState<CalculationProgress | null>(null);
  const [completionNotice, setCompletionNotice] =
    useState<CompletionNotice | null>(null);
  const [honeycombCompletedTargetCount, setHoneycombCompletedTargetCount] =
    useState<number | null>(null);
  const [calculationRecords, setCalculationRecords] = useState<
    CalculationRecord[]
  >([]);
  const [mobileMapSplitPercent, setMobileMapSplitPercent] = useState(50);
  const [mobileSettingsSwipeOffsetPx, setMobileSettingsSwipeOffsetPx] =
    useState(0);
  const [activeMobileSettingsTab, setActiveMobileSettingsTab] =
    useState<MobileSettingsTab>("search");
  const [isMobileLayout, setIsMobileLayout] = useState(() =>
    typeof window === "undefined"
      ? false
      : window.matchMedia("(max-width: 900px)").matches
  );
  const [status, setStatus] = useState(
    initialLastStar
      ? `已載入上次暫存的${getStarModeLabel(initialLastStar.mode)}魔法陣。`
      : "點擊地圖、搜尋地標或輸入座標來放置中心。"
  );
  const [error, setError] = useState("");

  const selectedCategoryIdSet = useMemo(
    () => new Set(selectedCategoryIds),
    [selectedCategoryIds]
  );
  const selectedCategoryGroupSet = useMemo(
    () => new Set(selectedCategoryGroups),
    [selectedCategoryGroups]
  );
  const selectedCategories = useMemo(
    () =>
      POI_CATEGORIES.filter((category) => selectedCategoryIdSet.has(category.id)),
    [selectedCategoryIdSet]
  );
  const sortedResults = useMemo(
    () => sortStarResults(results, starResultSort, starResultSortDirection),
    [results, starResultSort, starResultSortDirection]
  );
  const resultAggregateStats = useMemo(
    () => getStarResultAggregateStats(results),
    [results]
  );
  const selectedResult = sortedResults[selectedResultIndex] ?? null;
  const magicAnimationOptions = useMemo(
    () => getMagicAnimationOptions(selectedResult?.mode ?? starMode),
    [selectedResult?.mode, starMode]
  );
  const magicPlaybackModeLabel =
    MAGIC_PLAYBACK_MODES.find((mode) => mode.id === magicPlaybackMode)
      ?.label ?? MAGIC_PLAYBACK_MODES[0].label;
  const magicSpeedLabel = formatMagicSpeed(magicSpeed);
  const magicAnimationLabel =
    magicAnimationOptions.find((option) => option.index === magicAnimationIndex)
      ?.label ?? magicAnimationOptions[0]?.label ?? "動畫";
  const magicDrawShapeLabel =
    MAGIC_DRAW_SHAPE_OPTIONS.find((option) => option.id === magicDrawShape)
      ?.label ?? MAGIC_DRAW_SHAPE_OPTIONS[0].label;
  const magicDrawVariantOptions = MAGIC_DRAW_VARIANT_OPTIONS[magicDrawShape];
  const magicDrawVariant = getMagicDrawVariantOption(
    magicDrawShape,
    magicDrawVariantByShape[magicDrawShape]
  );
  const magicDrawVariantValue = magicDrawVariant.id;
  const magicDrawVariantLabel = magicDrawVariant.label;
  const isMagicDrawVariantLocked = magicDrawVariantOptions.length <= 1;
  const magicGeometryPattern = magicDrawVariant.geometryPattern;
  const magicGeometryOptions = magicDrawVariant.geometryOptions;
  const magicGeometryVariantKey = `${magicDrawShape}:${magicDrawVariant.id}`;
  const honeycombSearchProfile = useMemo(
    () =>
      getHoneycombSearchProfile({
        shape: magicDrawShape,
        variantId: magicDrawVariant.id,
        mode: starMode
      }),
    [magicDrawShape, magicDrawVariant.id, starMode]
  );
  const honeycombInnerRadiusNote = honeycombSearchProfile.ignoreInnerRadius
    ? `${magicDrawShapeLabel} ${magicDrawVariantLabel} 需要內部點，搜索與解算已忽略內徑限制。`
    : null;
  const currentMapLayerOption =
    MAP_LAYER_OPTIONS.find((option) => option.id === mapLayer) ??
    MAP_LAYER_OPTIONS[0];
  const CurrentMapLayerIcon = currentMapLayerOption.Icon;
  const trimmedSearchText = searchText.trim();
  const shouldShowPlaceCandidates =
    placeCandidates.length > 0 && placeCandidateQuery === trimmedSearchText;
  const searchDrawButtonLabel = isSearchDrawing ? "取消搜索" : "搜索繪製";
  const isSearchSettingsLocked = isSearchDrawing;
  const areFavoritesLocked = isSearchDrawing;
  const isMagicCenterLocked = isSearchDrawing;
  isMagicCenterLockedRef.current = isMagicCenterLocked;
  const isSidebarSectionExpanded = (tab: MobileSettingsTab) =>
    isMobileLayout || expandedDesktopSections[tab];
  const toggleDesktopSection = (tab: MobileSettingsTab) => {
    setExpandedDesktopSections((current) => ({
      ...current,
      [tab]: !current[tab]
    }));
  };
  const renderPanelTitle = (
    tab: MobileSettingsTab,
    label: string,
    Icon: typeof Sparkles
  ) => {
    const isExpanded = isSidebarSectionExpanded(tab);
    const actionLabel = `${isExpanded ? "收合" : "展開"}${label}`;

    return (
      <div className="panel-title panel-title--with-action">
        <div className="panel-title-main">
          <Icon aria-hidden="true" />
          <h2>{label}</h2>
        </div>
        {!isMobileLayout && (
          <button
            className="panel-collapse-button"
            type="button"
            aria-expanded={isExpanded}
            aria-label={actionLabel}
            title={actionLabel}
            onClick={() => toggleDesktopSection(tab)}
          >
            {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
          </button>
        )}
      </div>
    );
  };
  const areCategoryOptionsExpanded = isSidebarSectionExpanded("categories");
  const isSolverAdvancedExpanded = isSidebarSectionExpanded("drawing");
  const appShellStyle = {
    "--mobile-map-split": `${mobileMapSplitPercent}%`,
    "--mobile-tab-swipe-offset": `${mobileSettingsSwipeOffsetPx}px`
  } as CSSProperties;
  const getMobileTabPanelClass = (
    tab: MobileSettingsTab,
    className = "panel"
  ) =>
    `${className} mobile-tab-panel desktop-collapsible-panel ${
      isSidebarSectionExpanded(tab) ? "" : "desktop-collapsible-panel--collapsed"
    } ${
      activeMobileSettingsTab === tab ? "mobile-tab-panel--active" : ""
    }`;
  const innerRadiusMeters = innerRadiusKm * 1000;
  const outerRadiusMeters = outerRadiusKm * 1000;
  const effectiveInnerRadiusMeters = honeycombSearchProfile.ignoreInnerRadius
    ? 0
    : innerRadiusMeters;
  const visiblePois = useMemo(
    () =>
      pois.filter(
        (poi) =>
          poi.distanceMeters >= effectiveInnerRadiusMeters &&
          poi.distanceMeters <= outerRadiusMeters
      ),
    [effectiveInnerRadiusMeters, outerRadiusMeters, pois]
  );
  const maxAngleToleranceDeg = maxAngleToleranceForMode(starMode);
  const effectiveAngleToleranceDeg = Math.min(
    angleToleranceDeg,
    maxAngleToleranceDeg
  );
  const solverParams = useMemo(
    () => ({
      mode: starMode,
      center,
      radiusMeters: outerRadiusMeters,
      innerRadiusMeters: effectiveInnerRadiusMeters,
      maxResults: MAX_STAR_RESULTS,
      angleToleranceDeg: effectiveAngleToleranceDeg,
      candidatesPerSlot,
      rotationStepDeg,
      searchStrategy,
      hexCellRadiusMeters: hexCellRadiusKm * 1000,
      hexPriorityRings: honeycombSearchProfile.priorityRings,
      targetNodes: honeycombSearchProfile.targetNodes,
      targetRotationSpanDeg: honeycombSearchProfile.rotationSpanDeg
    }),
    [
      candidatesPerSlot,
      center,
      effectiveAngleToleranceDeg,
      effectiveInnerRadiusMeters,
      hexCellRadiusKm,
      honeycombSearchProfile.priorityRings,
      honeycombSearchProfile.rotationSpanDeg,
      honeycombSearchProfile.targetNodes,
      outerRadiusMeters,
      rotationStepDeg,
      searchStrategy,
      starMode
    ]
  );
  const autoSolveKey = useMemo(
    () =>
      makeAutoSolveKey({
        mode: starMode,
        center,
        innerRadiusKm,
        outerRadiusKm,
        angleToleranceDeg: effectiveAngleToleranceDeg,
        candidatesPerSlot,
        rotationStepDeg,
        searchStrategy,
        hexCellRadiusKm,
        honeycombProfileKey: honeycombSearchProfile.key
      }),
    [
      candidatesPerSlot,
      center,
      effectiveAngleToleranceDeg,
      hexCellRadiusKm,
      honeycombSearchProfile.key,
      innerRadiusKm,
      outerRadiusKm,
      rotationStepDeg,
      searchStrategy,
      starMode
    ]
  );
  const radiusRangeLabel = `${innerRadiusKm}–${outerRadiusKm} km`;
  const handleInnerRadiusChange = (value: number) => {
    setInnerRadiusKm(Math.max(0, Math.min(value, outerRadiusKm - 1)));
  };
  const handleOuterRadiusChange = (value: number) => {
    setOuterRadiusKm(Math.min(30, Math.max(value, innerRadiusKm + 1)));
  };
  const focusPlaceCandidate = (candidate: PlaceSearchResult) => {
    const map = mapRef.current;
    if (!map) return;

    map.setView(
      [candidate.center.lat, candidate.center.lng],
      Math.max(map.getZoom(), 15)
    );
  };
  const blockMagicCenterMoveIfLocked = () => {
    if (!isMagicCenterLockedRef.current) return false;

    setStatus("魔法陣繪製中，中心已鎖定；仍可移動、縮放或切換地圖。");
    setError("");
    return true;
  };
  const setCenterFromPlaceCandidate = (
    candidate: PlaceSearchResult,
    options: { allowWhileLocked?: boolean } = {}
  ) => {
    if (!options.allowWhileLocked && blockMagicCenterMoveIfLocked()) {
      return false;
    }

    setCenter(candidate.center);
    setCenterName(candidate.label);
    setSelectedPlaceCandidateId(candidate.id);
    focusPlaceCandidate(candidate);
    return true;
  };
  const handleSearchTextChange = (value: string) => {
    setSearchText(value);
    const nextTrimmedValue = value.trim();
    if (nextTrimmedValue !== placeCandidateQuery) {
      setSelectedPlaceCandidateId(null);
    }
    if (!nextTrimmedValue) {
      setPlaceCandidates([]);
      setPlaceCandidateQuery("");
    }
  };
  const handleGoToPlaceCandidate = (candidate: PlaceSearchResult) => {
    focusPlaceCandidate(candidate);
    setStatus(`已前往 ${candidate.label}，尚未變更中心。`);
    setError("");
  };
  const handleSetPlaceCandidate = (candidate: PlaceSearchResult) => {
    if (!setCenterFromPlaceCandidate(candidate)) return;

    setStatus(`中心已設置為 ${candidate.label}。`);
    setError("");
  };
  const handleMapLayerCycle = () => {
    const currentIndex = Math.max(
      0,
      MAP_LAYER_OPTIONS.findIndex((option) => option.id === mapLayer)
    );
    setMapLayer(
      MAP_LAYER_OPTIONS[(currentIndex + 1) % MAP_LAYER_OPTIONS.length].id
    );
  };
  const handleStarResultSortSelect = (nextSort: StarResultSortKey) => {
    setStarResultSortDirection((currentDirection) =>
      nextSort === starResultSort
        ? currentDirection === "asc"
          ? "desc"
          : "asc"
        : "asc"
    );
    setStarResultSort(nextSort);
    setSelectedResultIndex(0);
    setExpandedResultId(null);
  };
  const handleResultToggle = (result: StarResult, index: number) => {
    setSelectedResultIndex(index);
    setExpandedResultId((current) =>
      current === result.id ? null : result.id
    );
  };
  const clearCurrentMagicCircle = () => {
    clearMagicPlaybackTimer();
    starLayerRef.current?.clearLayers();
    sectorLayerRef.current?.clearLayers();
    setResults([]);
    setSelectedResultIndex(0);
    setExpandedResultId(null);
    setSelectedPoi(null);
    setMagicPlaybackState("playing");
    setMagicDirectionState("forward");
    magicTimelineDurationMsRef.current = 0;
    magicTimelinePositionMsRef.current = 0;
    magicPlaybackStartedAtRef.current = null;
  };
  const handleFavoriteToggle = (favorite: FavoriteItem) => {
    if (areFavoritesLocked) return;
    setExpandedFavoriteId((current) =>
      current === favorite.id ? null : favorite.id
    );
  };
  const skipNextAutoSolveForCenter = (nextCenter: LatLng) => {
    skipNextAutoSolveRef.current = makeAutoSolveKey({
      mode: starMode,
      center: nextCenter,
      innerRadiusKm,
      outerRadiusKm,
      angleToleranceDeg: effectiveAngleToleranceDeg,
      candidatesPerSlot,
      rotationStepDeg,
      searchStrategy,
      hexCellRadiusKm,
      honeycombProfileKey: honeycombSearchProfile.key
    });
  };
  const handleCancelSearch = () => {
    if (!isSearchDrawing) return;
    searchAbortControllerRef.current?.abort();
    setProgressStep(100, "正在取消搜索...");
  };
  const getMobileSplitBounds = () => {
    const shell = appShellRef.current;
    if (!shell) return { min: 12, max: 88 };

    const shellRect = shell.getBoundingClientRect();
    const shellHeight = shellRect.height;
    if (shellHeight <= 0) return { min: 12, max: 88 };

    const headerHeight =
      appHeaderRef.current?.getBoundingClientRect().height ?? 56;
    const playerHeight =
      magicPlayerRef.current?.getBoundingClientRect().height ?? 92;
    const splitterHeight =
      shell.querySelector(".mobile-splitter")?.getBoundingClientRect().height ??
      12;
    const sidebarStyle = sidebarRef.current
      ? window.getComputedStyle(sidebarRef.current)
      : null;
    const sidebarVerticalPadding =
      Number.parseFloat(sidebarStyle?.paddingTop ?? "0") +
      Number.parseFloat(sidebarStyle?.paddingBottom ?? "0");

    const minMapHeight = headerHeight;
    const maxMapHeight =
      shellHeight - splitterHeight - playerHeight - sidebarVerticalPadding;
    const min = (minMapHeight / shellHeight) * 100;
    const max = (Math.max(minMapHeight, maxMapHeight) / shellHeight) * 100;
    const clampedMin = Math.max(0, Math.min(90, min));

    return {
      min: clampedMin,
      max: Math.max(clampedMin, Math.min(96, max))
    };
  };
  const clampMobileSplitPercent = (
    value: number,
    bounds = getMobileSplitBounds()
  ) => {
    return Math.min(bounds.max, Math.max(bounds.min, value));
  };
  const getMobileSearchDrawSplitPercent = (
    bounds = getMobileSplitBounds()
  ) => {
    const shell = appShellRef.current;
    const sidebar = sidebarRef.current;
    const searchDrawActions = magicDrawActionsRef.current;
    if (!shell || !sidebar || !searchDrawActions) {
      return clampMobileSplitPercent(50, bounds);
    }

    const shellRect = shell.getBoundingClientRect();
    const sidebarRect = sidebar.getBoundingClientRect();
    const actionsRect = searchDrawActions.getBoundingClientRect();
    const splitterHeight =
      shell.querySelector(".mobile-splitter")?.getBoundingClientRect().height ??
      12;
    const settingsHeightToActions = actionsRect.bottom - sidebarRect.top;
    const mapHeight =
      shellRect.height - splitterHeight - settingsHeightToActions;
    if (shellRect.height <= 0 || mapHeight <= 0) {
      return clampMobileSplitPercent(50, bounds);
    }

    return clampMobileSplitPercent((mapHeight / shellRect.height) * 100, bounds);
  };
  const snapMobileSplitter = () => {
    const bounds = getMobileSplitBounds();
    const topRowTarget = bounds.min;
    const searchDrawTarget = Math.max(
      topRowTarget,
      getMobileSearchDrawSplitPercent(bounds)
    );
    const midpoint = topRowTarget + (searchDrawTarget - topRowTarget) / 2;
    setMobileMapSplitPercent((current) =>
      current <= midpoint ? searchDrawTarget : topRowTarget
    );
  };
  const updateMobileSplitFromPointer = (clientY: number) => {
    const shell = appShellRef.current;
    if (!shell) return;

    const rect = shell.getBoundingClientRect();
    if (rect.height <= 0) return;

    const nextPercent = ((clientY - rect.top) / rect.height) * 100;
    setMobileMapSplitPercent(clampMobileSplitPercent(nextPercent));
  };
  const handleMobileSplitterPointerDown = (
    event: PointerEvent<HTMLDivElement>
  ) => {
    event.preventDefault();
    const now = Date.now();
    const lastTap = mobileSplitterTapRef.current;
    const isDoubleTap =
      lastTap !== null &&
      now - lastTap.atMs <= MOBILE_SPLITTER_DOUBLE_TAP_MS &&
      lastTap.pointerType === event.pointerType &&
      Math.abs(lastTap.x - event.clientX) <= MOBILE_SPLITTER_DOUBLE_TAP_PX &&
      Math.abs(lastTap.y - event.clientY) <= MOBILE_SPLITTER_DOUBLE_TAP_PX;

    mobileSplitterTapRef.current = isDoubleTap
      ? null
      : {
          atMs: now,
          pointerType: event.pointerType,
          x: event.clientX,
          y: event.clientY
        };

    if (isDoubleTap) {
      mobileSplitDraggingRef.current = false;
      mobileSplitterSnapAtRef.current = now;
      snapMobileSplitter();
      return;
    }

    mobileSplitDraggingRef.current = true;
    event.currentTarget.setPointerCapture(event.pointerId);
    updateMobileSplitFromPointer(event.clientY);
  };
  const handleMobileSplitterPointerMove = (
    event: PointerEvent<HTMLDivElement>
  ) => {
    if (!mobileSplitDraggingRef.current) return;
    event.preventDefault();
    const tapState = mobileSplitterTapRef.current;
    if (
      tapState &&
      (Math.abs(tapState.x - event.clientX) > MOBILE_SPLITTER_DOUBLE_TAP_PX ||
        Math.abs(tapState.y - event.clientY) > MOBILE_SPLITTER_DOUBLE_TAP_PX)
    ) {
      mobileSplitterTapRef.current = null;
    }
    updateMobileSplitFromPointer(event.clientY);
  };
  const handleMobileSplitterPointerUp = (
    event: PointerEvent<HTMLDivElement>
  ) => {
    mobileSplitDraggingRef.current = false;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };
  const handleMobileSplitterKeyDown = (
    event: KeyboardEvent<HTMLDivElement>
  ) => {
    const bounds = getMobileSplitBounds();
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      snapMobileSplitter();
      return;
    }

    const keyActions: Record<string, number> = {
      ArrowUp: mobileMapSplitPercent - 5,
      ArrowLeft: mobileMapSplitPercent - 5,
      ArrowDown: mobileMapSplitPercent + 5,
      ArrowRight: mobileMapSplitPercent + 5,
      Home: bounds.min,
      End: bounds.max
    };

    if (!(event.key in keyActions)) return;
    event.preventDefault();
    setMobileMapSplitPercent(clampMobileSplitPercent(keyActions[event.key]));
  };
  const handleMobileSplitterDoubleClick = () => {
    const now = Date.now();
    if (now - mobileSplitterSnapAtRef.current < 350) return;
    mobileSplitterSnapAtRef.current = now;
    snapMobileSplitter();
  };
  const switchMobileSettingsTab = (direction: 1 | -1) => {
    const currentIndex = MOBILE_SETTINGS_TABS.findIndex(
      (tab) => tab.id === activeMobileSettingsTab
    );
    const nextIndex =
      (Math.max(0, currentIndex) + direction + MOBILE_SETTINGS_TABS.length) %
      MOBILE_SETTINGS_TABS.length;

    setActiveMobileSettingsTab(MOBILE_SETTINGS_TABS[nextIndex].id);
  };
  const handleMobileSettingsTouchStart = (
    event: TouchEvent<HTMLElement>
  ) => {
    const target = event.target;
    if (
      target instanceof Element &&
      target.closest(
        "button, input, select, a, .dual-range, .range-wrap, .category-option"
      )
    ) {
      mobileSettingsSwipeRef.current = null;
      return;
    }

    const touch = event.touches[0];
    if (!touch) return;
    mobileSettingsSwipeRef.current = {
      isSwipeGesture: false,
      startX: touch.clientX,
      startY: touch.clientY
    };
  };
  const handleMobileSettingsTouchMove = (
    event: TouchEvent<HTMLElement>
  ) => {
    const swipeState = mobileSettingsSwipeRef.current;
    const touch = event.touches[0];
    if (!swipeState || !touch) return;

    const deltaX = touch.clientX - swipeState.startX;
    const deltaY = touch.clientY - swipeState.startY;
    const isHorizontalIntent =
      Math.abs(deltaX) >= 16 && Math.abs(deltaX) > Math.abs(deltaY) * 1.15;
    if (!swipeState.isSwipeGesture && !isHorizontalIntent) return;

    swipeState.isSwipeGesture = true;
    event.preventDefault();
    setMobileSettingsSwipeOffsetPx(
      Math.max(-84, Math.min(84, deltaX * 0.42))
    );
  };
  const handleMobileSettingsTouchEnd = (
    event: TouchEvent<HTMLElement>
  ) => {
    const swipeState = mobileSettingsSwipeRef.current;
    const touch = event.changedTouches[0];
    mobileSettingsSwipeRef.current = null;
    if (!swipeState || !touch) return;

    const deltaX = touch.clientX - swipeState.startX;
    const deltaY = touch.clientY - swipeState.startY;
    const isHorizontalSwipe =
      Math.abs(deltaX) >= 58 && Math.abs(deltaX) > Math.abs(deltaY) * 1.25;
    setMobileSettingsSwipeOffsetPx(0);
    if (!isHorizontalSwipe) return;

    switchMobileSettingsTab(deltaX < 0 ? 1 : -1);
  };
  const countPoisInCurrentRange = (items: Poi[]) =>
    items.filter(
      (poi) =>
        poi.distanceMeters >= effectiveInnerRadiusMeters &&
        poi.distanceMeters <= outerRadiusMeters
    ).length;
  const getEstimatedMagicAnimationMs = (result: StarResult | null) => {
    if (!result) return null;

    const strokes = makeMagicCircleStrokes(
      result,
      magicAnimationIndex,
      magicGeometryPattern,
      magicGeometryOptions
    );
    return Math.round(
      (getMagicTimelineDurationMs(result, strokes) +
        MAGIC_TIMELINE_END_PADDING_MS) /
        magicSpeedRef.current
    );
  };
  const makeDrawSummary = ({
    sourceLabel,
    startedAtMs,
    startedAtIso,
    finishedAtMs,
    firstResultElapsedMs,
    firstResultAtIso,
    firstResultSourceLabel,
    searchElapsedMs = null,
    solveElapsedMs,
    previewSolveCount = 0,
    previewSolveElapsedMs = 0,
    renderElapsedMs,
    nextResults,
    nextPois,
    nextCenter,
    nextCenterLabel,
    fetchedPoiCount = null,
    addedPoiCount = null,
    notes = [],
    categoryCount = null
  }: {
    sourceLabel: string;
    startedAtMs: number;
    startedAtIso: string;
    finishedAtMs: number;
    firstResultElapsedMs: number | null;
    firstResultAtIso: string | null;
    firstResultSourceLabel: string | null;
    searchElapsedMs?: number | null;
    solveElapsedMs: number;
    previewSolveCount?: number;
    previewSolveElapsedMs?: number;
    renderElapsedMs: number;
    nextResults: StarResult[];
    nextPois: Poi[];
    nextCenter: LatLng;
    nextCenterLabel: string;
    fetchedPoiCount?: number | null;
    addedPoiCount?: number | null;
    notes?: string[];
    categoryCount?: number | null;
  }): DrawSummary => ({
    id: `draw-${Date.now()}`,
    sourceLabel,
    startedAtIso,
    finishedAtIso: new Date().toISOString(),
    firstResultAtIso,
    firstResultElapsedMs,
    firstResultSourceLabel,
    totalElapsedMs: finishedAtMs - startedAtMs,
    searchElapsedMs,
    solveElapsedMs,
    previewSolveCount,
    previewSolveElapsedMs,
    renderElapsedMs,
    estimatedAnimationMs: getEstimatedMagicAnimationMs(nextResults[0] ?? null),
    resultCount: nextResults.length,
    resultLimit: MAX_STAR_RESULTS,
    eligiblePoiCount: countPoisInCurrentRange(nextPois),
    totalPoiCount: nextPois.length,
    fetchedPoiCount,
    addedPoiCount,
    warningCount: notes.length,
    categoryCount,
    mode: starMode,
    centerLabel: nextCenterLabel,
    centerCoordinate: formatCoordinate(nextCenter),
    radiusRangeLabel,
    searchStrategy,
    angleToleranceDeg: effectiveAngleToleranceDeg,
    candidatesPerSlot,
    rotationStepDeg,
    hexCellRadiusKm,
    animationLabel: magicAnimationLabel,
    magicSpeed: magicSpeedRef.current,
    notes
  });
  const addCalculationRecord = (record: CalculationRecord) => {
    setCalculationRecords((current) => [record, ...current]);
  };
  const clearProgressTimer = () => {
    if (progressClearTimerRef.current === null) return;
    window.clearTimeout(progressClearTimerRef.current);
    progressClearTimerRef.current = null;
  };
  const clearCompletionNoticeTimer = () => {
    if (completionNoticeTimerRef.current === null) return;
    window.clearTimeout(completionNoticeTimerRef.current);
    completionNoticeTimerRef.current = null;
  };
  const clearMagicPlaybackTimer = () => {
    if (magicPlaybackTimerRef.current === null) return;
    window.clearTimeout(magicPlaybackTimerRef.current);
    magicPlaybackTimerRef.current = null;
  };
  const setMagicPlaybackState = (playback: MagicPlayback) => {
    magicPlaybackRef.current = playback;
    setMagicPlayback(playback);
  };
  const setMagicDirectionState = (direction: MagicPlaybackDirection) => {
    magicDirectionRef.current = direction;
    setMagicDirection(direction);
  };
  const setMagicSpeedState = (speed: MagicSpeed) => {
    magicSpeedRef.current = speed;
    setMagicSpeed(speed);
  };
  const syncMagicTimelinePosition = () => {
    const durationMs = magicTimelineDurationMsRef.current;
    let positionMs = magicTimelinePositionMsRef.current;

    if (
      magicPlaybackRef.current === "playing" &&
      magicPlaybackStartedAtRef.current !== null
    ) {
      const elapsedMs =
        (performance.now() - magicPlaybackStartedAtRef.current) *
        magicSpeedRef.current;
      positionMs +=
        magicDirectionRef.current === "reverse" ? -elapsedMs : elapsedMs;
    }

    positionMs = clampMagicTimelinePosition(positionMs, durationMs);
    magicTimelinePositionMsRef.current = positionMs;
    magicPlaybackStartedAtRef.current = null;

    return { durationMs, positionMs };
  };
  const setMagicTimeline = (
    result: StarResult,
    animationIndex: number,
    direction: MagicPlaybackDirection,
    positionMs: number
  ) => {
    const strokes = makeMagicCircleStrokes(
      result,
      animationIndex,
      magicGeometryPattern,
      magicGeometryOptions
    );
    const durationMs = getMagicTimelineDurationMs(result, strokes);

    magicTimelineDurationMsRef.current = durationMs;
    magicPlaybackStartedAtRef.current = null;
    magicTimelinePositionMsRef.current = clampMagicTimelinePosition(
      positionMs,
      durationMs
    );
    clearMagicPlaybackTimer();

    return durationMs;
  };
  const playMagicFrom = (
    direction: MagicPlaybackDirection,
    positionMs?: number,
    animationIndex = magicAnimationIndex,
    playback: MagicPlayback = "playing"
  ) => {
    if (!selectedResult) return;

    const durationMs = setMagicTimeline(
      selectedResult,
      animationIndex,
      direction,
      positionMs ?? getMagicBoundaryPosition(direction, 0)
    );
    if (positionMs === undefined) {
      magicTimelinePositionMsRef.current = getMagicBoundaryPosition(
        direction,
        durationMs
      );
    }
    setMagicDirectionState(direction);
    setMagicPlaybackState(playback);
    setMagicReplayKey((key) => key + 1);
  };
  const getNextMagicAnimationIndex = (
    currentIndex: number,
    direction: MagicPlaybackDirection,
    mode: MagicPlaybackMode
  ) => {
    if (mode === "single") return null;
    if (mode === "loop-one") return currentIndex;

    const nextIndex =
      currentIndex + (direction === "forward" ? 1 : -1);
    if (nextIndex >= 0 && nextIndex < magicAnimationOptions.length) {
      return nextIndex;
    }

    if (mode !== "loop-all") return null;

    return direction === "forward"
      ? 0
      : Math.max(0, magicAnimationOptions.length - 1);
  };
  const continueMagicPlaybackFromEndpoint = (
    direction: MagicPlaybackDirection
  ) => {
    if (!selectedResult) return;

    const nextAnimationIndex = getNextMagicAnimationIndex(
      magicAnimationIndex,
      direction,
      magicPlaybackMode
    );

    if (nextAnimationIndex === null) {
      setMagicPlaybackState("ended");
      return;
    }

    setMagicAnimationIndex(nextAnimationIndex);
    playMagicFrom(direction, undefined, nextAnimationIndex);
  };
  const setProgressStep = (percent: number, label: string) => {
    clearProgressTimer();
    setCalculationProgress({
      label,
      percent: Math.max(0, Math.min(100, percent))
    });
  };
  const completeProgress = (label: string) => {
    clearProgressTimer();
    setCalculationProgress({ label, percent: 100 });
    progressClearTimerRef.current = window.setTimeout(() => {
      setCalculationProgress(null);
      progressClearTimerRef.current = null;
    }, 900);
  };
  const clearCompletionNotice = () => {
    clearCompletionNoticeTimer();
    setCompletionNotice(null);
  };
  const showMagicFoundNotice = (
    result: StarResult,
    label: string,
    resultCount: number
  ) => {
    clearCompletionNoticeTimer();
    setCompletionNotice({
      id: `found-${Date.now()}-${result.id}`,
      title: label,
      message: `分數 ${result.score.toFixed(3)} · 半徑 ${formatDistance(
        result.radiusMeanMeters
      )} · 繪圖結果可切換 ${resultCount} 組`
    });
    completionNoticeTimerRef.current = window.setTimeout(() => {
      setCompletionNotice(null);
      completionNoticeTimerRef.current = null;
    }, 4200);
  };
  const showCompletionNotice = (summary: DrawSummary) => {
    clearCompletionNoticeTimer();
    setCompletionNotice({
      id: `${summary.id}-notice`,
      title:
        summary.resultCount > 0
          ? `${getStarModeLabel(summary.mode)}魔法陣搜索完成`
          : "搜索完成，尚無魔法陣",
      message:
        summary.resultCount > 0
          ? `${summary.resultCount} 組 · ${formatElapsedMs(
              summary.totalElapsedMs
            )}`
          : `0 組 · ${formatElapsedMs(summary.totalElapsedMs)}`
    });
    completionNoticeTimerRef.current = window.setTimeout(() => {
      setCompletionNotice(null);
      completionNoticeTimerRef.current = null;
    }, 4200);
  };
  const resetProgress = () => {
    clearProgressTimer();
    setCalculationProgress(null);
  };
  const handleMagicPlaybackToggle = () => {
    if (!selectedResult) return;

    const { durationMs, positionMs } = syncMagicTimelinePosition();

    if (
      magicPlaybackRef.current === "playing" &&
      magicDirectionRef.current === "forward"
    ) {
      setMagicPlaybackState("paused");
      return;
    }

    playMagicFrom(
      "forward",
      magicPlaybackRef.current === "ended" && positionMs >= durationMs
        ? 0
        : positionMs
    );
  };
  const handleMagicRewind = () => {
    if (!selectedResult) return;

    const { durationMs, positionMs } = syncMagicTimelinePosition();

    if (
      magicPlaybackRef.current === "playing" &&
      magicDirectionRef.current === "reverse"
    ) {
      setMagicPlaybackState("paused");
      return;
    }

    playMagicFrom(
      "reverse",
      positionMs <= 0 ? durationMs : positionMs
    );
  };
  const handleMagicAnimationChange = (value: number) => {
    setMagicAnimationIndex(value);
    playMagicFrom(magicDirectionRef.current, undefined, value);
  };
  const handleMagicSpeedChange = (value: MagicSpeed) => {
    if (value === magicSpeedRef.current) return;

    const playback = magicPlaybackRef.current;
    const direction = magicDirectionRef.current;
    const { positionMs } = syncMagicTimelinePosition();

    setMagicSpeedState(value);

    if (!selectedResult) return;

    setMagicTimeline(selectedResult, magicAnimationIndex, direction, positionMs);
    setMagicDirectionState(direction);
    setMagicPlaybackState(playback);
    setMagicReplayKey((key) => key + 1);
  };
  const handleMagicPlaybackModeChange = (value: MagicPlaybackMode) => {
    setMagicPlaybackMode(value);
  };
  const restartMagicDrawing = () => {
    if (!selectedResult) return;

    magicTimelinePositionMsRef.current = 0;
    setMagicDirectionState("forward");
    setMagicPlaybackState("playing");
    setMagicReplayKey((key) => key + 1);
  };
  const applyMagicDrawVariant = (variant: MagicDrawVariantOption) => {
    const nextMode = variant.mode;
    if (nextMode !== undefined) {
      setStarMode(nextMode);
      setAngleToleranceDeg((current) =>
        Math.min(current, maxAngleToleranceForMode(nextMode))
      );
    }
    restartMagicDrawing();
  };
  const handleMagicDrawShapeChange = (value: string) => {
    if (!isMagicDrawShape(value)) return;

    const nextVariant = getMagicDrawVariantOption(
      value,
      magicDrawVariantByShape[value]
    );
    setMagicDrawShape(value);
    setMagicDrawVariantByShape((current) => ({
      ...current,
      [value]: nextVariant.id
    }));
    applyMagicDrawVariant(nextVariant);
  };
  const handleMagicDrawVariantChange = (value: string) => {
    const nextVariant = getMagicDrawVariantOption(magicDrawShape, value);
    setMagicDrawVariantByShape((current) => ({
      ...current,
      [magicDrawShape]: nextVariant.id
    }));
    applyMagicDrawVariant(nextVariant);
  };
  const stepMagicPlaybackMode = (step: number) => {
    handleMagicPlaybackModeChange(
      getSteppedOption(
        MAGIC_PLAYBACK_MODES.map((mode) => mode.id),
        magicPlaybackMode,
        step
      )
    );
  };
  const stepMagicAnimation = (step: number) => {
    const nextIndex = getSteppedOption(
      magicAnimationOptions.map((option) => option.index),
      magicAnimationIndex,
      step
    );
    handleMagicAnimationChange(nextIndex);
  };
  const stepMagicSpeed = (step: number) => {
    handleMagicSpeedChange(
      getSteppedOption(MAGIC_SPEED_OPTIONS, magicSpeedRef.current, step)
    );
  };
  const preventMagicSelectScroll = (
    event: WheelEvent<HTMLElement> | TouchEvent<HTMLElement>
  ) => {
    event.preventDefault();
    event.stopPropagation();
  };
  const lockMagicSelectPageScroll = () => {
    if (
      typeof document === "undefined" ||
      magicSelectScrollLockRef.current !== null
    ) {
      return;
    }

    magicSelectScrollLockRef.current = {
      bodyOverflow: document.body.style.overflow,
      bodyTouchAction: document.body.style.touchAction,
      htmlOverflow: document.documentElement.style.overflow
    };
    document.documentElement.style.overflow = "hidden";
    document.body.style.overflow = "hidden";
    document.body.style.touchAction = "none";
  };
  const unlockMagicSelectPageScroll = () => {
    if (
      typeof document === "undefined" ||
      magicSelectScrollLockRef.current === null
    ) {
      return;
    }

    const previousState = magicSelectScrollLockRef.current;
    document.documentElement.style.overflow = previousState.htmlOverflow;
    document.body.style.overflow = previousState.bodyOverflow;
    document.body.style.touchAction = previousState.bodyTouchAction;
    magicSelectScrollLockRef.current = null;
  };
  const clearMagicSelectTouch = (touchRef: MagicSelectTouchRef) => {
    const state = touchRef.current;
    if (state && state.timerId !== null) {
      window.clearTimeout(state.timerId);
    }
    if (state?.isLongPressActive) {
      unlockMagicSelectPageScroll();
    }
    touchRef.current = null;
  };
  const startMagicSelectTouch = (
    event: TouchEvent<HTMLElement>,
    touchRef: MagicSelectTouchRef
  ) => {
    const startY = event.touches[0]?.clientY;
    if (startY === undefined) return;

    clearMagicSelectTouch(touchRef);

    const touchState: MagicSelectTouchState = {
      startY,
      lastStepY: startY,
      isLongPressActive: false,
      timerId: null
    };

    touchState.timerId = window.setTimeout(() => {
      touchState.isLongPressActive = true;
      touchState.lastStepY = touchState.startY;
      touchState.timerId = null;
      lockMagicSelectPageScroll();
    }, MAGIC_SELECT_LONG_PRESS_MS);

    touchRef.current = touchState;
  };
  const moveMagicSelectTouch = (
    event: TouchEvent<HTMLElement>,
    touchRef: MagicSelectTouchRef,
    stepOption: (step: number) => void
  ) => {
    const touchState = touchRef.current;
    const currentY = event.touches[0]?.clientY;
    if (!touchState || currentY === undefined) return;

    if (!touchState.isLongPressActive) {
      if (
        Math.abs(currentY - touchState.startY) >=
        MAGIC_SELECT_SCROLL_CANCEL_PX
      ) {
        clearMagicSelectTouch(touchRef);
      }
      return;
    }

    preventMagicSelectScroll(event);

    const deltaY = currentY - touchState.lastStepY;
    const stepCount = Math.trunc(
      Math.abs(deltaY) / MAGIC_SELECT_TOUCH_STEP_PX
    );
    if (stepCount === 0) return;

    stepOption(deltaY < 0 ? stepCount : -stepCount);
    touchState.lastStepY = currentY;
  };
  const endMagicSelectTouch = (
    event: TouchEvent<HTMLElement>,
    touchRef: MagicSelectTouchRef
  ) => {
    const wasLongPressActive =
      touchRef.current?.isLongPressActive ?? false;

    clearMagicSelectTouch(touchRef);

    if (wasLongPressActive) {
      preventMagicSelectScroll(event);
    }
  };
  const handleMagicPlaybackModeWheel = (event: WheelEvent<HTMLElement>) => {
    preventMagicSelectScroll(event);
    stepMagicPlaybackMode(event.deltaY > 0 ? 1 : -1);
  };
  const handleMagicAnimationWheel = (event: WheelEvent<HTMLElement>) => {
    preventMagicSelectScroll(event);
    stepMagicAnimation(event.deltaY > 0 ? 1 : -1);
  };
  const handleMagicSpeedWheel = (event: WheelEvent<HTMLElement>) => {
    preventMagicSelectScroll(event);
    stepMagicSpeed(event.deltaY > 0 ? 1 : -1);
  };
  const handleMagicPlaybackModeTouchStart = (
    event: TouchEvent<HTMLElement>
  ) => {
    startMagicSelectTouch(event, magicPlaybackModeTouchRef);
  };
  const handleMagicAnimationTouchStart = (event: TouchEvent<HTMLElement>) => {
    startMagicSelectTouch(event, magicAnimationTouchRef);
  };
  const handleMagicSpeedTouchStart = (event: TouchEvent<HTMLElement>) => {
    startMagicSelectTouch(event, magicSpeedTouchRef);
  };
  const handleMagicPlaybackModeTouchMove = (
    event: TouchEvent<HTMLElement>
  ) => {
    moveMagicSelectTouch(
      event,
      magicPlaybackModeTouchRef,
      stepMagicPlaybackMode
    );
  };
  const handleMagicAnimationTouchMove = (event: TouchEvent<HTMLElement>) => {
    moveMagicSelectTouch(event, magicAnimationTouchRef, stepMagicAnimation);
  };
  const handleMagicSpeedTouchMove = (event: TouchEvent<HTMLElement>) => {
    moveMagicSelectTouch(event, magicSpeedTouchRef, stepMagicSpeed);
  };
  const handleMagicPlaybackModeTouchEnd = (event: TouchEvent<HTMLElement>) => {
    endMagicSelectTouch(event, magicPlaybackModeTouchRef);
  };
  const handleMagicAnimationTouchEnd = (event: TouchEvent<HTMLElement>) => {
    endMagicSelectTouch(event, magicAnimationTouchRef);
  };
  const handleMagicSpeedTouchEnd = (event: TouchEvent<HTMLElement>) => {
    endMagicSelectTouch(event, magicSpeedTouchRef);
  };
  const handleMagicPlaybackModeTouchCancel = (
    event: TouchEvent<HTMLElement>
  ) => {
    endMagicSelectTouch(event, magicPlaybackModeTouchRef);
  };
  const handleMagicAnimationTouchCancel = (event: TouchEvent<HTMLElement>) => {
    endMagicSelectTouch(event, magicAnimationTouchRef);
  };
  const handleMagicSpeedTouchCancel = (event: TouchEvent<HTMLElement>) => {
    endMagicSelectTouch(event, magicSpeedTouchRef);
  };

  useEffect(() => () => unlockMagicSelectPageScroll(), []);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;

    const mediaQuery = window.matchMedia("(max-width: 900px)");
    const updateMobileLayout = () => setIsMobileLayout(mediaQuery.matches);
    updateMobileLayout();
    mediaQuery.addEventListener("change", updateMobileLayout);

    return () => {
      mediaQuery.removeEventListener("change", updateMobileLayout);
    };
  }, []);

  useLayoutEffect(() => {
    if (typeof window === "undefined" || !isMobileLayout) return;

    setMobileMapSplitPercent(getMobileSearchDrawSplitPercent());
  }, [isMobileLayout]);

  useEffect(() => {
    if (typeof window === "undefined" || !isMobileLayout) return undefined;

    const clampCurrentSplit = () => {
      setMobileMapSplitPercent((current) => clampMobileSplitPercent(current));
    };

    clampCurrentSplit();
    window.addEventListener("resize", clampCurrentSplit);

    return () => window.removeEventListener("resize", clampCurrentSplit);
  }, [isMobileLayout]);

  const fitMapToResult = (result: StarResult) => {
    const bounds =
      magicGeometryPattern === "combined"
        ? makeStarBounds(result)
        : makeRadiusBounds(result.center, result.radiusMeanMeters * 1.18);

    mapRef.current?.fitBounds(bounds.pad(0.08), {
      animate: true,
      duration: 0.8,
      maxZoom: 13,
      padding: [34, 34]
    });
  };

  useEffect(() => {
    if (!mapElementRef.current || mapRef.current) return;

    const map = L.map(mapElementRef.current, {
      zoomControl: false
    });
    map.fitBounds(makeRadiusBounds(center, outerRadiusMeters).pad(0.08), {
      animate: false,
      maxZoom: 13,
      padding: [34, 34]
    });

    L.control.zoom({ position: "bottomright" }).addTo(map);

    centerLayerRef.current = L.layerGroup().addTo(map);
    honeycombLayerRef.current = L.layerGroup().addTo(map);
    sectorLayerRef.current = L.layerGroup().addTo(map);
    poiLayerRef.current = L.layerGroup().addTo(map);
    starLayerRef.current = L.layerGroup().addTo(map);
    map.on("click", (event: L.LeafletMouseEvent) => {
      if (blockMagicCenterMoveIfLocked()) return;

      const nextCenter = {
        lat: event.latlng.lat,
        lng: event.latlng.lng
      };
      setCenter(nextCenter);
      setCenterName(formatCoordinate(nextCenter));
      setStatus("中心游標已移動，重新搜尋即可用新的圓心計算。");
      setError("");
    });

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
      tileLayerRef.current = null;
      centerLayerRef.current = null;
      honeycombLayerRef.current = null;
      sectorLayerRef.current = null;
      poiLayerRef.current = null;
      starLayerRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    tileLayerRef.current?.remove();
    tileLayerRef.current = createBaseTileLayer(mapLayer).addTo(map);
    tileLayerRef.current.setZIndex(0);
  }, [mapLayer]);

  useEffect(
    () => () => {
      clearProgressTimer();
      clearCompletionNoticeTimer();
      clearMagicPlaybackTimer();
      placeSearchRequestIdRef.current += 1;
      placeSearchAbortControllerRef.current?.abort();
      placeSearchAbortControllerRef.current = null;
    },
    []
  );

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
  }, [theme]);

  useEffect(() => {
    saveFavorites(favorites);
  }, [favorites]);

  useEffect(() => {
    if (selectedResult) saveLastStar(selectedResult);
  }, [selectedResult]);

  useEffect(() => {
    magicPlaybackRef.current = magicPlayback;
    magicDirectionRef.current = magicDirection;
    setMagicLayerPlayback(starLayerRef.current, magicPlayback, magicDirection);
  }, [magicPlayback, magicDirection]);

  useEffect(() => {
    if (!selectedResult) return;
    setMagicTimeline(selectedResult, magicAnimationIndex, "forward", 0);
    setMagicDirectionState("forward");
    setMagicPlaybackState("playing");
    setMagicReplayKey((key) => key + 1);
  }, [selectedResult?.id]);

  useEffect(() => {
    clearMagicPlaybackTimer();

    if (!selectedResult) {
      magicPlaybackStartedAtRef.current = null;
      magicTimelineDurationMsRef.current = 0;
      magicTimelinePositionMsRef.current = 0;
      return;
    }

    if (magicPlayback !== "playing") {
      syncMagicTimelinePosition();
      return;
    }

    if (magicTimelineDurationMsRef.current <= 0) {
      const durationMs = setMagicTimeline(
        selectedResult,
        magicAnimationIndex,
        magicDirection,
        0
      );
      magicTimelinePositionMsRef.current = getMagicBoundaryPosition(
        magicDirection,
        durationMs
      );
    }

    const { durationMs, positionMs } = syncMagicTimelinePosition();
    const timeToBoundaryMs =
      magicDirection === "reverse"
        ? positionMs
        : durationMs - positionMs;

    if (timeToBoundaryMs <= 0) {
      magicTimelinePositionMsRef.current =
        magicDirection === "reverse" ? 0 : durationMs;
      magicPlaybackStartedAtRef.current = null;
      continueMagicPlaybackFromEndpoint(magicDirection);
      return;
    }

    magicPlaybackStartedAtRef.current = performance.now();
    magicPlaybackTimerRef.current = window.setTimeout(() => {
      magicTimelinePositionMsRef.current =
        magicDirection === "reverse" ? 0 : durationMs;
      magicPlaybackStartedAtRef.current = null;
      continueMagicPlaybackFromEndpoint(magicDirection);
    }, timeToBoundaryMs / magicSpeed + MAGIC_TIMELINE_END_PADDING_MS);

    return clearMagicPlaybackTimer;
  }, [
    magicAnimationIndex,
    magicDirection,
    magicGeometryPattern,
    magicGeometryVariantKey,
    magicPlayback,
    magicPlaybackMode,
    magicReplayKey,
    magicSpeed,
    selectedResult
  ]);

  useEffect(() => {
    saveSettings({
      innerRadiusKm,
      outerRadiusKm,
      starMode,
      angleToleranceDeg: effectiveAngleToleranceDeg,
      candidatesPerSlot,
      rotationStepDeg,
      searchStrategy,
      hexCellRadiusKm,
      showSectors,
      showHoneycomb,
      selectedCategoryIds,
      selectedCategoryGroups,
      categoryGroupSelectionSnapshots,
      theme,
      mapLayer
    });
  }, [
    candidatesPerSlot,
    categoryGroupSelectionSnapshots,
    effectiveAngleToleranceDeg,
    hexCellRadiusKm,
    innerRadiusKm,
    outerRadiusKm,
    rotationStepDeg,
    searchStrategy,
    selectedCategoryIds,
    selectedCategoryGroups,
    showHoneycomb,
    showSectors,
    starMode,
    theme,
    mapLayer
  ]);

  useEffect(() => {
    const group = centerLayerRef.current;
    if (!group) return;
    group.clearLayers();

    L.circle([center.lat, center.lng], {
      radius: outerRadiusMeters,
      color: "#44546a",
      weight: 1,
      opacity: 0.65,
      fillColor: "#f2a12b",
      fillOpacity: 0.05
    }).addTo(group);

    if (innerRadiusMeters > 0) {
      L.circle([center.lat, center.lng], {
        radius: innerRadiusMeters,
        color: "#df8a1f",
        weight: 1,
        opacity: 0.8,
        dashArray: "5 5",
        fillColor: "#ffffff",
        fillOpacity: 0.04
      }).addTo(group);
    }

    L.marker([center.lat, center.lng], { icon: makeCenterIcon() })
      .bindTooltip("中心點", { direction: "top" })
      .addTo(group);
  }, [center, innerRadiusMeters, outerRadiusMeters]);

  useEffect(() => {
    const group = honeycombLayerRef.current;
    if (!group) return;
    group.clearLayers();
    if (!showHoneycomb || searchStrategy !== "honeycomb") return;

    const cells = makeHoneycombPreviewCells(makeHoneycombSearchParams({
      profile: honeycombSearchProfile,
      mode: starMode,
      center,
      innerRadiusMeters: effectiveInnerRadiusMeters,
      outerRadiusMeters,
      rotationStepDeg,
      hexCellRadiusMeters: hexCellRadiusKm * 1000
    }));

    cells.forEach((cell) => {
      const isCompleted =
        honeycombCompletedTargetCount !== null &&
        cell.order <= honeycombCompletedTargetCount;
      L.polygon(
        cell.polygon.map(({ lat, lng }) => [lat, lng] as L.LatLngTuple),
        {
          color: cell.ring === 0 ? "#263fd1" : "#4b65d9",
          fillColor: cell.ring === 0 ? "#f2a12b" : "#6aa3ff",
          fillOpacity: cell.ring === 0 ? 0.12 : 0.07,
          interactive: false,
          opacity: 0.55,
          weight: cell.ring === 0 ? 1.35 : 1
        }
      ).addTo(group);
      L.marker([cell.targetCenter.lat, cell.targetCenter.lng], {
        icon: makeHoneycombOrderIcon(cell.order, isCompleted),
        interactive: false,
        keyboard: false,
        zIndexOffset: -900
      })
        .bindTooltip(cell.targetLabel, {
          direction: "top",
          opacity: 0.78
        })
        .addTo(group);
    });
  }, [
    center,
    effectiveInnerRadiusMeters,
    hexCellRadiusKm,
    honeycombCompletedTargetCount,
    honeycombSearchProfile,
    outerRadiusMeters,
    rotationStepDeg,
    searchStrategy,
    showHoneycomb,
    starMode
  ]);

  useEffect(() => {
    const group = poiLayerRef.current;
    if (!group) return;
    group.clearLayers();

    visiblePois.slice(0, MAX_RENDERED_POIS).forEach((poi) => {
      const marker = L.circleMarker([poi.lat, poi.lng], {
        radius: 5,
        color: poi.categoryColor,
        fillColor: poi.categoryColor,
        fillOpacity: 0.7,
        weight: 1.5,
        opacity: 0.85
      });
      marker.bindTooltip(`${poi.name}<br>${poi.categoryLabel}`, {
        direction: "top"
      });
      marker.on("click", () => setSelectedPoi(poi));
      marker.addTo(group);
    });
  }, [visiblePois]);

  useEffect(() => {
    const group = sectorLayerRef.current;
    if (!group) return;
    group.clearLayers();
    if (!showSectors || !selectedResult || magicGeometryPattern !== "combined") {
      return;
    }

    const slotWidth = 360 / selectedResult.mode;
    const sectorHalfWidth = Math.min(slotWidth / 2, effectiveAngleToleranceDeg);
    for (let index = 0; index < selectedResult.mode; index += 1) {
      const target = selectedResult.rotationDeg + slotWidth * index;
      L.polygon(
        makeSectorPolygon(
          selectedResult.center,
          effectiveInnerRadiusMeters,
          outerRadiusMeters,
          target - sectorHalfWidth,
          target + sectorHalfWidth
        ),
        {
          color: "#df8a1f",
          weight: 1,
          opacity: 0.55,
          fillColor: index % 2 === 0 ? "#f2a12b" : "#f6c15b",
          fillOpacity: 0.13,
          interactive: false
        }
      ).addTo(group);
    }
  }, [
    effectiveAngleToleranceDeg,
    effectiveInnerRadiusMeters,
    magicGeometryPattern,
    magicGeometryVariantKey,
    outerRadiusMeters,
    selectedResult,
    showSectors
  ]);

  useEffect(() => {
    const group = starLayerRef.current;
    if (!group) return;
    group.clearLayers();
    if (!selectedResult) return;

    const magicElement = getMagicElement(magicAnimationIndex);
    const magicStrokes = makeMagicCircleStrokes(
      selectedResult,
      magicAnimationIndex,
      magicGeometryPattern,
      magicGeometryOptions
    );
    const timelineDurationMs = getMagicTimelineDurationMs(
      selectedResult,
      magicStrokes
    );
    const timelinePositionMs = clampMagicTimelinePosition(
      magicTimelinePositionMsRef.current,
      timelineDurationMs
    );
    magicTimelineDurationMsRef.current = timelineDurationMs;
    magicTimelinePositionMsRef.current = timelinePositionMs;

    magicStrokes.forEach((stroke) => {
      const layer =
        stroke.kind === "circle"
          ? L.circle([stroke.center.lat, stroke.center.lng], {
              radius: stroke.radiusMeters,
              color: stroke.color,
              weight: stroke.weight,
              opacity: stroke.opacity,
              fill: false,
              interactive: false,
              className: stroke.className
            })
          : stroke.kind === "symbol"
            ? L.marker([stroke.position.lat, stroke.position.lng], {
                icon: makeMagicSymbolIcon(stroke),
                interactive: false,
                keyboard: false,
                zIndexOffset:
                  stroke.role === "center"
                    ? 760
                    : stroke.role === "endpoint"
                      ? 820
                      : 560
              })
            : L.polyline(
                stroke.points.map(
                  (point) => [point.lat, point.lng] as L.LatLngExpression
                ),
                {
                  color: stroke.color,
                  weight: stroke.weight,
                  opacity: stroke.opacity,
                  interactive: false,
                  className: stroke.className
                }
              );

      layer.addTo(group);
      applyMagicStrokeTiming(
        layer,
        stroke,
        magicSpeed,
        magicPlaybackRef.current,
        magicDirectionRef.current,
        timelineDurationMs,
        timelinePositionMs
      );
    });

    selectedResult.points.forEach((poi, index) => {
      const marker = L.circleMarker([poi.lat, poi.lng], {
        radius: magicGeometryPattern === "combined" ? 14 : 12,
        color: magicElement.accent,
        weight: 1,
        opacity: 0.38,
        fillColor: magicElement.pale,
        fillOpacity: magicGeometryPattern === "combined" ? 0.2 : 0.26,
        className: `star-point star-point--appear magic-element--${magicElement.id}`
      })
        .bindTooltip(
          `${
            magicGeometryPattern === "combined" ? "" : "目標 "
          }${index + 1}. ${poi.name}`,
          {
            direction: "bottom",
            offset: [0, 22],
            permanent: true,
            className: "star-label star-label--below"
          }
        )
        .on("click", () => setSelectedPoi(poi))
        .addTo(group);
      const markerElement = marker.getElement() as SVGElement | null;
      markerElement?.classList.add("magic-drawable");
      if (markerElement) {
        applyMagicMarkerTiming(
          markerElement,
          MAGIC_POINT_DELAY_MS + index * MAGIC_POINT_STEP_MS,
          MAGIC_POINT_DURATION_MS,
          magicSpeed,
          magicPlaybackRef.current,
          magicDirectionRef.current,
          timelineDurationMs,
          timelinePositionMs
        );
      }
    });
  }, [
    magicAnimationIndex,
    magicDirection,
    magicGeometryPattern,
    magicGeometryVariantKey,
    magicReplayKey,
    magicSpeed,
    selectedResult
  ]);

  useEffect(() => {
    if (!selectedResult) return;
    fitMapToResult(selectedResult);
  }, [magicGeometryPattern, magicGeometryVariantKey, selectedResult?.id]);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const frameId = window.requestAnimationFrame(() => {
      mapRef.current?.invalidateSize(false);
    });
    return () => window.cancelAnimationFrame(frameId);
  }, [mobileMapSplitPercent]);

  useEffect(() => {
    if (typeof document === "undefined") return undefined;
    const frameId = window.requestAnimationFrame(() => {
      document
        .querySelector<HTMLElement>(
          `[data-mobile-settings-tab="${activeMobileSettingsTab}"]`
        )
        ?.scrollIntoView({
          behavior: "smooth",
          block: "nearest",
          inline: "center"
        });
    });
    return () => window.cancelAnimationFrame(frameId);
  }, [activeMobileSettingsTab]);

  useEffect(() => {
    if (isSearchDrawing) return;

    if (skipNextAutoSolveRef.current) {
      const shouldSkip = skipNextAutoSolveRef.current === autoSolveKey;
      skipNextAutoSolveRef.current = null;
      if (shouldSkip) return;
    }

    if (pois.length === 0) return;

    const startedAtMs = getNowMs();
    const startedAtIso = new Date().toISOString();
    const nextResults = solveStarFromPois(pois, solverParams);
    const finishedAtMs = getNowMs();
    setResults(nextResults);
    setSelectedResultIndex(0);
    const summary = makeDrawSummary({
      sourceLabel: "自動計算",
      startedAtMs,
      startedAtIso,
      finishedAtMs,
      firstResultElapsedMs:
        nextResults.length > 0 ? finishedAtMs - startedAtMs : null,
      firstResultAtIso:
        nextResults.length > 0 ? new Date().toISOString() : null,
      firstResultSourceLabel: nextResults.length > 0 ? "自動計算" : null,
      solveElapsedMs: finishedAtMs - startedAtMs,
      renderElapsedMs: 0,
      nextResults,
      nextPois: pois,
      nextCenter: center,
      nextCenterLabel: centerName
    });
    addCalculationRecord(makeCalculationRecordFromSummary(summary));
    if (nextResults.length === 0) {
      setStatus(
        `目前 ${countPoisInCurrentRange(pois)} 個範圍內候選點不足以形成穩定的圖案。`
      );
      return;
    }
    setStatus(formatDrawSummaryStatus(summary));
  }, [autoSolveKey, isSearchDrawing, solverParams]);

  const runSolverProgressively = async ({
    nextPois,
    nextCenter,
    signal,
    initialBestScore,
    onFirstResult
  }: {
    nextPois: Poi[];
    nextCenter: LatLng;
    signal?: AbortSignal;
    initialBestScore: number | null;
    onFirstResult: (sourceLabel: string) => void;
  }) => {
    const iterator = solveStarFromPoisSteps(nextPois, {
      ...solverParams,
      center: nextCenter
    });
    let bestScore = initialBestScore;
    let lastResultsSignature = "";
    let finalResults: StarResult[] = [];
    let step = iterator.next();

    while (!step.done) {
      if (signal?.aborted) {
        throw new DOMException("已取消搜索。", "AbortError");
      }

      const progress = step.value;
      const progressResults = progress.results;
      const resultsSignature = progressResults
        .map((result) => `${result.id}:${result.score.toFixed(6)}`)
        .join("|");

      setProgressStep(
        getSolveProgressPercent(searchStrategy, progress),
        getSolveProgressLabel(progress)
      );
      if (searchStrategy === "honeycomb") {
        setHoneycombCompletedTargetCount(
          progress.completedSteps * solverParams.mode
        );
      }

      if (
        progressResults.length > 0 &&
        resultsSignature !== lastResultsSignature
      ) {
        finalResults = progressResults;
        lastResultsSignature = resultsSignature;
        setResults(progressResults);
        setSelectedResultIndex(0);
      }

      if (
        progress.bestResult &&
        (bestScore === null || progress.bestResult.score < bestScore - 0.000001)
      ) {
        const isFirstResult = bestScore === null;
        bestScore = progress.bestResult.score;
        onFirstResult(
          progress.stage === "angular" ? "角度搜索" : "蜂巢搜索"
        );
        showMagicFoundNotice(
          progress.bestResult,
          isFirstResult ? "找到第一個魔法陣" : "找到分數更好的魔法陣",
          progressResults.length
        );
      }

      await waitForPaint();
      step = iterator.next();
    }

    finalResults = step.value;
    setResults(finalResults);
    setSelectedResultIndex(0);
    if (searchStrategy === "honeycomb") {
      setHoneycombCompletedTargetCount(Number.POSITIVE_INFINITY);
    }

    return { results: finalResults, bestScore };
  };

  const resolveSearchCenter = async (
    requireInput: boolean,
    signal?: AbortSignal
  ) => {
    const searchValue = searchText.trim();
    if (!searchValue) {
      if (requireInput) throw new Error("請輸入地標、地址或座標。");
      return { center, label: centerName, searched: false };
    }

    const selectedCandidate =
      placeCandidateQuery === searchValue && selectedPlaceCandidateId
        ? placeCandidates.find(
            (candidate) => candidate.id === selectedPlaceCandidateId
          ) ?? null
        : null;
    const nextCandidates = selectedCandidate
      ? placeCandidates
      : await searchPlaces(searchValue, { signal });
    const result = selectedCandidate ?? nextCandidates[0];
    if (!result) throw new Error("找不到這個地點，請換個名稱或輸入座標。");
    if (!selectedCandidate) {
      setPlaceCandidates(nextCandidates);
      setPlaceCandidateQuery(searchValue);
      setSelectedPlaceCandidateId(result.id);
    }
    setCenterFromPlaceCandidate(result, { allowWhileLocked: true });
    return { ...result, searched: true };
  };

  const handleSearchPlace = async () => {
    placeSearchAbortControllerRef.current?.abort();
    const requestId = placeSearchRequestIdRef.current + 1;
    const controller = new AbortController();
    placeSearchRequestIdRef.current = requestId;
    placeSearchAbortControllerRef.current = controller;

    setLoading(true);
    setError("");
    try {
      const candidates = await searchPlaces(searchText, {
        signal: controller.signal
      });
      if (placeSearchRequestIdRef.current !== requestId) return;

      setPlaceCandidates(candidates);
      setPlaceCandidateQuery(searchText.trim());
      setSelectedPlaceCandidateId(null);
      setStatus(
        `找到 ${candidates.length} 個候選地點，請選擇前往或設置中心。`
      );
    } catch (searchError) {
      if (
        placeSearchRequestIdRef.current !== requestId ||
        (searchError instanceof Error && searchError.name === "AbortError")
      ) {
        return;
      }
      setError(searchError instanceof Error ? searchError.message : "搜尋失敗。");
    } finally {
      if (placeSearchRequestIdRef.current === requestId) {
        placeSearchAbortControllerRef.current = null;
        setLoading(false);
      }
    }
  };

  const handleLocate = () => {
    if (blockMagicCenterMoveIfLocked()) return;

    if (!navigator.geolocation) {
      setError("這個瀏覽器不支援目前位置功能。");
      return;
    }

    setLoading(true);
    setError("");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        if (blockMagicCenterMoveIfLocked()) {
          setLoading(false);
          return;
        }

        const nextCenter = {
          lat: position.coords.latitude,
          lng: position.coords.longitude
        };
        setCenter(nextCenter);
        setCenterName("目前位置");
        mapRef.current?.setView([nextCenter.lat, nextCenter.lng], 13);
        setStatus("已使用目前位置放置中心游標。");
        setLoading(false);
      },
      () => {
        setError("無法取得目前位置，請確認定位權限。");
        setLoading(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000
      }
    );
  };

  const handleFetchAndSolve = async () => {
    if (isSearchDrawing) {
      handleCancelSearch();
      return;
    }

    const startedAtMs = getNowMs();
    const startedAtIso = new Date().toISOString();
    let firstResultElapsedMs: number | null = null;
    let firstResultAtIso: string | null = null;
    let firstResultSourceLabel: string | null = null;
    let previewSolveCount = 0;
    let previewSolveElapsedMs = 0;
    let solveElapsedMs = 0;
    let searchElapsedMs: number | null = null;
    const markFirstResult = (sourceLabel: string) => {
      if (firstResultElapsedMs !== null) return;
      firstResultElapsedMs = getNowMs() - startedAtMs;
      firstResultAtIso = new Date().toISOString();
      firstResultSourceLabel = sourceLabel;
    };

    const searchController = new AbortController();
    searchAbortControllerRef.current = searchController;
    skipNextAutoSolveForCenter(center);
    isMagicCenterLockedRef.current = true;
    setIsSearchDrawing(true);
    setLoading(true);
    setError("");
    clearCompletionNotice();
    clearCurrentMagicCircle();
    setExpandedFavoriteId(null);
    setHoneycombCompletedTargetCount(
      searchStrategy === "honeycomb" ? 0 : null
    );
    let latestMergedPois = pois;
    let bestDisplayedScore: number | null = null;
    try {
      setProgressStep(8, "解析中心地點");
      const searchCenter = await resolveSearchCenter(
        false,
        searchController.signal
      );
      skipNextAutoSolveForCenter(searchCenter.center);
      await waitForPaint();
      setProgressStep(18, "準備搜尋範圍");
      await waitForPaint();

      if (searchStrategy === "honeycomb") {
        const honeycombSearchParams = makeHoneycombSearchParams({
          profile: honeycombSearchProfile,
          mode: starMode,
          center: searchCenter.center,
          innerRadiusMeters: effectiveInnerRadiusMeters,
          outerRadiusMeters,
          rotationStepDeg,
          hexCellRadiusMeters: hexCellRadiusKm * 1000
        });
        const honeycombCellRadiusMeters = normalizeHoneycombCellRadius(
          outerRadiusMeters,
          hexCellRadiusKm * 1000
        );
        const honeycombBatches = makeHoneycombSearchBatches(
          honeycombSearchParams
        );
        const totalHoneycombCells = honeycombBatches.reduce(
          (total, batch) => total + batch.cells.length,
          0
        );
        const honeycombWarnings: string[] = [];
        let fetchedPoiCount = 0;
        let searchedHoneycombCellCount = 0;
        let successfulHoneycombBatchCount = 0;

        const runHoneycombPreviewSolve = (
          isInitialBatch: boolean
        ): "first" | "better" | null => {
          const previewSolveStartedAtMs = getNowMs();
          const previewResults = solveStarFromPois(latestMergedPois, {
            ...solverParams,
            center: searchCenter.center,
            maxResults: 1,
            candidatesPerSlot: Math.max(
              1,
              Math.min(
                candidatesPerSlot,
                honeycombSearchProfile.fastCandidatesPerSlot
              )
            ),
            rotationStepDeg: isInitialBatch
              ? 360 / starMode
              : Math.max(
                  rotationStepDeg,
                  honeycombSearchProfile.fastRotationStepDeg
                ),
            hexPriorityRings: 0
          });
          previewSolveCount += 1;
          previewSolveElapsedMs += getNowMs() - previewSolveStartedAtMs;

          const previewBest = previewResults[0];
          if (
            !previewBest ||
            (bestDisplayedScore !== null &&
              previewBest.score >= bestDisplayedScore - 0.000001)
          ) {
            return null;
          }

          const isFirstResult = bestDisplayedScore === null;
          bestDisplayedScore = previewBest.score;
          markFirstResult(
            isInitialBatch ? "首批蜂巢" : "蜂巢背景精修"
          );
          setResults(previewResults);
          setSelectedResultIndex(0);
          showMagicFoundNotice(
            previewBest,
            isFirstResult ? "找到第一個魔法陣" : "找到分數更好的魔法陣",
            previewResults.length
          );
          return isFirstResult ? "first" : "better";
        };

        setProgressStep(
          28,
          `準備 ${honeycombBatches.length} 批蜂巢搜索`
        );
        await waitForPaint();

        for (const [batchIndex, batch] of honeycombBatches.entries()) {
          if (searchController.signal.aborted) {
            throw new DOMException("已取消搜索。", "AbortError");
          }

          setProgressStep(
            interpolateProgress(34, 58, batchIndex, honeycombBatches.length),
            `${batch.label}搜索中`
          );

          let progressLabel = `${batch.label}完成`;
          try {
            const cellKeys = new Set(batch.cells.map((cell) => cell.key));
            const batchResult = await fetchPoisForBoundsDetailed(
              searchCenter.center,
              batch.cells.map(getHoneycombCellBounds),
              selectedCategories,
              effectiveInnerRadiusMeters,
              outerRadiusMeters,
              {
                signal: searchController.signal,
                resultLimit: HONEYCOMB_BATCH_RESULT_LIMIT
              }
            );
            const batchPois = filterPoisByHoneycombCells(
              batchResult.pois,
              cellKeys,
              honeycombCellRadiusMeters
            );
            const previousPoiCount = latestMergedPois.length;
            latestMergedPois = mergePois(latestMergedPois, batchPois);
            const addedInBatch = latestMergedPois.length - previousPoiCount;
            fetchedPoiCount += batchPois.length;
            successfulHoneycombBatchCount += 1;
            honeycombWarnings.push(...batchResult.warnings);
            setPois(latestMergedPois);

            const previewStatus = runHoneycombPreviewSolve(batch.isInitial);
            progressLabel = `${batch.label}完成：新增 ${addedInBatch} 筆，累計 ${latestMergedPois.length} 筆`;
            if (firstResultElapsedMs !== null) {
              progressLabel += "，已繪製第一個魔法陣，背景精修中";
            }
            if (previewStatus === "better") {
              progressLabel += "，找到更好的魔法陣";
            }
          } catch (batchError) {
            if (
              batchError instanceof Error &&
              batchError.name === "AbortError"
            ) {
              throw batchError;
            }
            const message =
              batchError instanceof Error ? batchError.message : "未知錯誤";
            honeycombWarnings.push(`${batch.label}查詢失敗：${message}`);
            progressLabel = `${batch.label}查詢失敗，繼續下一批蜂巢`;
          }

          searchedHoneycombCellCount += batch.cells.length;
          setHoneycombCompletedTargetCount(searchedHoneycombCellCount);
          setProgressStep(
            interpolateProgress(
              34,
              58,
              batchIndex + 1,
              honeycombBatches.length
            ),
            `${progressLabel}（${searchedHoneycombCellCount}/${totalHoneycombCells} 蜂巢）`
          );
          await waitForPaint();
        }

        const mergedPois = latestMergedPois;
        const addedPoiCount = mergedPois.length - pois.length;
        setPois(mergedPois);
        setProgressStep(
          getAnalyzeProgressPercent(searchStrategy),
          `整理 ${mergedPois.length} 個蜂巢候選點`
        );
        await waitForPaint();
        const solveStartedAtMs = getNowMs();
        searchElapsedMs = solveStartedAtMs - startedAtMs;
        const progressiveResult = await runSolverProgressively({
          nextPois: mergedPois,
          nextCenter: searchCenter.center,
          signal: searchController.signal,
          initialBestScore: bestDisplayedScore,
          onFirstResult: markFirstResult
        });
        const nextResults = progressiveResult.results;
        solveElapsedMs = getNowMs() - solveStartedAtMs;
        setProgressStep(
          nextResults.length > 0 ? 92 : 88,
          nextResults.length > 0 ? "繪製魔法陣" : "整理計算結果"
        );
        const renderStartedAtMs = getNowMs();
        await waitForPaint();
        if (nextResults.length > 0) markFirstResult("最終計算");
        const finishedAtMs = getNowMs();
        const notes = [
          ...new Set(
            honeycombInnerRadiusNote
              ? [...honeycombWarnings, honeycombInnerRadiusNote]
              : honeycombWarnings
          )
        ];

        notes.push(
          `蜂巢批次搜索完成：成功 ${successfulHoneycombBatchCount}/${honeycombBatches.length} 批，已搜索 ${searchedHoneycombCellCount}/${totalHoneycombCells} 個蜂巢。`
        );

        const summary = makeDrawSummary({
          sourceLabel: "搜尋繪製",
          startedAtMs,
          startedAtIso,
          finishedAtMs,
          firstResultElapsedMs,
          firstResultAtIso,
          firstResultSourceLabel,
          searchElapsedMs,
          solveElapsedMs,
          previewSolveCount,
          previewSolveElapsedMs,
          renderElapsedMs: finishedAtMs - renderStartedAtMs,
          nextResults,
          nextPois: mergedPois,
          nextCenter: searchCenter.center,
          nextCenterLabel: searchCenter.label,
          fetchedPoiCount,
          addedPoiCount,
          notes,
          categoryCount: selectedCategories.length
        });
        addCalculationRecord(makeCalculationRecordFromSummary(summary));
        setStatus(formatDrawSummaryStatus(summary));
        showCompletionNotice(summary);
        completeProgress(formatDrawSummaryProgressLabel(summary));
        return;
      }

      setProgressStep(34, "下載地點資料");
      const { pois: nextPois, warnings } = await fetchPoisDetailed(
        searchCenter.center,
        outerRadiusMeters,
        selectedCategories,
        effectiveInnerRadiusMeters,
        {
          signal: searchController.signal,
          onCategoryResult: (progress) => {
            latestMergedPois = mergePois(latestMergedPois, progress.pois);
            setPois(latestMergedPois);
            const progressPercent = getCategoryDownloadProgressPercent(
              searchStrategy,
              progress.completedCategories,
              progress.totalCategories
            );
            const progressLabel = `${progress.category.label} 已搜索 ${progress.pois.length} 筆`;
            setProgressStep(progressPercent, progressLabel);
          }
        }
      );
      const mergedPois = mergePois(latestMergedPois, nextPois);
      const addedPoiCount = mergedPois.length - pois.length;
      setPois(mergedPois);
      setProgressStep(
        getAnalyzeProgressPercent(searchStrategy),
        `分析 ${mergedPois.length} 個候選點`
      );
      await waitForPaint();
      const solveStartedAtMs = getNowMs();
      searchElapsedMs = solveStartedAtMs - startedAtMs;
      const progressiveResult = await runSolverProgressively({
        nextPois: mergedPois,
        nextCenter: searchCenter.center,
        signal: searchController.signal,
        initialBestScore: bestDisplayedScore,
        onFirstResult: markFirstResult
      });
      const nextResults = progressiveResult.results;
      solveElapsedMs = getNowMs() - solveStartedAtMs;
      setProgressStep(
        nextResults.length > 0 ? 92 : 88,
        nextResults.length > 0 ? "繪製魔法陣" : "整理計算結果"
      );
      const renderStartedAtMs = getNowMs();
      await waitForPaint();
      if (nextResults.length > 0) markFirstResult("最終計算");
      const finishedAtMs = getNowMs();
      const notes = honeycombInnerRadiusNote
        ? [...warnings, honeycombInnerRadiusNote]
        : [...warnings];

      if (nextPois.length >= overpassResultLimit) {
        notes.push(
          `已讀取前 ${overpassResultLimit} 筆資料；若想更精準，請縮小外徑、提高內徑或減少類別。`
        );
      }

      const summary = makeDrawSummary({
        sourceLabel: "搜尋繪製",
        startedAtMs,
        startedAtIso,
        finishedAtMs,
        firstResultElapsedMs,
        firstResultAtIso,
        firstResultSourceLabel,
        searchElapsedMs,
        solveElapsedMs,
        previewSolveCount,
        previewSolveElapsedMs,
        renderElapsedMs: finishedAtMs - renderStartedAtMs,
        nextResults,
        nextPois: mergedPois,
        nextCenter: searchCenter.center,
        nextCenterLabel: searchCenter.label,
        fetchedPoiCount: nextPois.length,
        addedPoiCount,
        notes,
        categoryCount: selectedCategories.length
      });
      addCalculationRecord(makeCalculationRecordFromSummary(summary));
      setStatus(formatDrawSummaryStatus(summary));
      showCompletionNotice(summary);
      completeProgress(formatDrawSummaryProgressLabel(summary));
    } catch (fetchError) {
      if (fetchError instanceof Error && fetchError.name === "AbortError") {
        const finishedAtMs = getNowMs();
        addCalculationRecord(
          makeCalculationMessageRecord({
            status: "cancelled",
            sourceLabel: "搜尋繪製",
            title: "搜尋繪製已取消",
            message: "已取消搜索。",
            startedAtIso,
            startedAtMs,
            finishedAtMs
          })
        );
        setStatus("已取消搜索。");
        completeProgress("已取消搜索");
        return;
      }

      const finishedAtMs = getNowMs();
      const message =
        fetchError instanceof Error ? fetchError.message : "查詢失敗。";
      addCalculationRecord(
        makeCalculationMessageRecord({
          status: "failed",
          sourceLabel: "搜尋繪製",
          title: "搜尋繪製失敗",
          message,
          startedAtIso,
          startedAtMs,
          finishedAtMs
        })
      );
      resetProgress();
      setError(message);
    } finally {
      if (searchAbortControllerRef.current === searchController) {
        searchAbortControllerRef.current = null;
      }
      isMagicCenterLockedRef.current = false;
      setIsSearchDrawing(false);
      setLoading(false);
    }
  };

  const handleCategoryGroupToggle = (group: string, categoryIds: string[]) => {
    const isGroupLocked = selectedCategoryGroupSet.has(group);
    const categoryIdSet = new Set(categoryIds);

    if (isGroupLocked) {
      const hasSnapshot = Object.prototype.hasOwnProperty.call(
        categoryGroupSelectionSnapshots,
        group
      );
      const restoredCategoryIds = hasSnapshot
        ? categoryGroupSelectionSnapshots[group] ?? []
        : selectedCategoryIds.filter((id) => categoryIdSet.has(id));

      setSelectedCategoryGroups((current) =>
        current.filter((currentGroup) => currentGroup !== group)
      );
      setSelectedCategoryIds((current) => [
        ...current.filter((id) => !categoryIdSet.has(id)),
        ...restoredCategoryIds.filter((id) => categoryIdSet.has(id))
      ]);
      setCategoryGroupSelectionSnapshots((current) => {
        const next = { ...current };
        delete next[group];
        return next;
      });
      return;
    }

    setCategoryGroupSelectionSnapshots((current) => ({
      ...current,
      [group]: selectedCategoryIds.filter((id) => categoryIdSet.has(id))
    }));
    setSelectedCategoryGroups((current) => [...new Set([...current, group])]);
    setSelectedCategoryIds((current) => [
      ...new Set([...current, ...categoryIds])
    ]);
  };

  const handleCategoryToggle = (categoryId: string) => {
    const category = POI_CATEGORIES.find(({ id }) => id === categoryId);
    if (category && selectedCategoryGroupSet.has(category.group)) return;

    setSelectedCategoryIds((current) =>
      current.includes(categoryId)
        ? current.filter((id) => id !== categoryId)
        : [...current, categoryId]
    );
  };

  const addFavorite = (favorite: FavoriteItem) => {
    if (areFavoritesLocked) {
      setStatus("搜索繪製進行中，我的最愛已暫時鎖定。");
      return;
    }

    setFavorites((current) => {
      if (current.some((item) => item.id === favorite.id)) return current;
      return [favorite, ...current];
    });
    setStatus(`已加入我的最愛：${favorite.name}`);
  };

  const removeFavorite = (favoriteId: string) => {
    if (areFavoritesLocked) {
      setStatus("搜索繪製進行中，我的最愛已暫時鎖定。");
      return;
    }

    setFavorites((current) => current.filter((item) => item.id !== favoriteId));
    setExpandedFavoriteId((current) =>
      current === favoriteId ? null : current
    );
  };

  const restoreFavorite = (favorite: FavoriteItem) => {
    if (areFavoritesLocked) {
      setStatus("搜索繪製進行中，我的最愛已暫時鎖定。");
      return;
    }

    setError("");

    if (favorite.type === "poi") {
      const nextCenter = {
        lat: favorite.poi.lat,
        lng: favorite.poi.lng
      };
      setExpandedFavoriteId(favorite.id);
      setCenter(nextCenter);
      setCenterName(favorite.name);
      setSelectedPoi(favorite.poi);
      mapRef.current?.setView([nextCenter.lat, nextCenter.lng], 15);
      setStatus(`已移至我的最愛：${favorite.name}`);
      return;
    }

    const restoredStar = favorite.star;
    const maxPointDistanceKm = Math.min(
      MAX_RADIUS_KM,
      Math.max(
        1,
        Math.ceil(
          Math.max(
            restoredStar.radiusMeanMeters,
            ...restoredStar.points.map((point) => point.distanceMeters)
          ) / 1000
        )
      )
    );
    const nextInnerRadiusKm = Math.min(
      innerRadiusKm,
      maxPointDistanceKm - 1
    );
    const nextOuterRadiusKm = Math.max(outerRadiusKm, maxPointDistanceKm);
    const nextAngleToleranceDeg = Math.min(
      angleToleranceDeg,
      maxAngleToleranceForMode(restoredStar.mode)
    );
    const restoredMagicDrawShape = getMagicDrawShapeForMode(restoredStar.mode);
    const restoredHoneycombProfile = getHoneycombSearchProfile({
      shape: restoredMagicDrawShape,
      variantId: String(restoredStar.mode),
      mode: restoredStar.mode
    });

    skipNextAutoSolveRef.current = makeAutoSolveKey({
      mode: restoredStar.mode,
      center: restoredStar.center,
      innerRadiusKm: nextInnerRadiusKm,
      outerRadiusKm: nextOuterRadiusKm,
      angleToleranceDeg: nextAngleToleranceDeg,
      candidatesPerSlot,
      rotationStepDeg,
      searchStrategy,
      hexCellRadiusKm,
      honeycombProfileKey: restoredHoneycombProfile.key
    });
    setCenter(restoredStar.center);
    setCenterName(restoredStar.name ?? favorite.name);
    setStarMode(restoredStar.mode);
    setMagicDrawShape(restoredMagicDrawShape);
    setMagicDrawVariantByShape((current) => ({
      ...current,
      [restoredMagicDrawShape]: String(restoredStar.mode)
    }));
    setInnerRadiusKm(nextInnerRadiusKm);
    setOuterRadiusKm(nextOuterRadiusKm);
    setResults([restoredStar]);
    setSelectedResultIndex(0);
    setExpandedFavoriteId(favorite.id);
    setSelectedPoi(null);
    fitMapToResult(restoredStar);
    setStatus(
      `已恢復我的最愛：${favorite.name}，中心 ${formatCoordinate(
        restoredStar.center
      )}，並保留目前已搜尋的 POI。`
    );
  };

  const isPoiFavorite = (poi: Poi) =>
    favorites.some((favorite) => favorite.id === `poi-${poi.id}`);

  const isStarFavorite = (star: StarResult) =>
    favorites.some((favorite) => favorite.id === `star-${star.id}`);

  const getAutomaticNameForStar = (star: StarResult) =>
    makeAutomaticStarName({
      centerName,
      star
    });

  const addStarFavorite = (star: StarResult) => {
    addFavorite(
      makeStarFavorite(star, getAutomaticNameForStar(star))
    );
  };

  const addPoiFavorite = (poi: Poi) => {
    addFavorite(makePoiFavorite(poi));
  };

  const toggleStarFavorite = (star: StarResult) => {
    const favoriteId = `star-${star.id}`;
    if (isStarFavorite(star)) {
      removeFavorite(favoriteId);
      setStatus(`已從我的最愛移除：${getAutomaticNameForStar(star)}`);
      return;
    }

    addStarFavorite(star);
  };

  const exportStar = (result: StarResult, format: "gpx" | "kml") => {
    const namedResult = {
      ...result,
      name: getAutomaticNameForStar(result)
    };
    const content =
      format === "gpx"
        ? exportGpx("Mapping Star Result", namedResult.points, [
            namedResult
          ])
        : exportKml("Mapping Star Result", namedResult.points, [
            namedResult
          ]);
    downloadText(
      `mapping-star-result.${format}`,
      content,
      format === "gpx"
        ? "application/gpx+xml;charset=utf-8"
        : "application/vnd.google-earth.kml+xml;charset=utf-8"
    );
  };

  const exportFavorites = (format: "gpx" | "kml") => {
    if (areFavoritesLocked) {
      setStatus("搜索繪製進行中，我的最愛已暫時鎖定。");
      return;
    }

    if (favorites.length === 0) {
      setError("我的最愛目前是空的。");
      return;
    }

    const { pois: favoritePois, stars } = splitFavorites(favorites);
    const content =
      format === "gpx"
        ? exportGpx("Mapping Star Favorites", favoritePois, stars)
        : exportKml("Mapping Star Favorites", favoritePois, stars);
    downloadText(
      `mapping-star-favorites.${format}`,
      content,
      format === "gpx"
        ? "application/gpx+xml;charset=utf-8"
        : "application/vnd.google-earth.kml+xml;charset=utf-8"
    );
  };

  const magicPlayButtonLabel =
    !selectedResult
      ? "播放"
      : magicPlayback === "playing"
        ? magicDirection === "forward"
          ? "暫停"
          : "正放"
        : magicPlayback === "ended"
          ? "重新播放"
          : "播放";
  const magicRewindButtonLabel =
    magicPlayback === "playing" && magicDirection === "reverse"
      ? "暫停"
      : "倒放";
  const isMagicRewindActive =
    Boolean(selectedResult) &&
    magicPlayback === "playing" &&
    magicDirection === "reverse";
  const isMagicPlayActive =
    Boolean(selectedResult) &&
    magicPlayback === "playing" &&
    magicDirection === "forward";

  return (
    <main className="app-shell" ref={appShellRef} style={appShellStyle}>
      <aside
        className="sidebar"
        ref={sidebarRef}
        aria-label="地圖控制"
        onTouchCancel={() => {
          mobileSettingsSwipeRef.current = null;
          setMobileSettingsSwipeOffsetPx(0);
        }}
        onTouchEnd={handleMobileSettingsTouchEnd}
        onTouchMove={handleMobileSettingsTouchMove}
        onTouchStart={handleMobileSettingsTouchStart}
      >
        <section
          className="magic-player"
          ref={magicPlayerRef}
          aria-label="魔法陣播放器"
        >
          <div
            className="magic-player-controls"
            role="group"
            aria-label="播放控制"
          >
            <button
              className={
                isMagicRewindActive
                  ? "magic-control-button active"
                  : "magic-control-button"
              }
              type="button"
              aria-pressed={isMagicRewindActive}
              title={magicRewindButtonLabel}
              aria-label={`${magicRewindButtonLabel}魔法陣動畫`}
              onClick={handleMagicRewind}
              disabled={!selectedResult}
            >
              {isMagicRewindActive && selectedResult ? (
                <Pause size={18} />
              ) : (
                <Play
                  aria-hidden="true"
                  className="magic-icon--reverse"
                  size={18}
                />
              )}
            </button>
            <button
              className={
                isMagicPlayActive
                  ? "magic-control-button magic-control-button--primary active"
                  : "magic-control-button magic-control-button--primary"
              }
              type="button"
              aria-pressed={isMagicPlayActive}
              title={magicPlayButtonLabel}
              aria-label={`${magicPlayButtonLabel}魔法陣動畫`}
              onClick={handleMagicPlaybackToggle}
              disabled={!selectedResult}
            >
              {isMagicPlayActive && selectedResult ? (
                <Pause size={18} />
              ) : (
                <Play size={18} />
              )}
            </button>
          </div>
          <div className="magic-player-fields">
            <MarqueeSelect
              label="模式"
              value={magicPlaybackMode}
              valueLabel={magicPlaybackModeLabel}
              onChange={(value) =>
                handleMagicPlaybackModeChange(value as MagicPlaybackMode)
              }
              onTouchCancel={handleMagicPlaybackModeTouchCancel}
              onTouchEnd={handleMagicPlaybackModeTouchEnd}
              onTouchMove={handleMagicPlaybackModeTouchMove}
              onTouchStart={handleMagicPlaybackModeTouchStart}
              onWheel={handleMagicPlaybackModeWheel}
            >
              {MAGIC_PLAYBACK_MODES.map((mode) => (
                <option value={mode.id} key={mode.id}>
                  {mode.label}
                </option>
              ))}
            </MarqueeSelect>
            <MarqueeSelect
              label="速度"
              value={magicSpeed}
              valueLabel={magicSpeedLabel}
              onChange={(value) =>
                handleMagicSpeedChange(parseMagicSpeed(value))
              }
              onTouchCancel={handleMagicSpeedTouchCancel}
              onTouchEnd={handleMagicSpeedTouchEnd}
              onTouchMove={handleMagicSpeedTouchMove}
              onTouchStart={handleMagicSpeedTouchStart}
              onWheel={handleMagicSpeedWheel}
            >
              {MAGIC_SPEED_OPTIONS.map((speed) => (
                <option value={speed} key={speed}>
                  {formatMagicSpeed(speed)}
                </option>
              ))}
            </MarqueeSelect>
            <MarqueeSelect
              label="圖案"
              value={magicAnimationIndex}
              valueLabel={magicAnimationLabel}
              onChange={(value) => handleMagicAnimationChange(Number(value))}
              onTouchCancel={handleMagicAnimationTouchCancel}
              onTouchEnd={handleMagicAnimationTouchEnd}
              onTouchMove={handleMagicAnimationTouchMove}
              onTouchStart={handleMagicAnimationTouchStart}
              onWheel={handleMagicAnimationWheel}
            >
              {magicAnimationOptions.map((option) => (
                <option value={option.index} key={option.index}>
                  {option.label}
                </option>
              ))}
            </MarqueeSelect>
          </div>
        </section>

        <section
          className="magic-draw-actions"
          ref={magicDrawActionsRef}
          aria-label="搜索繪製與圖案模式"
        >
          <button
            className="primary-button search-draw-button"
            type="button"
            onClick={() => void handleFetchAndSolve()}
            disabled={loading && !isSearchDrawing}
          >
            <Play size={17} />
            <span>{searchDrawButtonLabel}</span>
          </button>
          <label className="select-wrap select-wrap--compact pattern-mode-select magic-draw-select">
            <select
              aria-label="魔法陣形體"
              value={magicDrawShape}
              disabled={isSearchSettingsLocked}
              onChange={(event: ChangeEvent<HTMLSelectElement>) => {
                handleMagicDrawShapeChange(event.target.value);
              }}
            >
              {MAGIC_DRAW_SHAPE_OPTIONS.map(({ id, label }) => (
                <option value={id} key={id}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className="select-wrap select-wrap--compact pattern-mode-select magic-draw-select">
            <select
              aria-label={`${magicDrawShapeLabel}數值`}
              value={magicDrawVariantValue}
              disabled={isSearchSettingsLocked || isMagicDrawVariantLocked}
              title={
                isMagicDrawVariantLocked
                  ? `${magicDrawShapeLabel}只有 ${magicDrawVariantLabel} 一種數值`
                  : `${magicDrawShapeLabel} ${magicDrawVariantLabel}`
              }
              onChange={(event: ChangeEvent<HTMLSelectElement>) => {
                handleMagicDrawVariantChange(event.target.value);
              }}
            >
              {magicDrawVariantOptions.map(({ id, label }) => (
                <option value={id} key={id}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          {magicDrawShape === "zodiac" && (
            <div
              className="zodiac-number-grid"
              role="group"
              aria-label="十二星座數字切換"
            >
              {magicDrawVariantOptions.map(({ id, label }, index) => (
                <button
                  aria-label={`切換到 ${label}`}
                  aria-pressed={magicDrawVariantValue === id}
                  className={
                    magicDrawVariantValue === id
                      ? "zodiac-number-button selected"
                      : "zodiac-number-button"
                  }
                  disabled={isSearchSettingsLocked}
                  key={id}
                  title={label}
                  type="button"
                  onClick={() => handleMagicDrawVariantChange(id)}
                >
                  {index + 1}
                </button>
              ))}
            </div>
          )}
        </section>

        <nav className="mobile-settings-tabs" aria-label="手機設定頁籤">
          {MOBILE_SETTINGS_TABS.map((tab) => (
            <button
              aria-pressed={activeMobileSettingsTab === tab.id}
              className={activeMobileSettingsTab === tab.id ? "active" : ""}
              data-mobile-settings-tab={tab.id}
              key={tab.id}
              type="button"
              onClick={() => setActiveMobileSettingsTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </nav>

        <section className={getMobileTabPanelClass("search")}>
          {renderPanelTitle("search", "搜索中心", Crosshair)}
          <div className="search-row">
            <label className="input-wrap input-wrap--search">
              <input
                aria-label="地標、地址或座標"
                value={searchText}
                disabled={isSearchSettingsLocked}
                onChange={(event) =>
                  handleSearchTextChange(event.target.value)
                }
                onKeyDown={(event) => {
                  if (event.key === "Enter") void handleSearchPlace();
                }}
                placeholder="台北龍山寺 或 25.033964,121.564468"
              />
            </label>
            <button
              className="icon-button"
              type="button"
              title="搜尋地點"
              onClick={() => void handleSearchPlace()}
              disabled={loading || isSearchSettingsLocked}
            >
              <Search size={18} />
            </button>
          </div>
          {shouldShowPlaceCandidates && (
            <PlaceCandidateList
              candidates={placeCandidates}
              selectedCandidateId={selectedPlaceCandidateId}
              disabled={isSearchSettingsLocked}
              formatCoordinate={formatCoordinate}
              onGoToCandidate={handleGoToPlaceCandidate}
              onSetCandidate={handleSetPlaceCandidate}
            />
          )}
          <p className="coordinate">
            {formatCoordinate(center)}
          </p>
        </section>

        <section
          className={getMobileTabPanelClass(
            "categories",
            "panel categories-panel"
          )}
        >
          {renderPanelTitle("categories", "目標類別", MapPin)}
          <div className="category-stack">
            <div
              className={`category-groups ${
                areCategoryOptionsExpanded ? "category-groups--expanded" : ""
              }`}
              id="target-category-grid"
            >
              {CATEGORY_GROUPS.map(({ group, categories }) => {
                const selectedCount = categories.filter((category) =>
                  selectedCategoryIdSet.has(category.id)
                ).length;
                const categoryIds = categories.map((category) => category.id);
                const isGroupLocked = selectedCategoryGroupSet.has(group);

                return (
                  <section
                    className={`category-group ${
                      isGroupLocked ? "category-group--locked" : ""
                    }`}
                    key={group}
                  >
                    <label className="category-group__title">
                      <input
                        type="checkbox"
                        checked={isGroupLocked}
                        onChange={() =>
                          handleCategoryGroupToggle(group, categoryIds)
                        }
                      />
                      <span className="category-group__label">
                        <strong>{group}</strong>
                        <span className="category-group__count">
                          {selectedCount}/{categories.length}
                        </span>
                      </span>
                    </label>
                    <div className="category-grid">
                      {categories.map((category) => (
                        <label
                          className={`category-option ${
                            isGroupLocked ? "category-option--locked" : ""
                          }`}
                          key={category.id}
                          title={category.description}
                        >
                          <input
                            type="checkbox"
                            checked={selectedCategoryIdSet.has(category.id)}
                            disabled={isGroupLocked}
                            onChange={() => handleCategoryToggle(category.id)}
                          />
                          <span
                            className="swatch"
                            style={{ backgroundColor: category.color }}
                          />
                          <span className="category-option__label">
                            {category.label}
                            {category.broad && <small>資料量大</small>}
                          </span>
                        </label>
                      ))}
                    </div>
                  </section>
                );
              })}
            </div>
            {!areCategoryOptionsExpanded && (
              <div
                aria-hidden="true"
                className="category-fade-preview fade-preview"
              >
                {CATEGORY_GROUPS.slice(1, 3).map(({ group }) => (
                  <div
                    className="category-group-preview"
                    key={group}
                  >
                    {group}
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        <section className={getMobileTabPanelClass("drawing", "panel solver-panel")}>
          {renderPanelTitle("drawing", "繪圖設定", Star)}
          <div className="range-wrap range-wrap--dual">
            <span>搜尋範圍</span>
            <RadiusRangeControl
              innerRadiusKm={innerRadiusKm}
              outerRadiusKm={outerRadiusKm}
              maxRadiusKm={MAX_RADIUS_KM}
              disabled={isSearchSettingsLocked}
              onInnerChange={handleInnerRadiusChange}
              onOuterChange={handleOuterRadiusChange}
            />
            <strong>{radiusRangeLabel}</strong>
          </div>
          {!isSolverAdvancedExpanded && (
            <div aria-hidden="true" className="fade-preview solver-fade-preview">
              <div className="toggle-row solver-fade-preview__row">
                <span className="solver-fade-preview__checkbox" />
                <span>顯示扇形區塊</span>
              </div>
            </div>
          )}
          <div
            className="solver-advanced"
            hidden={!isSolverAdvancedExpanded}
            id="solver-advanced-controls"
          >
            <label className="toggle-row">
              <input
                type="checkbox"
                checked={showSectors}
                disabled={isSearchSettingsLocked}
                onChange={(event) => setShowSectors(event.target.checked)}
              />
              <span>顯示扇形區塊</span>
            </label>
            <div className="toggle-row-pair">
              <label className="toggle-row">
                <input
                  type="checkbox"
                  checked={searchStrategy === "honeycomb"}
                  disabled={isSearchSettingsLocked}
                  onChange={(event) =>
                    setSearchStrategy(
                      event.target.checked ? "honeycomb" : "angular"
                    )
                  }
                />
                <span>蜂巢搜索（預設）</span>
              </label>
              <label className="toggle-row">
                <input
                  type="checkbox"
                  checked={showHoneycomb}
                  disabled={
                    isSearchSettingsLocked || searchStrategy !== "honeycomb"
                  }
                  onChange={(event) => setShowHoneycomb(event.target.checked)}
                />
                <span>顯示蜂巢區塊</span>
              </label>
            </div>
            <div className="solver-controls">
              <label className="range-wrap">
                <span>角度容許</span>
                <input
                  type="range"
                  disabled={isSearchSettingsLocked}
                  min="6"
                  max={maxAngleToleranceDeg}
                  step="1"
                  value={effectiveAngleToleranceDeg}
                  onChange={(event) =>
                    setAngleToleranceDeg(Number(event.target.value))
                  }
                />
                <strong>±{effectiveAngleToleranceDeg.toFixed(0)}°</strong>
              </label>
              <label className="range-wrap">
                <span>每角候選</span>
                <input
                  type="range"
                  disabled={isSearchSettingsLocked}
                  min="1"
                  max="12"
                  step="1"
                  value={candidatesPerSlot}
                  onChange={(event) =>
                    setCandidatesPerSlot(Number(event.target.value))
                  }
                />
                <strong>{candidatesPerSlot}</strong>
              </label>
              <label className="range-wrap">
                <span>旋轉精度</span>
                <input
                  type="range"
                  disabled={isSearchSettingsLocked}
                  min="1"
                  max="8"
                  step="1"
                  value={rotationStepDeg}
                  onChange={(event) =>
                    setRotationStepDeg(Number(event.target.value))
                  }
                />
                <strong>{rotationStepDeg}°</strong>
              </label>
              {searchStrategy === "honeycomb" && (
                <label className="range-wrap">
                  <span>蜂巢半徑</span>
                  <input
                    type="range"
                    disabled={isSearchSettingsLocked}
                    min="0.3"
                    max="3"
                    step="0.1"
                    value={hexCellRadiusKm}
                    onChange={(event) =>
                      setHexCellRadiusKm(Number(event.target.value))
                    }
                  />
                  <strong>{hexCellRadiusKm.toFixed(1)} km</strong>
                </label>
              )}
            </div>
          </div>
        </section>

        <section className={getMobileTabPanelClass("logs", "panel calculation-log-panel")}>
          {renderPanelTitle("logs", "計算紀錄", Sparkles)}
          <div className="status-box" aria-live="polite">
            {loading ? "處理中..." : status}
          </div>
          {error && <div className="error-box">{error}</div>}
          {calculationRecords.length === 0 ? (
            <p className="muted">
              尚無計算紀錄。執行搜索繪製或自動計算後會保留每一次結果。
            </p>
          ) : (
            <div className="calculation-record-list">
              {calculationRecords.map((record) => (
                <article
                  className={`draw-summary calculation-record calculation-record--${record.status}`}
                  key={record.id}
                >
                  <div className="draw-summary__head">
                    <strong>{record.title}</strong>
                    <span>{formatClockTime(record.finishedAtIso)}</span>
                  </div>
                  <p className="calculation-record__message">
                    {record.message}
                  </p>
                  <div className="calculation-record__meta">
                    <span>開始 {formatClockTime(record.startedAtIso)}</span>
                    <span>結束 {formatClockTime(record.finishedAtIso)}</span>
                    <span>耗時 {formatElapsedMs(record.totalElapsedMs)}</span>
                  </div>
                  {record.summary && (
                    <DrawSummaryDetails summary={record.summary} />
                  )}
                </article>
              ))}
            </div>
          )}
        </section>

        <section className={getMobileTabPanelClass("results", "panel results-panel")}>
          {renderPanelTitle("results", "繪圖結果", Sparkles)}
          {selectedPoi && (
            <SelectedPoiDetail
              poi={selectedPoi}
              isFavorite={isPoiFavorite(selectedPoi)}
              disabled={areFavoritesLocked}
              onAddFavorite={addPoiFavorite}
            />
          )}
          {results.length === 0 ? (
            <p className="muted">尚無結果。搜尋 POI 後會列出最佳組合。</p>
          ) : (
            <>
              {resultAggregateStats && (
                <ResultAggregateSummary stats={resultAggregateStats} />
              )}
              <ResultSortToolbar
                count={sortedResults.length}
                sortKey={starResultSort}
                sortDirection={starResultSortDirection}
                onSortSelect={handleStarResultSortSelect}
              />
              <div className="result-list">
                {sortedResults.map((result, index) => {
                  const isActive = selectedResultIndex === index;
                  const isExpanded = expandedResultId === result.id;
                  const starName = getAutomaticNameForStar(result);
                  const isFavoritedStar = isStarFavorite(result);

                  return (
                    <article
                      className={`result-item ${
                        isActive ? "active" : ""
                      } ${isExpanded ? "expanded" : ""}`}
                      key={result.id}
                    >
                      <div className="result-row">
                        <button
                          aria-label={
                            isFavoritedStar
                              ? `取消收藏星形 ${starName}`
                              : `收藏星形 ${starName}`
                          }
                          className={`result-favorite-button ${
                            isFavoritedStar ? "active" : ""
                          }`}
                          type="button"
                          title={
                            isFavoritedStar ? "取消收藏星形" : "收藏星形"
                          }
                          onClick={() => toggleStarFavorite(result)}
                          disabled={areFavoritesLocked}
                        >
                          <Star
                            aria-hidden="true"
                            fill={isFavoritedStar ? "currentColor" : "none"}
                            size={17}
                          />
                        </button>
                        <button
                          aria-expanded={isExpanded}
                          className="result-row__toggle"
                          type="button"
                          onClick={() => handleResultToggle(result, index)}
                        >
                          <span className="result-row__heading">
                            <strong>{starName}</strong>
                            {isExpanded ? (
                              <ChevronUp aria-hidden="true" size={16} />
                            ) : (
                              <ChevronDown aria-hidden="true" size={16} />
                            )}
                          </span>
                          <span className="result-row__metrics">
                            <span>
                              半徑 {formatDistance(result.radiusMeanMeters)}
                            </span>
                            <span>
                              角度 {formatDegrees(result.rotationDeg)}
                            </span>
                            <span>
                              圓周誤差 {formatDistance(result.radiusStdMeters)}
                            </span>
                            <span>
                              中心誤差{" "}
                              {formatDistance(getStarCenterErrorMeters(result))}
                            </span>
                            <span>分數 {result.score.toFixed(3)}</span>
                          </span>
                        </button>
                      </div>
                      {isExpanded && (
                        <div className="result-expanded">
                          <div className="subsection-title">
                            <Sparkles aria-hidden="true" />
                            <strong>
                              {magicGeometryPattern === "combined"
                                ? "星芒座標"
                                : "目標節點"}
                            </strong>
                          </div>
                          <ol className="point-list">
                            {result.points.map((point, pointIndex) => (
                              <li key={point.id}>
                                <button
                                  type="button"
                                  onClick={() => setSelectedPoi(point)}
                                >
                                  <span className="point-list__index">
                                    {pointIndex + 1}
                                  </span>
                                  <span className="point-list__text">
                                    <strong>{point.name}</strong>
                                    <small>
                                      {formatCoordinate({
                                        lat: point.lat,
                                        lng: point.lng
                                      })}{" "}
                                      · {formatDistance(point.distanceMeters)} /{" "}
                                      {Math.round(point.bearingDeg)}° ·{" "}
                                      {point.categoryLabel}
                                    </small>
                                  </span>
                                </button>
                              </li>
                            ))}
                          </ol>
                          <div className="download-grid">
                            <button
                              type="button"
                              onClick={() => exportStar(result, "gpx")}
                            >
                              <Download size={16} />
                              GPX
                            </button>
                            <button
                              type="button"
                              onClick={() => exportStar(result, "kml")}
                            >
                              <Download size={16} />
                              KML
                            </button>
                          </div>
                        </div>
                      )}
                    </article>
                  );
                })}
              </div>
            </>
          )}
        </section>

        <section className={getMobileTabPanelClass("favorites", "panel favorites-panel")}>
          {renderPanelTitle("favorites", "我的最愛", Star)}
          {areFavoritesLocked && (
            <p className="favorites-lock-note">
              搜索繪製進行中，我的最愛已暫時鎖定。
            </p>
          )}
          {favorites.length === 0 ? (
            <p className="muted">收藏地點或星形後會顯示在這裡。</p>
          ) : (
            <div className="favorite-list">
              {favorites.map((favorite) => {
                const coordinate =
                  favorite.type === "star"
                    ? `中心 ${formatCoordinate(favorite.star.center)}`
                    : formatCoordinate({
                        lat: favorite.poi.lat,
                        lng: favorite.poi.lng
                      });
                const isExpanded = expandedFavoriteId === favorite.id;

                return (
                  <article
                    className={`favorite-item ${
                      isExpanded ? "expanded" : ""
                    }`}
                    key={favorite.id}
                  >
                    <div className="favorite-row">
                      <button
                        aria-expanded={isExpanded}
                        aria-label={`展開收藏 ${favorite.name}`}
                        className="favorite-toggle"
                        type="button"
                        onClick={() => handleFavoriteToggle(favorite)}
                        disabled={areFavoritesLocked}
                      >
                        <span className="favorite-kind">
                          {favorite.type === "poi" ? "地點" : "星形"}
                        </span>
                        <span className="favorite-summary">
                          <strong>{favorite.name}</strong>
                          <small>{coordinate}</small>
                        </span>
                        {isExpanded ? (
                          <ChevronUp aria-hidden="true" size={16} />
                        ) : (
                          <ChevronDown aria-hidden="true" size={16} />
                        )}
                      </button>
                      <button
                        className="icon-button compact"
                        type="button"
                        title="移除收藏"
                        onClick={() => removeFavorite(favorite.id)}
                        disabled={areFavoritesLocked}
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                    {isExpanded && (
                      <div className="favorite-expanded">
                        {favorite.type === "star" ? (
                          <>
                            <div className="subsection-title">
                              <Sparkles aria-hidden="true" />
                              <strong>星芒座標</strong>
                            </div>
                            <ol className="point-list">
                              {favorite.star.points.map((point, pointIndex) => (
                                <li key={point.id}>
                                  <button
                                    type="button"
                                    onClick={() => setSelectedPoi(point)}
                                  >
                                    <span className="point-list__index">
                                      {pointIndex + 1}
                                    </span>
                                    <span className="point-list__text">
                                      <strong>{point.name}</strong>
                                      <small>
                                        {formatCoordinate({
                                          lat: point.lat,
                                          lng: point.lng
                                        })}{" "}
                                        · {formatDistance(point.distanceMeters)} /{" "}
                                        {Math.round(point.bearingDeg)}° ·{" "}
                                        {point.categoryLabel}
                                      </small>
                                    </span>
                                  </button>
                                </li>
                              ))}
                            </ol>
                            <div className="metrics-row">
                              <ResultMetric
                                label="平均半徑"
                                value={formatDistance(
                                  favorite.star.radiusMeanMeters
                                )}
                              />
                              <ResultMetric
                                label="角度"
                                value={formatDegrees(favorite.star.rotationDeg)}
                              />
                              <ResultMetric
                                label="分數"
                                value={favorite.star.score.toFixed(3)}
                              />
                            </div>
                          </>
                        ) : (
                          <div className="poi-detail favorite-poi-detail">
                            <div className="subsection-title">
                              <MapPin aria-hidden="true" />
                              <strong>收藏地點</strong>
                            </div>
                            <strong>{favorite.poi.name}</strong>
                            <span>{favorite.poi.categoryLabel}</span>
                            <span>
                              {formatCoordinate({
                                lat: favorite.poi.lat,
                                lng: favorite.poi.lng
                              })}
                            </span>
                          </div>
                        )}
                        <div className="action-row">
                          <button
                            className="secondary-button"
                            type="button"
                            onClick={() => restoreFavorite(favorite)}
                            disabled={areFavoritesLocked}
                          >
                            <MapPin size={17} />
                            恢復收藏
                          </button>
                        </div>
                        {favorite.type === "star" && (
                          <div className="download-grid">
                            <button
                              type="button"
                              onClick={() => exportStar(favorite.star, "gpx")}
                              disabled={areFavoritesLocked}
                            >
                              <Download size={16} />
                              GPX
                            </button>
                            <button
                              type="button"
                              onClick={() => exportStar(favorite.star, "kml")}
                              disabled={areFavoritesLocked}
                            >
                              <Download size={16} />
                              KML
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          )}
          <div className="download-grid">
            <button
              type="button"
              onClick={() => exportFavorites("gpx")}
              disabled={areFavoritesLocked}
            >
              <Download size={16} />
              收藏 GPX
            </button>
            <button
              type="button"
              onClick={() => exportFavorites("kml")}
              disabled={areFavoritesLocked}
            >
              <Download size={16} />
              收藏 KML
            </button>
          </div>
        </section>

        <section className="panel about-panel mobile-about-panel">
          <div className="panel-title">
            <UserRound aria-hidden="true" />
            <h2>About Me</h2>
          </div>
          <div className="about-copy">
            <strong>Chang Wei Lin</strong>
            <p>我愛星空至深，無懼黑夜。</p>
            <blockquote>
              <p>We have loved the stars too fondly to fear the dark.</p>
              <cite>— &lt;The Old Astronomer&gt; Sarah Williams</cite>
            </blockquote>
          </div>
          <div className="about-links" aria-label="About Me links">
            {ABOUT_LINKS.map((link) => (
              <a
                href={link.href}
                key={link.href}
                target="_blank"
                rel="noreferrer"
              >
                <img src={link.favicon} alt="" aria-hidden="true" />
                <span>{link.label}</span>
              </a>
            ))}
          </div>
        </section>
      </aside>

      <div
        aria-label="調整地圖與設定比例"
        aria-orientation="horizontal"
        aria-valuemax={100}
        aria-valuemin={0}
        aria-valuenow={Math.round(mobileMapSplitPercent)}
        className="mobile-splitter"
        role="separator"
        tabIndex={0}
        title="拖曳調整地圖與設定比例，雙擊切換最上列與搜索繪圖"
        onDoubleClick={handleMobileSplitterDoubleClick}
        onKeyDown={handleMobileSplitterKeyDown}
        onPointerDown={handleMobileSplitterPointerDown}
        onPointerMove={handleMobileSplitterPointerMove}
        onPointerUp={handleMobileSplitterPointerUp}
        onPointerCancel={handleMobileSplitterPointerUp}
      >
        <span aria-hidden="true" />
      </div>

      <section className="map-column" aria-label="互動地圖">
        <header className="app-header" ref={appHeaderRef}>
          <div className="brand-lockup">
            <img
              aria-hidden="true"
              className="brand-mark"
              src="/logo.png"
              alt=""
            />
            <p className="eyebrow">OpenStreetMap 星形尋點</p>
            <h1>Mapping Star</h1>
          </div>
          <div className="header-actions">
            <button
              aria-label={`切換地圖圖層，目前為${currentMapLayerOption.label}`}
              className="layer-toggle"
              title={`切換地圖圖層，目前為${currentMapLayerOption.label}`}
              type="button"
              onClick={handleMapLayerCycle}
            >
              <CurrentMapLayerIcon size={18} />
            </button>
            <div
              className="map-layer-row map-layer-row--header"
              role="group"
              aria-label="地圖圖層"
            >
              {MAP_LAYER_OPTIONS.map(({ id, label, Icon }) => (
                <button
                  aria-pressed={mapLayer === id}
                  className={mapLayer === id ? "selected" : ""}
                  key={id}
                  type="button"
                  title={`切換到${label}圖層`}
                  onClick={() => setMapLayer(id)}
                >
                  <Icon size={16} />
                  <span>{label}</span>
                </button>
              ))}
            </div>
            <button
              aria-label={
                theme === "dark" ? "Switch to light mode" : "Switch to dark mode"
              }
              className="theme-toggle"
              title={
                theme === "dark" ? "Switch to light mode" : "Switch to dark mode"
              }
              type="button"
              onClick={() =>
                setTheme((current) => (current === "dark" ? "light" : "dark"))
              }
            >
              {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
            </button>
          </div>
        </header>
        <div className="map-wrap">
          <div ref={mapElementRef} className="map" />
          {calculationProgress && (
            <div className="map-progress" aria-live="polite">
              <div className="progress-block">
                <div className="progress-meta">
                  <span>{calculationProgress.label}</span>
                  <strong>{Math.round(calculationProgress.percent)}%</strong>
                </div>
                <div
                  aria-label="搜尋繪製進度"
                  aria-valuemax={100}
                  aria-valuemin={0}
                  aria-valuenow={Math.round(calculationProgress.percent)}
                  className="progress-bar"
                  role="progressbar"
                >
                  <span style={{ width: `${calculationProgress.percent}%` }} />
                </div>
              </div>
            </div>
          )}
          {completionNotice && (
            <div
              className="map-completion-notice"
              key={completionNotice.id}
              role="status"
              aria-live="polite"
            >
              <span className="map-completion-notice__icon" aria-hidden="true">
                <Sparkles size={30} />
              </span>
              <span className="map-completion-notice__text">
                <strong>{completionNotice.title}</strong>
                <span>{completionNotice.message}</span>
              </span>
            </div>
          )}
          <div className="map-action-stack" aria-label="地圖快速操作">
            <button
              type="button"
              title="回到魔法陣"
              aria-label="回到魔法陣"
              onClick={() => selectedResult && fitMapToResult(selectedResult)}
              disabled={!selectedResult}
            >
              <Sparkles size={18} />
            </button>
            <button
              type="button"
              title="回到當前位置"
              aria-label="回到當前位置"
              onClick={handleLocate}
              disabled={loading}
            >
              <LocateFixed size={18} />
            </button>
          </div>
          <div className="map-counter">
            <strong>{visiblePois.length}</strong> POI
            {pois.length !== visiblePois.length && (
              <span>{pois.length} 已下載</span>
            )}
            {visiblePois.length > MAX_RENDERED_POIS && (
              <span>顯示前 {MAX_RENDERED_POIS} 筆</span>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}

export default App;
