import {
  type ChangeEvent,
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
  type TouchEvent,
  type WheelEvent,
  useEffect,
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
import { loadLastStar, saveLastStar } from "./lib/lastStar";
import {
  getMagicElement,
  getMagicAnimationOptions,
  MAGIC_SPEED_OPTIONS,
  makeMagicCircleStrokes,
  type MagicCircleStroke,
  type MagicSpeed
} from "./lib/magicCircle";
import { fetchPoisDetailed, overpassResultLimit } from "./lib/overpass";
import { searchPlace } from "./lib/placeSearch";
import {
  DEFAULT_APP_SETTINGS,
  loadSettings,
  saveSettings,
  type MapLayerId
} from "./lib/settings";
import { solveStarFromPois } from "./lib/solver";
import { makeAutomaticStarName } from "./lib/starNaming";
import type {
  FavoriteItem,
  LatLng,
  Poi,
  SearchStrategy,
  StarMode,
  StarResult
} from "./types";

type MagicPlaybackMode = "single" | "continuous" | "loop-all" | "loop-one";
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
const MAX_STAR_RESULTS = 5;
const HONEYCOMB_PREVIEW_PRIORITY_RINGS = 2;
const MAX_HONEYCOMB_PREVIEW_CELLS = 240;
const SQRT_3 = Math.sqrt(3);
const MAGIC_POINT_DELAY_MS = 1880;
const MAGIC_POINT_STEP_MS = 90;
const MAGIC_POINT_DURATION_MS = 520;
const MAGIC_TIMELINE_END_PADDING_MS = 140;
const MAGIC_SELECT_LONG_PRESS_MS = 360;
const MAGIC_SELECT_SCROLL_CANCEL_PX = 10;
const MAGIC_SELECT_TOUCH_STEP_PX = 26;
const MAGIC_PLAYBACK_MODES = [
  { id: "single", label: "單曲播放" },
  { id: "continuous", label: "連續播放" },
  { id: "loop-all", label: "循環播放" },
  { id: "loop-one", label: "單曲循環播放" }
] satisfies Array<{ id: MagicPlaybackMode; label: string }>;

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

type RadiusHandle = "inner" | "outer";
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
type CalculationProgress = {
  label: string;
  percent: number;
};
type DrawSummary = {
  id: string;
  sourceLabel: string;
  startedAtIso: string;
  finishedAtIso: string;
  firstResultAtIso: string | null;
  firstResultElapsedMs: number | null;
  firstResultSourceLabel: string | null;
  totalElapsedMs: number;
  searchElapsedMs: number | null;
  solveElapsedMs: number;
  previewSolveCount: number;
  previewSolveElapsedMs: number;
  renderElapsedMs: number;
  estimatedAnimationMs: number | null;
  resultCount: number;
  resultLimit: number;
  eligiblePoiCount: number;
  totalPoiCount: number;
  fetchedPoiCount: number | null;
  addedPoiCount: number | null;
  warningCount: number;
  categoryCount: number | null;
  mode: StarMode;
  centerLabel: string;
  centerCoordinate: string;
  radiusRangeLabel: string;
  searchStrategy: SearchStrategy;
  angleToleranceDeg: number;
  candidatesPerSlot: number;
  rotationStepDeg: number;
  hexCellRadiusKm: number;
  animationLabel: string;
  magicSpeed: MagicSpeed;
  notes: string[];
};
type ProgressStep = {
  percent: number;
  label: string;
};
type HexCell = {
  q: number;
  r: number;
};
type HoneycombPreviewCell = {
  key: string;
  order: number;
  ring: number;
  center: LatLng;
  polygon: LatLng[];
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

type MarqueeSelectProps = {
  label: string;
  value: string | number;
  valueLabel: string;
  children: ReactNode;
  onChange: (value: string) => void;
  onTouchCancel?: (event: TouchEvent<HTMLElement>) => void;
  onTouchEnd?: (event: TouchEvent<HTMLElement>) => void;
  onTouchMove?: (event: TouchEvent<HTMLElement>) => void;
  onTouchStart?: (event: TouchEvent<HTMLElement>) => void;
  onWheel?: (event: WheelEvent<HTMLElement>) => void;
};

const MarqueeSelect = ({
  label,
  value,
  valueLabel,
  children,
  onChange,
  onTouchCancel,
  onTouchEnd,
  onTouchMove,
  onTouchStart,
  onWheel
}: MarqueeSelectProps) => {
  const rootRef = useRef<HTMLLabelElement>(null);
  const viewportRef = useRef<HTMLSpanElement>(null);
  const textRef = useRef<HTMLSpanElement>(null);
  const [isOverflowing, setIsOverflowing] = useState(false);
  const [marqueeShiftPx, setMarqueeShiftPx] = useState(0);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return undefined;

    const preventNativeScroll = (event: Event) => {
      event.preventDefault();
    };

    root.addEventListener("wheel", preventNativeScroll, { passive: false });

    return () => {
      root.removeEventListener("wheel", preventNativeScroll);
    };
  }, []);

  useEffect(() => {
    const measure = () => {
      const viewport = viewportRef.current;
      const text = textRef.current;
      if (!viewport || !text) return;

      const overflowPx = Math.max(0, text.scrollWidth - viewport.clientWidth);
      setIsOverflowing(overflowPx > 1);
      setMarqueeShiftPx(Math.ceil(overflowPx));
    };

    measure();

    if (typeof window === "undefined") return undefined;

    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", measure);
      return () => window.removeEventListener("resize", measure);
    }

    const observer = new ResizeObserver(measure);
    if (viewportRef.current) observer.observe(viewportRef.current);
    if (textRef.current) observer.observe(textRef.current);

    return () => observer.disconnect();
  }, [valueLabel]);

  const className = isOverflowing
    ? "select-wrap select-wrap--compact select-wrap--marquee"
    : "select-wrap select-wrap--compact";
  const marqueeStyle = {
    "--select-marquee-shift": `-${marqueeShiftPx}px`
  } as CSSProperties;

  return (
    <label
      className={className}
      ref={rootRef}
      onTouchCancel={onTouchCancel}
      onTouchEnd={onTouchEnd}
      onTouchMove={onTouchMove}
      onTouchStart={onTouchStart}
      onWheel={onWheel}
    >
      <span className="select-wrap__label">{label}</span>
      <span className="select-shell" title={valueLabel}>
        <select
          value={value}
          onChange={(event: ChangeEvent<HTMLSelectElement>) =>
            onChange(event.target.value)
          }
        >
          {children}
        </select>
        <span
          aria-hidden="true"
          className="select-marquee"
          ref={viewportRef}
        >
          <span className="select-marquee__track" style={marqueeStyle}>
            <span ref={textRef}>{valueLabel}</span>
          </span>
        </span>
      </span>
    </label>
  );
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

