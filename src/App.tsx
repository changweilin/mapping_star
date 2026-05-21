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
  Layers,
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
import type { FavoriteItem, LatLng, Poi, StarMode, StarResult } from "./types";

type MagicPlaybackMode = "single" | "continuous" | "loop-all" | "loop-one";

const DEFAULT_CENTER: LatLng = { lat: 25.033964, lng: 121.564468 };
const MAX_RENDERED_POIS = 350;
const MAX_RADIUS_KM = 30;
const MAGIC_POINT_DELAY_MS = 1880;
const MAGIC_POINT_STEP_MS = 90;
const MAGIC_POINT_DURATION_MS = 520;
const MAGIC_TIMELINE_END_PADDING_MS = 140;
const MAGIC_PLAYBACK_MODES = [
  { id: "single", label: "單曲播放" },
  { id: "continuous", label: "連續播放" },
  { id: "loop-all", label: "循環播放" },
  { id: "loop-one", label: "單曲循環播放" }
] satisfies Array<{ id: MagicPlaybackMode; label: string }>;

type RadiusHandle = "inner" | "outer";
type MagicPlayback = "playing" | "paused" | "ended";
type MagicPlaybackDirection = "forward" | "reverse";
type MagicSymbolStroke = Extract<MagicCircleStroke, { kind: "symbol" }>;
type CalculationProgress = {
  label: string;
  percent: number;
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
  onTouchEnd,
  onTouchMove,
  onTouchStart,
  onWheel
}: MarqueeSelectProps) => {
  const viewportRef = useRef<HTMLSpanElement>(null);
  const textRef = useRef<HTMLSpanElement>(null);
  const [isOverflowing, setIsOverflowing] = useState(false);
  const [marqueeShiftPx, setMarqueeShiftPx] = useState(0);

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
  rotationStepDeg
}: {
  mode: StarMode;
  center: LatLng;
  innerRadiusKm: number;
  outerRadiusKm: number;
  angleToleranceDeg: number;
  candidatesPerSlot: number;
  rotationStepDeg: number;
}) =>
  [
    mode,
    center.lat,
    center.lng,
    innerRadiusKm,
    outerRadiusKm,
    angleToleranceDeg,
    candidatesPerSlot,
    rotationStepDeg
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

const RadiusRangeControl = ({
  innerRadiusKm,
  outerRadiusKm,
  onInnerChange,
  onOuterChange
}: {
  innerRadiusKm: number;
  outerRadiusKm: number;
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
      className="dual-range"
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
        tabIndex={0}
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
        tabIndex={0}
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
  const mapElementRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const centerLayerRef = useRef<L.LayerGroup | null>(null);
  const poiLayerRef = useRef<L.LayerGroup | null>(null);
  const starLayerRef = useRef<L.LayerGroup | null>(null);
  const sectorLayerRef = useRef<L.LayerGroup | null>(null);
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
  const [showSectors, setShowSectors] = useState(
    initialSettings.showSectors
  );
  const [theme, setTheme] = useState(initialSettings.theme);
  const [mapLayer, setMapLayer] = useState<MapLayerId>(
    initialSettings.mapLayer
  );
  const [selectedCategoryIds, setSelectedCategoryIds] =
    useState<string[]>(initialSettings.selectedCategoryIds);
  const [isCategoryPanelExpanded, setIsCategoryPanelExpanded] =
    useState(false);
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
  const magicPlaybackModeTouchYRef = useRef<number | null>(null);
  const magicAnimationTouchYRef = useRef<number | null>(null);
  const magicSpeedTouchYRef = useRef<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [calculationProgress, setCalculationProgress] =
    useState<CalculationProgress | null>(null);
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
  const categoryToggleLabel = isCategoryPanelExpanded
    ? "收合目標類別"
    : "展開目標類別";

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
      angleToleranceDeg: effectiveAngleToleranceDeg,
      candidatesPerSlot,
      rotationStepDeg
    }),
    [
      candidatesPerSlot,
      center,
      effectiveAngleToleranceDeg,
      innerRadiusMeters,
      outerRadiusMeters,
      rotationStepDeg,
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
        rotationStepDeg
      }),
    [
      candidatesPerSlot,
      center,
      effectiveAngleToleranceDeg,
      innerRadiusKm,
      outerRadiusKm,
      rotationStepDeg,
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
  const countPoisInCurrentRange = (items: Poi[]) =>
    items.filter(
      (poi) =>
        poi.distanceMeters >= innerRadiusMeters &&
        poi.distanceMeters <= outerRadiusMeters
    ).length;
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
  const stopMagicSelectTouch = (event: TouchEvent<HTMLElement>) => {
    event.stopPropagation();
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
    stopMagicSelectTouch(event);
    magicPlaybackModeTouchYRef.current = event.touches[0]?.clientY ?? null;
  };
  const handleMagicAnimationTouchStart = (event: TouchEvent<HTMLElement>) => {
    stopMagicSelectTouch(event);
    magicAnimationTouchYRef.current = event.touches[0]?.clientY ?? null;
  };
  const handleMagicSpeedTouchStart = (event: TouchEvent<HTMLElement>) => {
    stopMagicSelectTouch(event);
    magicSpeedTouchYRef.current = event.touches[0]?.clientY ?? null;
  };
  const handleMagicSelectTouchMove = (event: TouchEvent<HTMLElement>) => {
    preventMagicSelectScroll(event);
  };
  const handleMagicPlaybackModeTouchEnd = (event: TouchEvent<HTMLElement>) => {
    stopMagicSelectTouch(event);
    const startY = magicPlaybackModeTouchYRef.current;
    magicPlaybackModeTouchYRef.current = null;
    if (startY === null) return;

    const deltaY = (event.changedTouches[0]?.clientY ?? startY) - startY;
    if (Math.abs(deltaY) < 18) return;
    preventMagicSelectScroll(event);
    stepMagicPlaybackMode(deltaY < 0 ? 1 : -1);
  };
  const handleMagicAnimationTouchEnd = (event: TouchEvent<HTMLElement>) => {
    stopMagicSelectTouch(event);
    const startY = magicAnimationTouchYRef.current;
    magicAnimationTouchYRef.current = null;
    if (startY === null) return;

    const deltaY = (event.changedTouches[0]?.clientY ?? startY) - startY;
    if (Math.abs(deltaY) < 18) return;
    preventMagicSelectScroll(event);
    stepMagicAnimation(deltaY < 0 ? 1 : -1);
  };
  const handleMagicSpeedTouchEnd = (event: TouchEvent<HTMLElement>) => {
    stopMagicSelectTouch(event);
    const startY = magicSpeedTouchYRef.current;
    magicSpeedTouchYRef.current = null;
    if (startY === null) return;

    const deltaY = (event.changedTouches[0]?.clientY ?? startY) - startY;
    if (Math.abs(deltaY) < 18) return;
    preventMagicSelectScroll(event);
    stepMagicSpeed(deltaY < 0 ? 1 : -1);
  };
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
    sectorLayerRef.current = L.layerGroup().addTo(map);
    poiLayerRef.current = L.layerGroup().addTo(map);
    starLayerRef.current = L.layerGroup().addTo(map);
    map.on("click", (event: L.LeafletMouseEvent) => {
      const nextCenter = {
        lat: event.latlng.lat,
        lng: event.latlng.lng
      };
      setCenter(nextCenter);
      setStatus("中心游標已移動，重新搜尋即可用新的圓心計算。");
      setError("");
    });

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
      tileLayerRef.current = null;
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
      showSectors,
      selectedCategoryIds,
      theme,
      mapLayer
    });
  }, [
    candidatesPerSlot,
    effectiveAngleToleranceDeg,
    innerRadiusKm,
    outerRadiusKm,
    rotationStepDeg,
    selectedCategoryIds,
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
    if (skipNextAutoSolveRef.current) {
      const shouldSkip = skipNextAutoSolveRef.current === autoSolveKey;
      skipNextAutoSolveRef.current = null;
      if (shouldSkip) return;
    }

    if (pois.length === 0) return;

    const nextResults = solveStarFromPois(pois, solverParams);
    setResults(nextResults);
    setSelectedResultIndex(0);
    if (nextResults.length === 0) {
      setStatus(
        `目前 ${countPoisInCurrentRange(pois)} 個範圍內候選點不足以形成穩定的星形。`
      );
    }
  }, [autoSolveKey, solverParams]);

  const runSolver = (nextPois = pois) => {
    const nextResults = solveStarFromPois(nextPois, solverParams);
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
      )}°，每角 ${candidatesPerSlot} 點，搜尋範圍 ${radiusRangeLabel}。`
    );

    return nextResults;
  };

  const handleRecalculate = async () => {
    setLoading(true);
    setError("");
    setSelectedPoi(null);
    try {
      setProgressStep(12, "整理目前候選點");
      await waitForPaint();
      setProgressStep(64, "計算魔法陣組合");
      await waitForPaint();
      const nextResults = runSolver();
      setProgressStep(
        nextResults.length > 0 ? 92 : 88,
        nextResults.length > 0 ? "繪製魔法陣" : "整理計算結果"
      );
      await waitForPaint();
      completeProgress(
        nextResults.length > 0 ? "魔法陣完成" : "計算完成，尚無可用星形"
      );
    } catch (solveError) {
      resetProgress();
      setError(solveError instanceof Error ? solveError.message : "計算失敗。");
    } finally {
      setLoading(false);
    }
  };

  const handleSearchPlace = async () => {
    setLoading(true);
    setError("");
    try {
      const result = await searchPlace(searchText);
      setCenter(result.center);
      mapRef.current?.setView([result.center.lat, result.center.lng], 12);
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
    setLoading(true);
    setError("");
    setSelectedPoi(null);
    try {
      setProgressStep(8, "準備搜尋範圍");
      await waitForPaint();
      setProgressStep(34, "下載地點資料");
      const { pois: nextPois, warnings } = await fetchPoisDetailed(
        center,
        outerRadiusMeters,
        selectedCategories,
        innerRadiusMeters
      );
      const mergedPois = mergePois(pois, nextPois);
      const addedPoiCount = mergedPois.length - pois.length;
      setPois(mergedPois);
      setProgressStep(68, `分析 ${mergedPois.length} 個候選點`);
      await waitForPaint();
      const nextResults = runSolver(mergedPois);
      setProgressStep(
        nextResults.length > 0 ? 92 : 88,
        nextResults.length > 0 ? "繪製魔法陣" : "整理計算結果"
      );
      await waitForPaint();
      const notes = [...warnings];

      if (nextPois.length >= overpassResultLimit) {
        notes.push(
          `已讀取前 ${overpassResultLimit} 筆資料；若想更精準，請縮小外徑、提高內徑或減少類別。`
        );
      }

      if (notes.length > 0) {
        setStatus(
          `${notes.join(" ")} 本次取得 ${nextPois.length} 筆資料，新增 ${addedPoiCount} 筆，累計 ${mergedPois.length} 筆${
            nextResults.length > 0
              ? `，仍找到 ${nextResults.length} 組${
                  starMode === 5 ? "五芒星" : "六芒星"
                }候選。`
              : "，但尚未找到符合條件的星形。"
          }`
        );
      }
      completeProgress(
        nextResults.length > 0 ? "魔法陣完成" : "計算完成，尚無可用星形"
      );
    } catch (fetchError) {
      resetProgress();
      setError(fetchError instanceof Error ? fetchError.message : "查詢失敗。");
    } finally {
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
      rotationStepDeg
    });
    setCenter(restoredStar.center);
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

  const exportSelected = (format: "gpx" | "kml") => {
    if (!selectedResult) {
      setError("目前沒有可匯出的星形結果。");
      return;
    }

    const content =
      format === "gpx"
        ? exportGpx("Mapping Star Result", selectedResult.points, [
            selectedResult
          ])
        : exportKml("Mapping Star Result", selectedResult.points, [
            selectedResult
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
    <main className="app-shell">
      <aside className="sidebar" aria-label="地圖控制">
        <header className="app-header">
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

        <section className="magic-player" aria-label="魔法陣播放器">
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
              onTouchEnd={handleMagicPlaybackModeTouchEnd}
              onTouchMove={handleMagicSelectTouchMove}
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
              onTouchEnd={handleMagicSpeedTouchEnd}
              onTouchMove={handleMagicSelectTouchMove}
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
              label="動畫"
              value={magicAnimationIndex}
              valueLabel={magicAnimationLabel}
              onChange={(value) => handleMagicAnimationChange(Number(value))}
              onTouchEnd={handleMagicAnimationTouchEnd}
              onTouchMove={handleMagicSelectTouchMove}
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

        <section className="panel map-layer-panel">
          <div className="panel-title">
            <Layers aria-hidden="true" />
            <h2>地圖圖層</h2>
          </div>
          <div className="map-layer-row" role="group" aria-label="地圖圖層">
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
        </section>

        <section className="panel">
          <div className="panel-title">
            <Crosshair aria-hidden="true" />
            <h2>中心與範圍</h2>
          </div>
          <div className="search-row">
            <label className="input-wrap">
              <span>地標 / 地址 / 座標</span>
              <input
                value={searchText}
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
              disabled={loading}
            >
              <Search size={18} />
            </button>
            <button
              className="icon-button"
              type="button"
              title="使用目前位置"
              onClick={handleLocate}
              disabled={loading}
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

        <section className="panel">
          <div className="panel-title panel-title--with-action">
            <div className="panel-title-main">
              <MapPin aria-hidden="true" />
              <h2>目標類別</h2>
            </div>
            <button
              className="category-collapse-button"
              type="button"
              aria-controls="target-category-grid"
              aria-expanded={isCategoryPanelExpanded}
              aria-label={categoryToggleLabel}
              title={categoryToggleLabel}
              onClick={() =>
                setIsCategoryPanelExpanded((expanded) => !expanded)
              }
            >
              {isCategoryPanelExpanded ? (
                <ChevronUp size={18} />
              ) : (
                <ChevronDown size={18} />
              )}
            </button>
          </div>
          <div
            className={`category-grid ${
              isCategoryPanelExpanded ? "category-grid--expanded" : ""
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
        </section>

        <section className="panel">
          <div className="panel-title">
            <Star aria-hidden="true" />
            <h2>星形計算</h2>
          </div>
          <div className="mode-row" role="group" aria-label="星形模式">
            <button
              className={starMode === 5 ? "selected" : ""}
              type="button"
              onClick={() => setStarMode(5)}
            >
              五芒星
            </button>
            <button
              className={starMode === 6 ? "selected" : ""}
              type="button"
              onClick={() => setStarMode(6)}
            >
              六芒星
            </button>
          </div>
          <label className="toggle-row">
            <input
              type="checkbox"
              checked={showSectors}
              onChange={(event) => setShowSectors(event.target.checked)}
            />
            <span>顯示扇形區塊</span>
          </label>
          <div className="solver-controls">
            <label className="range-wrap">
              <span>角度容許</span>
              <input
                type="range"
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
          </div>
          <div className="action-row">
            <button
              className="primary-button"
              type="button"
              onClick={() => void handleFetchAndSolve()}
              disabled={loading}
            >
              <Play size={17} />
              搜尋並繪製
            </button>
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
          <div className="status-box" aria-live="polite">
            {calculationProgress ? (
              <div className="progress-block">
                <div className="progress-meta">
                  <span>{calculationProgress.label}</span>
                  <strong>{Math.round(calculationProgress.percent)}%</strong>
                </div>
                <div
                  aria-label="計算進度"
                  aria-valuemax={100}
                  aria-valuemin={0}
                  aria-valuenow={Math.round(calculationProgress.percent)}
                  className="progress-bar"
                  role="progressbar"
                >
                  <span
                    style={{ width: `${calculationProgress.percent}%` }}
                  />
                </div>
              </div>
            ) : loading ? (
              "處理中..."
            ) : (
              status
            )}
          </div>
          {error && <div className="error-box">{error}</div>}
        </section>

        {selectedPoi && (
          <section className="panel">
            <div className="panel-title">
              <MapPin aria-hidden="true" />
              <h2>選取地點</h2>
            </div>
            <div className="poi-detail">
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
          </section>
        )}

        <section className="panel results-panel">
          <div className="panel-title">
            <Sparkles aria-hidden="true" />
            <h2>星形結果</h2>
          </div>
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
                    {result.mode === 5 ? "五芒星" : "六芒星"} #{index + 1}
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
                  onClick={() => addFavorite(makeStarFavorite(selectedResult))}
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

        <section className="panel favorites-panel">
          <div className="panel-title">
            <Star aria-hidden="true" />
            <h2>我的最愛</h2>
          </div>
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

        <section className="panel about-panel">
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

      <section className="map-wrap" aria-label="互動地圖">
        <div ref={mapElementRef} className="map" />
        <div className="map-counter">
          <strong>{visiblePois.length}</strong> POI
          {pois.length !== visiblePois.length && (
            <span>{pois.length} 已下載</span>
          )}
          {visiblePois.length > MAX_RENDERED_POIS && (
            <span>顯示前 {MAX_RENDERED_POIS} 筆</span>
          )}
        </div>
      </section>
    </main>
  );
}

export default App;