const getNowMs = () =>
  typeof performance === "undefined" ? Date.now() : performance.now();

const formatElapsedMs = (valueMs: number | null | undefined) => {
  if (valueMs === null || valueMs === undefined) return "尚未產生";

  const safeValueMs = Math.max(0, valueMs);
  if (safeValueMs < 1000) return `${Math.round(safeValueMs)} ms`;
  if (safeValueMs < 10000) return `${(safeValueMs / 1000).toFixed(2)} 秒`;
  if (safeValueMs < 60000) return `${(safeValueMs / 1000).toFixed(1)} 秒`;

  const minutes = Math.floor(safeValueMs / 60000);
  const seconds = ((safeValueMs % 60000) / 1000).toFixed(1);
  return `${minutes} 分 ${seconds} 秒`;
};

const formatClockTime = (isoValue: string | null | undefined) => {
  if (!isoValue) return "尚未產生";

  return new Intl.DateTimeFormat("zh-TW", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  }).format(new Date(isoValue));
};

const getStarModeLabel = (mode: StarMode) =>
  mode === 5 ? "五芒星" : "六芒星";

const getSearchStrategyLabel = ({
  searchStrategy,
  hexCellRadiusKm
}: {
  searchStrategy: SearchStrategy;
  hexCellRadiusKm: number;
}) => (searchStrategy === "honeycomb" ? `蜂巢 ${hexCellRadiusKm} km` : "角度");

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

const getRecalculateProgressSteps = (
  searchStrategy: SearchStrategy
): ProgressStep[] =>
  searchStrategy === "honeycomb"
    ? [
        { percent: 12, label: "整理目前候選點" },
        { percent: 42, label: "建立蜂巢索引" },
        { percent: 76, label: "掃描蜂巢環帶與候選組合" }
      ]
    : [
        { percent: 12, label: "整理目前候選點" },
        { percent: 64, label: "計算魔法陣組合" }
      ];

const getHoneycombSolveProgressSteps = (): ProgressStep[] => [
  { percent: 70, label: "建立蜂巢索引與旋轉優先序" },
  { percent: 82, label: "掃描蜂巢環帶與候選組合" }
];

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
  hexCellRadiusKm
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
    hexCellRadiusKm
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

const makeHoneycombOrderIcon = (order: number) =>
  L.divIcon({
    className: "honeycomb-order-marker",
    html: `<span>${order}</span>`,
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

const getHoneycombTargetRadiusMeters = (
  outerRadiusMeters: number,
  innerRadiusMeters: number
) => {
  const radiusRangeMeters = Math.max(1, outerRadiusMeters - innerRadiusMeters);
  return innerRadiusMeters > 0
    ? innerRadiusMeters + radiusRangeMeters / 2
    : outerRadiusMeters;
};

const normalizeHoneycombCellRadius = (
  outerRadiusMeters: number,
  hexCellRadiusMeters: number
) =>
  Math.max(
    250,
    Math.min(Math.max(250, outerRadiusMeters), hexCellRadiusMeters)
  );

const makeHoneycombPlanarPoint = (
  distanceMeters: number,
  bearingDeg: number
) => {
  const bearing = (bearingDeg * Math.PI) / 180;
  return {
    x: distanceMeters * Math.sin(bearing),
    y: distanceMeters * Math.cos(bearing)
  };
};

const makeHoneycombLatLng = (center: LatLng, x: number, y: number) => {
  const distanceMeters = Math.hypot(x, y);
  const bearingDeg = normalizeDegrees((Math.atan2(x, y) * 180) / Math.PI);
  return destinationPoint(center, distanceMeters, bearingDeg);
};

const getHoneycombCellKey = ({ q, r }: HexCell) => `${q},${r}`;

const roundHoneycombCell = (q: number, r: number): HexCell => {
  const s = -q - r;
  let roundedQ = Math.round(q);
  let roundedR = Math.round(r);
  let roundedS = Math.round(s);

  const qDiff = Math.abs(roundedQ - q);
  const rDiff = Math.abs(roundedR - r);
  const sDiff = Math.abs(roundedS - s);

  if (qDiff > rDiff && qDiff > sDiff) {
    roundedQ = -roundedR - roundedS;
  } else if (rDiff > sDiff) {
    roundedR = -roundedQ - roundedS;
  } else {
    roundedS = -roundedQ - roundedR;
  }

  return { q: roundedQ, r: roundedR };
};

const honeycombPointToCell = (
  { x, y }: { x: number; y: number },
  cellRadiusMeters: number
) =>
  roundHoneycombCell(
    ((SQRT_3 / 3) * x - y / 3) / cellRadiusMeters,
    ((2 / 3) * y) / cellRadiusMeters
  );

const addHoneycombCell = (a: HexCell, b: HexCell, scale = 1): HexCell => ({
  q: a.q + b.q * scale,
  r: a.r + b.r * scale
});

const HONEYCOMB_DIRECTIONS: HexCell[] = [
  { q: 1, r: 0 },
  { q: 1, r: -1 },
  { q: 0, r: -1 },
  { q: -1, r: 0 },
  { q: -1, r: 1 },
  { q: 0, r: 1 }
];

const getHoneycombRing = (center: HexCell, ring: number) => {
  if (ring === 0) return [center];

  const cells: HexCell[] = [];
  let current = addHoneycombCell(center, HONEYCOMB_DIRECTIONS[4], ring);

  for (const direction of HONEYCOMB_DIRECTIONS) {
    for (let step = 0; step < ring; step += 1) {
      cells.push(current);
      current = addHoneycombCell(current, direction);
    }
  }

  return cells;
};

const getHoneycombCellCenterPlanar = (
  cell: HexCell,
  cellRadiusMeters: number
) => ({
  x: cellRadiusMeters * SQRT_3 * (cell.q + cell.r / 2),
  y: cellRadiusMeters * 1.5 * cell.r
});

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
  hexCellRadiusMeters
}: {
  mode: StarMode;
  center: LatLng;
  innerRadiusMeters: number;
  outerRadiusMeters: number;
  rotationStepDeg: number;
  hexCellRadiusMeters: number;
}): HoneycombPreviewCell[] => {
  const slotWidth = 360 / mode;
  const step = Math.max(1, Math.min(slotWidth, rotationStepDeg));
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

  for (let rotationDeg = 0; rotationDeg < slotWidth; rotationDeg += step) {
    rotations.push(rotationDeg);
  }

  for (const rotationDeg of rotations) {
    for (let slotIndex = 0; slotIndex < mode; slotIndex += 1) {
      const targetBearing = normalizeDegrees(
        rotationDeg + slotWidth * slotIndex
      );
      const targetCell = honeycombPointToCell(
        makeHoneycombPlanarPoint(targetRadiusMeters, targetBearing),
        cellRadiusMeters
      );

      for (let ring = 0; ring <= HONEYCOMB_PREVIEW_PRIORITY_RINGS; ring += 1) {
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
            polygon: makeHoneycombPolygon(cellCenter, cellRadiusMeters)
          });

          if (cells.length >= MAX_HONEYCOMB_PREVIEW_CELLS) return cells;
        }
      }
    }
  }

  return cells;
};

const ResultMetric = ({
  label,
  value
}: {
  label: string;
  value: string;
}) => (
  <span className="metric">
    <span>{label}</span>
    <strong>{value}</strong>
  </span>
);

const DrawSummaryDetails = ({ summary }: { summary: DrawSummary }) => (
  <>
    <div className="draw-summary__metrics">
      <ResultMetric
        label="首個魔法陣"
        value={formatElapsedMs(summary.firstResultElapsedMs)}
      />
      <ResultMetric
        label="總耗時"
        value={formatElapsedMs(summary.totalElapsedMs)}
      />
      <ResultMetric
        label="找到數量"
        value={`${summary.resultCount} 組 / 上限 ${summary.resultLimit}`}
      />
      <ResultMetric
        label="候選點"
        value={`${summary.eligiblePoiCount} / ${summary.totalPoiCount}`}
      />
      <ResultMetric
        label="搜尋下載"
        value={
          summary.searchElapsedMs === null
            ? "不適用"
            : formatElapsedMs(summary.searchElapsedMs)
        }
      />
      <ResultMetric
        label="最終計算"
        value={formatElapsedMs(summary.solveElapsedMs)}
      />
      <ResultMetric
        label="預覽計算"
        value={
          summary.previewSolveCount > 0
            ? `${summary.previewSolveCount} 次 / ${formatElapsedMs(
                summary.previewSolveElapsedMs
              )}`
            : "0 次"
        }
      />
      <ResultMetric
        label="地圖渲染"
        value={formatElapsedMs(summary.renderElapsedMs)}
      />
      <ResultMetric
        label="動畫估計"
        value={formatElapsedMs(summary.estimatedAnimationMs)}
      />
    </div>
    <dl className="draw-summary__details">
      <div>
        <dt>首個完成時間</dt>
        <dd>
          {formatClockTime(summary.firstResultAtIso)}
          {summary.firstResultSourceLabel
            ? ` · ${summary.firstResultSourceLabel}`
            : ""}
        </dd>
      </div>
      <div>
        <dt>中心</dt>
        <dd>
          {summary.centerLabel} · {summary.centerCoordinate}
        </dd>
      </div>
      <div>
        <dt>範圍與模式</dt>
        <dd>
          {summary.radiusRangeLabel} · {getStarModeLabel(summary.mode)} ·{" "}
          {getSearchStrategyLabel(summary)}
        </dd>
      </div>
      <div>
        <dt>搜尋參數</dt>
        <dd>
          角度 ±{summary.angleToleranceDeg.toFixed(0)}° · 每角{" "}
          {summary.candidatesPerSlot} 點 · 旋轉步距 {summary.rotationStepDeg}°
        </dd>
      </div>
      <div>
        <dt>資料統計</dt>
        <dd>
          {summary.fetchedPoiCount === null
            ? "使用目前點位"
            : `本次取得 ${summary.fetchedPoiCount} 筆，新增 ${summary.addedPoiCount} 筆`}
          {summary.categoryCount === null
            ? ""
            : ` · 類別 ${summary.categoryCount} 個`}
          {summary.warningCount > 0 ? ` · 提醒 ${summary.warningCount} 則` : ""}
        </dd>
      </div>
      <div>
        <dt>動畫設定</dt>
        <dd>
          {summary.animationLabel} · {summary.magicSpeed}x
        </dd>
      </div>
    </dl>
    {summary.notes.length > 0 && (
      <p className="draw-summary__notes">{summary.notes.join(" ")}</p>
    )}
  </>
);

const RadiusRangeControl = ({
  innerRadiusKm,
  outerRadiusKm,
  disabled = false,
  onInnerChange,
  onOuterChange
}: {
  innerRadiusKm: number;
  outerRadiusKm: number;
  disabled?: boolean;
  onInnerChange: (value: number) => void;
  onOuterChange: (value: number) => void;
}) => {
  const trackRef = useRef<HTMLDivElement | null>(null);
  const [dragging, setDragging] = useState<RadiusHandle | null>(null);
  const innerPercent = (innerRadiusKm / MAX_RADIUS_KM) * 100;
  const outerPercent = (outerRadiusKm / MAX_RADIUS_KM) * 100;

  const clampRadius = (handle: RadiusHandle, value: number) =>
    handle === "inner"
      ? Math.max(0, Math.min(value, outerRadiusKm - 1))
      : Math.min(MAX_RADIUS_KM, Math.max(value, innerRadiusKm + 1));

  const updateRadius = (handle: RadiusHandle, value: number) => {
    const nextValue = clampRadius(handle, value);
    if (handle === "inner") {
      onInnerChange(nextValue);
    } else {
      onOuterChange(nextValue);
    }
  };

  const valueFromPointer = (clientX: number) => {
    const track = trackRef.current;
    if (!track) return 0;
    const rect = track.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    return Math.round(ratio * MAX_RADIUS_KM);
  };

  const updateFromPointer = (
    handle: RadiusHandle,
    event: PointerEvent<HTMLElement>
  ) => {
    updateRadius(handle, valueFromPointer(event.clientX));
  };

  const handleTrackPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (disabled) return;
    const value = valueFromPointer(event.clientX);
    const handle =
      Math.abs(value - innerRadiusKm) <= Math.abs(value - outerRadiusKm)
        ? "inner"
        : "outer";
    updateRadius(handle, value);
  };

  const handlePointerDown = (
    handle: RadiusHandle,
    event: PointerEvent<HTMLSpanElement>
  ) => {
    if (disabled) return;
    event.preventDefault();
    event.stopPropagation();
    setDragging(handle);
    event.currentTarget.setPointerCapture(event.pointerId);
    updateFromPointer(handle, event);
  };

  const handlePointerMove = (
    handle: RadiusHandle,
    event: PointerEvent<HTMLSpanElement>
  ) => {
    if (disabled) return;
    if (dragging === handle) updateFromPointer(handle, event);
  };

  const handlePointerUp = (event: PointerEvent<HTMLSpanElement>) => {
    event.currentTarget.releasePointerCapture(event.pointerId);
    setDragging(null);
  };

  const handleKeyDown = (
    handle: RadiusHandle,
    event: KeyboardEvent<HTMLSpanElement>
  ) => {
    if (disabled) return;
    const currentValue = handle === "inner" ? innerRadiusKm : outerRadiusKm;
    const step = event.shiftKey ? 5 : 1;
    const keyActions: Record<string, number> = {
      ArrowLeft: currentValue - step,
      ArrowDown: currentValue - step,
      ArrowRight: currentValue + step,
      ArrowUp: currentValue + step,
      Home: handle === "inner" ? 0 : innerRadiusKm + 1,
      End: handle === "inner" ? outerRadiusKm - 1 : MAX_RADIUS_KM
    };

    if (!(event.key in keyActions)) return;
    event.preventDefault();
    updateRadius(handle, keyActions[event.key]);
  };

  return (
    <div
      className={disabled ? "dual-range dual-range--disabled" : "dual-range"}
      ref={trackRef}
      onPointerDown={handleTrackPointerDown}
    >
      <div className="dual-range__track" aria-hidden="true">
        <span
          style={{
            left: `${innerPercent}%`,
            right: `${100 - outerPercent}%`
          }}
        />
      </div>
      <span
        aria-label="內徑"
        aria-valuemax={outerRadiusKm - 1}
        aria-valuemin={0}
        aria-valuenow={innerRadiusKm}
        className="dual-range__handle"
        role="slider"
        tabIndex={disabled ? -1 : 0}
        style={{ left: `${innerPercent}%` }}
        onKeyDown={(event) => handleKeyDown("inner", event)}
        onPointerDown={(event) => handlePointerDown("inner", event)}
        onPointerMove={(event) => handlePointerMove("inner", event)}
        onPointerUp={handlePointerUp}
      />
      <span
        aria-label="外徑"
        aria-valuemax={MAX_RADIUS_KM}
        aria-valuemin={innerRadiusKm + 1}
        aria-valuenow={outerRadiusKm}
        className="dual-range__handle"
        role="slider"
        tabIndex={disabled ? -1 : 0}
        style={{ left: `${outerPercent}%` }}
        onKeyDown={(event) => handleKeyDown("outer", event)}
        onPointerDown={(event) => handlePointerDown("outer", event)}
        onPointerMove={(event) => handlePointerMove("outer", event)}
        onPointerUp={handlePointerUp}
      />
    </div>
  );
};

function App() {
  const appShellRef = useRef<HTMLElement | null>(null);
  const appHeaderRef = useRef<HTMLElement | null>(null);
  const sidebarRef = useRef<HTMLElement | null>(null);
  const magicPlayerRef = useRef<HTMLElement | null>(null);
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
  const [expandedDesktopSections, setExpandedDesktopSections] = useState<
    Record<MobileSettingsTab, boolean>
  >(DEFAULT_DESKTOP_SECTION_EXPANSION);
  const [pois, setPois] = useState<Poi[]>([]);
  const [results, setResults] = useState<StarResult[]>(
    initialLastStar ? [initialLastStar] : []
  );
  const [selectedResultIndex, setSelectedResultIndex] = useState(0);
  const [selectedPoi, setSelectedPoi] = useState<Poi | null>(null);
  const [magicAnimationIndex, setMagicAnimationIndex] = useState(0);
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
  const mobileSettingsSwipeRef = useRef<MobileSettingsSwipeState | null>(null);
  const searchAbortControllerRef = useRef<AbortController | null>(null);
  const [loading, setLoading] = useState(false);
  const [isSearchDrawing, setIsSearchDrawing] = useState(false);
  const [calculationProgress, setCalculationProgress] =
    useState<CalculationProgress | null>(null);
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
      ? `已載入上次暫存的${initialLastStar.mode === 5 ? "五芒星" : "六芒星"}魔法陣。`
      : "點擊地圖、搜尋地標或輸入座標來放置中心。"
  );
  const [error, setError] = useState("");

  const selectedCategories = useMemo(
    () =>
      POI_CATEGORIES.filter((category) =>
        selectedCategoryIds.includes(category.id)
      ),
    [selectedCategoryIds]
  );
  const selectedResult = results[selectedResultIndex] ?? null;
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
  const currentMapLayerOption =
    MAP_LAYER_OPTIONS.find((option) => option.id === mapLayer) ??
    MAP_LAYER_OPTIONS[0];
  const CurrentMapLayerIcon = currentMapLayerOption.Icon;
  const searchDrawButtonLabel = isSearchDrawing ? "取消搜索" : "搜索繪製";
  const isSearchSettingsLocked = isSearchDrawing;
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
  const visiblePois = useMemo(
    () =>
      pois.filter(
        (poi) =>
          poi.distanceMeters >= innerRadiusMeters &&
          poi.distanceMeters <= outerRadiusMeters
      ),
    [innerRadiusMeters, outerRadiusMeters, pois]
  );
  const maxAngleToleranceDeg = starMode === 5 ? 36 : 30;
  const effectiveAngleToleranceDeg = Math.min(
    angleToleranceDeg,
    maxAngleToleranceDeg
  );
  const solverParams = useMemo(
    () => ({
      mode: starMode,
      center,
      radiusMeters: outerRadiusMeters,
      innerRadiusMeters,
      maxResults: MAX_STAR_RESULTS,
      angleToleranceDeg: effectiveAngleToleranceDeg,
      candidatesPerSlot,
      rotationStepDeg,
      searchStrategy,
      hexCellRadiusMeters: hexCellRadiusKm * 1000
    }),
    [
      candidatesPerSlot,
      center,
      effectiveAngleToleranceDeg,
      hexCellRadiusKm,
      innerRadiusMeters,
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
        hexCellRadiusKm
      }),
    [
      candidatesPerSlot,
      center,
      effectiveAngleToleranceDeg,
      hexCellRadiusKm,
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
  const handleMapLayerCycle = () => {
    const currentIndex = Math.max(
      0,
      MAP_LAYER_OPTIONS.findIndex((option) => option.id === mapLayer)
    );
    setMapLayer(
      MAP_LAYER_OPTIONS[(currentIndex + 1) % MAP_LAYER_OPTIONS.length].id
    );
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

    return {
      min: Math.max(8, Math.min(90, min)),
      max: Math.max(min, Math.min(96, max))
    };
  };
  const clampMobileSplitPercent = (value: number) => {
    const bounds = getMobileSplitBounds();
    return Math.min(bounds.max, Math.max(bounds.min, value));
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
    mobileSplitDraggingRef.current = true;
    event.currentTarget.setPointerCapture(event.pointerId);
    updateMobileSplitFromPointer(event.clientY);
  };
  const handleMobileSplitterPointerMove = (
    event: PointerEvent<HTMLDivElement>
  ) => {
    if (!mobileSplitDraggingRef.current) return;
    event.preventDefault();
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
    const keyActions: Record<string, number> = {
      ArrowUp: mobileMapSplitPercent - 5,
      ArrowLeft: mobileMapSplitPercent - 5,
      ArrowDown: mobileMapSplitPercent + 5,
      ArrowRight: mobileMapSplitPercent + 5,
      Home: bounds.min,
      End: bounds.max,
      Enter: 50,
      " ": 50
    };

    if (!(event.key in keyActions)) return;
    event.preventDefault();
    setMobileMapSplitPercent(clampMobileSplitPercent(keyActions[event.key]));
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
        poi.distanceMeters >= innerRadiusMeters &&
        poi.distanceMeters <= outerRadiusMeters
    ).length;
  const getEstimatedMagicAnimationMs = (result: StarResult | null) => {
    if (!result) return null;

    const strokes = makeMagicCircleStrokes(result, magicAnimationIndex);
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
    const strokes = makeMagicCircleStrokes(result, animationIndex);
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
    mapRef.current?.fitBounds(makeStarBounds(result).pad(0.08), {
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
      clearMagicPlaybackTimer();
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
      theme,
      mapLayer
    });
  }, [
    candidatesPerSlot,
    effectiveAngleToleranceDeg,
    hexCellRadiusKm,
    innerRadiusKm,
    outerRadiusKm,
    rotationStepDeg,
    searchStrategy,
    selectedCategoryIds,
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

    const cells = makeHoneycombPreviewCells({
      mode: starMode,
      center,
      innerRadiusMeters,
      outerRadiusMeters,
      rotationStepDeg,
      hexCellRadiusMeters: hexCellRadiusKm * 1000
    });

    cells.forEach((cell) => {
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
      L.marker([cell.center.lat, cell.center.lng], {
        icon: makeHoneycombOrderIcon(cell.order),
        interactive: false,
        keyboard: false,
        zIndexOffset: -900
      }).addTo(group);
    });
  }, [
    center,
    hexCellRadiusKm,
    innerRadiusMeters,
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
    if (!showSectors || !selectedResult) return;

    const slotWidth = 360 / selectedResult.mode;
    const sectorHalfWidth = Math.min(slotWidth / 2, effectiveAngleToleranceDeg);
    for (let index = 0; index < selectedResult.mode; index += 1) {
      const target = selectedResult.rotationDeg + slotWidth * index;
      L.polygon(
        makeSectorPolygon(
          selectedResult.center,
          innerRadiusMeters,
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
    innerRadiusMeters,
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
      magicAnimationIndex
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
        radius: 14,
        color: magicElement.accent,
        weight: 1,
        opacity: 0.38,
        fillColor: magicElement.pale,
        fillOpacity: 0.2,
        className: `star-point star-point--appear magic-element--${magicElement.id}`
      })
        .bindTooltip(`${index + 1}. ${poi.name}`, {
          direction: "bottom",
          offset: [0, 22],
          permanent: true,
          className: "star-label star-label--below"
        })
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
    magicReplayKey,
    magicSpeed,
    selectedResult
  ]);

  useEffect(() => {
    if (!selectedResult) return;
    fitMapToResult(selectedResult);
  }, [selectedResult?.id]);

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
        `目前 ${countPoisInCurrentRange(pois)} 個範圍內候選點不足以形成穩定的星形。`
      );
      return;
    }
    setStatus(formatDrawSummaryStatus(summary));
  }, [autoSolveKey, solverParams]);

  const runSolver = (nextPois = pois, nextCenter = center) => {
    const nextResults = solveStarFromPois(nextPois, {
      ...solverParams,
      center: nextCenter
    });
    const eligiblePoiCount = countPoisInCurrentRange(nextPois);
    setResults(nextResults);
    setSelectedResultIndex(0);

    if (nextResults.length === 0) {
      setStatus(`找到 ${eligiblePoiCount} 個範圍內候選點，但沒有可用的星形組合。`);
      return nextResults;
    }

    setStatus(
      `找到 ${eligiblePoiCount} 個範圍內候選點，已產生 ${nextResults.length} 組${
        starMode === 5 ? "五芒星" : "六芒星"
      }候選。角度容許 ±${effectiveAngleToleranceDeg.toFixed(
        0
      )}°，每角 ${candidatesPerSlot} 點，搜尋範圍 ${radiusRangeLabel}，策略 ${
        searchStrategy === "honeycomb" ? `蜂巢 ${hexCellRadiusKm} km` : "角度"
      }。`
    );

    return nextResults;
  };

  const handleRecalculate = async () => {
    const startedAtMs = getNowMs();
    const startedAtIso = new Date().toISOString();
    let solveElapsedMs = 0;
    setLoading(true);
    setError("");
    setSelectedPoi(null);
    try {
      for (const progressStep of getRecalculateProgressSteps(searchStrategy)) {
        setProgressStep(progressStep.percent, progressStep.label);
        await waitForPaint();
      }
      const solveStartedAtMs = getNowMs();
      const nextResults = runSolver();
      solveElapsedMs = getNowMs() - solveStartedAtMs;
      setProgressStep(
        nextResults.length > 0 ? 92 : 88,
        nextResults.length > 0 ? "繪製魔法陣" : "整理計算結果"
      );
      const renderStartedAtMs = getNowMs();
      await waitForPaint();
      const finishedAtMs = getNowMs();
      const firstResultElapsedMs =
        nextResults.length > 0 ? finishedAtMs - startedAtMs : null;
      const firstResultAtIso =
        nextResults.length > 0 ? new Date().toISOString() : null;
      const summary = makeDrawSummary({
        sourceLabel: "重新計算",
        startedAtMs,
        startedAtIso,
        finishedAtMs,
        firstResultElapsedMs,
        firstResultAtIso,
        firstResultSourceLabel: nextResults.length > 0 ? "最終計算" : null,
        solveElapsedMs,
        renderElapsedMs: finishedAtMs - renderStartedAtMs,
        nextResults,
        nextPois: pois,
        nextCenter: center,
        nextCenterLabel: centerName
      });
      addCalculationRecord(makeCalculationRecordFromSummary(summary));
      setStatus(formatDrawSummaryStatus(summary));
      completeProgress(formatDrawSummaryProgressLabel(summary));
    } catch (solveError) {
      const finishedAtMs = getNowMs();
      const message =
        solveError instanceof Error ? solveError.message : "計算失敗。";
      addCalculationRecord(
        makeCalculationMessageRecord({
          status: "failed",
          sourceLabel: "重新計算",
          title: "重新計算失敗",
          message,
          startedAtIso,
          startedAtMs,
          finishedAtMs
        })
      );
      resetProgress();
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const resolveSearchCenter = async (requireInput: boolean) => {
    const trimmedSearchText = searchText.trim();
    if (!trimmedSearchText) {
      if (requireInput) throw new Error("請輸入地標、地址或座標。");
      return { center, label: centerName, searched: false };
    }

    const result = await searchPlace(trimmedSearchText);
    setCenter(result.center);
    setCenterName(result.label);
    mapRef.current?.setView([result.center.lat, result.center.lng], 12);
    return { ...result, searched: true };
  };

  const handleSearchPlace = async () => {
    setLoading(true);
    setError("");
    try {
      const result = await resolveSearchCenter(true);
      setStatus(`中心已移至 ${result.label}。`);
    } catch (searchError) {
      setError(searchError instanceof Error ? searchError.message : "搜尋失敗。");
    } finally {
      setLoading(false);
    }
  };

  const handleLocate = () => {
    if (!navigator.geolocation) {
      setError("這個瀏覽器不支援目前位置功能。");
      return;
    }

    setLoading(true);
    setError("");
    navigator.geolocation.getCurrentPosition(
      (position) => {
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
    setIsSearchDrawing(true);
    setLoading(true);
    setError("");
    setSelectedPoi(null);
    let latestMergedPois = pois;
    let hasDrawnFirstSearchResult = false;
    try {
      setProgressStep(8, "解析中心地點");
      const searchCenter = await resolveSearchCenter(false);
      await waitForPaint();
      setProgressStep(18, "準備搜尋範圍");
      await waitForPaint();
      setProgressStep(34, "下載地點資料");
      const { pois: nextPois, warnings } = await fetchPoisDetailed(
        searchCenter.center,
        outerRadiusMeters,
        selectedCategories,
        innerRadiusMeters,
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
            let progressLabel = `${progress.category.label} 已搜索 ${progress.pois.length} 筆`;
            if (searchStrategy === "honeycomb" && !hasDrawnFirstSearchResult) {
              const previewSolveStartedAtMs = getNowMs();
              const previewResults = solveStarFromPois(latestMergedPois, {
                ...solverParams,
                center: searchCenter.center,
                maxResults: 1
              });
              previewSolveCount += 1;
              previewSolveElapsedMs += getNowMs() - previewSolveStartedAtMs;
              if (previewResults.length > 0) {
                hasDrawnFirstSearchResult = true;
                markFirstResult("蜂巢預覽");
                setResults(previewResults);
                setSelectedResultIndex(0);
                progressLabel = `${progressLabel}，已先畫出第一個魔法陣，繼續搜索其他蜂巢`;
              }
            }
            setProgressStep(progressPercent, progressLabel);
          }
        }
      );
      const mergedPois = mergePois(latestMergedPois, nextPois);
      const addedPoiCount = mergedPois.length - pois.length;
      setPois(mergedPois);
      setProgressStep(
        getAnalyzeProgressPercent(searchStrategy),
        searchStrategy === "honeycomb"
          ? `整理 ${mergedPois.length} 個蜂巢候選點`
          : `分析 ${mergedPois.length} 個候選點`
      );
      await waitForPaint();
      if (searchStrategy === "honeycomb") {
        for (const progressStep of getHoneycombSolveProgressSteps()) {
          setProgressStep(progressStep.percent, progressStep.label);
          await waitForPaint();
        }
      }
      const solveStartedAtMs = getNowMs();
      searchElapsedMs = solveStartedAtMs - startedAtMs;
      const nextResults = runSolver(mergedPois, searchCenter.center);
      solveElapsedMs = getNowMs() - solveStartedAtMs;
      setProgressStep(
        nextResults.length > 0 ? 92 : 88,
        nextResults.length > 0 ? "繪製魔法陣" : "整理計算結果"
      );
      const renderStartedAtMs = getNowMs();
      await waitForPaint();
      if (nextResults.length > 0) markFirstResult("最終計算");
      const finishedAtMs = getNowMs();
      const notes = [...warnings];

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
      setIsSearchDrawing(false);
      setLoading(false);
    }
  };

  const handleCategoryToggle = (categoryId: string) => {
    setSelectedCategoryIds((current) =>
      current.includes(categoryId)
        ? current.filter((id) => id !== categoryId)
        : [...current, categoryId]
    );
  };

  const addFavorite = (favorite: FavoriteItem) => {
    setFavorites((current) => {
      if (current.some((item) => item.id === favorite.id)) return current;
      return [favorite, ...current];
    });
    setStatus(`已加入我的最愛：${favorite.name}`);
  };

  const removeFavorite = (favoriteId: string) => {
    setFavorites((current) => current.filter((item) => item.id !== favoriteId));
  };

  const restoreFavorite = (favorite: FavoriteItem) => {
    setError("");

    if (favorite.type === "poi") {
      const nextCenter = {
        lat: favorite.poi.lat,
        lng: favorite.poi.lng
      };
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
      restoredStar.mode === 5 ? 36 : 30
    );

    skipNextAutoSolveRef.current = makeAutoSolveKey({
      mode: restoredStar.mode,
      center: restoredStar.center,
      innerRadiusKm: nextInnerRadiusKm,
      outerRadiusKm: nextOuterRadiusKm,
      angleToleranceDeg: nextAngleToleranceDeg,
      candidatesPerSlot,
      rotationStepDeg,
      searchStrategy,
      hexCellRadiusKm
    });
    setCenter(restoredStar.center);
    setCenterName(restoredStar.name ?? favorite.name);
    setStarMode(restoredStar.mode);
    setInnerRadiusKm(nextInnerRadiusKm);
    setOuterRadiusKm(nextOuterRadiusKm);
    setResults([restoredStar]);
    setSelectedResultIndex(0);
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

  const addSelectedStarFavorite = () => {
    if (!selectedResult) return;
    addFavorite(
      makeStarFavorite(selectedResult, getAutomaticNameForStar(selectedResult))
    );
  };

  const exportSelected = (format: "gpx" | "kml") => {
    if (!selectedResult) {
      setError("目前沒有可匯出的星形結果。");
      return;
    }

    const namedResult = {
      ...selectedResult,
      name: getAutomaticNameForStar(selectedResult)
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

        <section className="magic-draw-actions" aria-label="搜索繪製與星形模式">
          <button
            className="primary-button search-draw-button"
            type="button"
            onClick={() => void handleFetchAndSolve()}
            disabled={loading && !isSearchDrawing}
          >
            <Play size={17} />
            <span>{searchDrawButtonLabel}</span>
          </button>
          <div className="mode-row" role="group" aria-label="星形模式">
            <button
              className={starMode === 5 ? "selected" : ""}
              type="button"
              onClick={() => setStarMode(5)}
              disabled={isSearchSettingsLocked}
            >
              五芒星
            </button>
            <button
              className={starMode === 6 ? "selected" : ""}
              type="button"
              onClick={() => setStarMode(6)}
              disabled={isSearchSettingsLocked}
            >
              六芒星
            </button>
          </div>
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
            <label className="input-wrap">
              <span>地標 / 地址 / 座標</span>
              <input
                value={searchText}
                disabled={isSearchSettingsLocked}
                onChange={(event) => setSearchText(event.target.value)}
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
            <button
              className="icon-button search-locate-button"
              type="button"
              title="使用目前位置"
              onClick={handleLocate}
              disabled={loading || isSearchSettingsLocked}
            >
              <LocateFixed size={18} />
            </button>
          </div>
          <div className="range-field">
            <div className="range-label">
              <span>搜尋範圍</span>
              <strong>{radiusRangeLabel}</strong>
            </div>
            <RadiusRangeControl
              innerRadiusKm={innerRadiusKm}
              outerRadiusKm={outerRadiusKm}
              disabled={isSearchSettingsLocked}
              onInnerChange={handleInnerRadiusChange}
              onOuterChange={handleOuterRadiusChange}
            />
            <div className="range-hints">
              <span>內徑 {innerRadiusKm} km</span>
              <span>外徑 {outerRadiusKm} km</span>
            </div>
          </div>
          <p className="coordinate">
            {formatCoordinate(center)}
          </p>
        </section>

        <section className={getMobileTabPanelClass("categories")}>
          {renderPanelTitle("categories", "目標類別", MapPin)}
          <div className="category-stack">
            <div
              className={`category-grid ${
                areCategoryOptionsExpanded ? "category-grid--expanded" : ""
              }`}
              id="target-category-grid"
            >
              {POI_CATEGORIES.map((category) => (
                <label className="category-option" key={category.id}>
                  <input
                    type="checkbox"
                    checked={selectedCategoryIds.includes(category.id)}
                    onChange={() => handleCategoryToggle(category.id)}
                  />
                  <span
                    className="swatch"
                    style={{ backgroundColor: category.color }}
                  />
                  <span>
                    {category.label}
                    {category.broad && <small>資料量大</small>}
                  </span>
                </label>
              ))}
            </div>
            {!areCategoryOptionsExpanded && (
              <div
                aria-hidden="true"
                className="category-fade-preview fade-preview"
              >
                {POI_CATEGORIES.slice(4, 6).map((category) => (
                  <div
                    className="category-option category-option--preview"
                    key={category.id}
                  >
                    <span className="category-option__input-ghost" />
                    <span
                      className="swatch"
                      style={{ backgroundColor: category.color }}
                    />
                    <span>
                      {category.label}
                      {category.broad && <small>資料量大</small>}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        <section className={getMobileTabPanelClass("drawing", "panel solver-panel")}>
          {renderPanelTitle("drawing", "繪圖設定", Star)}
          <div className="action-row action-row--single">
            <button
              className="secondary-button"
              type="button"
              onClick={() => void handleRecalculate()}
              disabled={loading || pois.length === 0}
            >
              <Sparkles size={17} />
              重新計算
            </button>
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
                    min="0.1"
                    max="10"
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
              尚無計算紀錄。執行搜索繪製、重新計算或自動計算後會保留每一次結果。
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
            <div className="poi-detail selected-poi-detail">
              <div className="subsection-title">
                <MapPin aria-hidden="true" />
                <strong>選取地點</strong>
              </div>
              <strong>{selectedPoi.name}</strong>
              <span>{selectedPoi.categoryLabel}</span>
              <span>
                {formatDistance(selectedPoi.distanceMeters)} /{" "}
                {Math.round(selectedPoi.bearingDeg)}°
              </span>
              <a
                href={`https://www.openstreetmap.org/${selectedPoi.osmType}/${selectedPoi.osmId}`}
                target="_blank"
                rel="noreferrer"
              >
                OpenStreetMap
              </a>
              <button
                className="secondary-button"
                type="button"
                onClick={() => addFavorite(makePoiFavorite(selectedPoi))}
                disabled={isPoiFavorite(selectedPoi)}
              >
                <Star size={17} />
                {isPoiFavorite(selectedPoi) ? "已收藏" : "加入我的最愛"}
              </button>
            </div>
          )}
          {results.length === 0 ? (
            <p className="muted">尚無結果。搜尋 POI 後會列出最佳組合。</p>
          ) : (
            <div className="result-list">
              {results.map((result, index) => (
                <button
                  className={`result-row ${
                    selectedResultIndex === index ? "active" : ""
                  }`}
                  type="button"
                  key={result.id}
                  onClick={() => setSelectedResultIndex(index)}
                >
                  <strong>
                    {getAutomaticNameForStar(result)}
                  </strong>
                  <span>分數 {result.score.toFixed(3)}</span>
                  <span>{formatDistance(result.radiusMeanMeters)}</span>
                </button>
              ))}
            </div>
          )}

          {selectedResult && (
            <div className="selected-result">
              <div className="metrics-row">
                <ResultMetric
                  label="平均半徑"
                  value={formatDistance(selectedResult.radiusMeanMeters)}
                />
                <ResultMetric
                  label="半徑差"
                  value={formatDistance(selectedResult.radiusStdMeters)}
                />
                <ResultMetric
                  label="角度誤差"
                  value={`${selectedResult.angleErrorDeg.toFixed(1)}°`}
                />
              </div>
              <ol className="point-list">
                {selectedResult.points.map((point, index) => (
                  <li key={point.id}>
                    <button type="button" onClick={() => setSelectedPoi(point)}>
                      <span>{index + 1}</span>
                      <strong>{point.name}</strong>
                      <small>{point.categoryLabel}</small>
                    </button>
                  </li>
                ))}
              </ol>
              <div className="action-row">
                <button
                  className="secondary-button"
                  type="button"
                  onClick={addSelectedStarFavorite}
                  disabled={isStarFavorite(selectedResult)}
                >
                  <Star size={17} />
                  {isStarFavorite(selectedResult) ? "已收藏星形" : "收藏星形"}
                </button>
              </div>
              <div className="download-grid">
                <button type="button" onClick={() => exportSelected("gpx")}>
                  <Download size={16} />
                  GPX
                </button>
                <button type="button" onClick={() => exportSelected("kml")}>
                  <Download size={16} />
                  KML
                </button>
              </div>
            </div>
          )}
        </section>

        <section className={getMobileTabPanelClass("favorites", "panel favorites-panel")}>
          {renderPanelTitle("favorites", "我的最愛", Star)}
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

                return (
                  <div className="favorite-row" key={favorite.id}>
                    <button
                      aria-label={`恢復收藏 ${favorite.name}`}
                      className="favorite-restore"
                      type="button"
                      onClick={() => restoreFavorite(favorite)}
                    >
                      <span className="favorite-kind">
                        {favorite.type === "poi" ? "地點" : "星形"}
                      </span>
                      <span className="favorite-summary">
                        <strong>{favorite.name}</strong>
                        <small>{coordinate}</small>
                      </span>
                    </button>
                    <button
                      className="icon-button compact"
                      type="button"
                      title="移除收藏"
                      onClick={() => removeFavorite(favorite.id)}
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
          <div className="download-grid">
            <button type="button" onClick={() => exportFavorites("gpx")}>
              <Download size={16} />
              收藏 GPX
            </button>
            <button type="button" onClick={() => exportFavorites("kml")}>
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
        title="拖曳調整地圖與設定比例，雙擊回到 50:50"
        onDoubleClick={() => setMobileMapSplitPercent(50)}
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
