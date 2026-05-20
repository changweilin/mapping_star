import { useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";
import {
  Crosshair,
  Download,
  LocateFixed,
  MapPin,
  Play,
  Search,
  Sparkles,
  Star,
  Trash2
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
import { fetchPoisDetailed, overpassResultLimit } from "./lib/overpass";
import { searchPlace } from "./lib/placeSearch";
import {
  DEFAULT_APP_SETTINGS,
  loadSettings,
  saveSettings
} from "./lib/settings";
import { solveStarFromPois, starLineSequences } from "./lib/solver";
import type { FavoriteItem, LatLng, Poi, StarMode, StarResult } from "./types";

const DEFAULT_CENTER: LatLng = { lat: 25.033964, lng: 121.564468 };
const MAX_RENDERED_POIS = 350;

const makeCenterIcon = () =>
  L.divIcon({
    className: "center-pin",
    html: '<span class="center-pin__ring"></span><span class="center-pin__dot"></span>',
    iconSize: [30, 30],
    iconAnchor: [15, 15]
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

const makeSectorPolygon = (
  center: LatLng,
  radiusMeters: number,
  startDeg: number,
  endDeg: number
) => {
  const points: L.LatLngExpression[] = [[center.lat, center.lng]];
  const span = normalizeDegrees(endDeg - startDeg) || 360;
  const steps = Math.max(8, Math.ceil(span / 6));

  for (let index = 0; index <= steps; index += 1) {
    const bearing = startDeg + (span * index) / steps;
    const point = destinationPoint(center, radiusMeters, bearing);
    points.push([point.lat, point.lng]);
  }

  points.push([center.lat, center.lng]);
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

function App() {
  const mapElementRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const centerLayerRef = useRef<L.LayerGroup | null>(null);
  const poiLayerRef = useRef<L.LayerGroup | null>(null);
  const starLayerRef = useRef<L.LayerGroup | null>(null);
  const sectorLayerRef = useRef<L.LayerGroup | null>(null);
  const [initialSettings] = useState(() =>
    typeof window === "undefined" ? DEFAULT_APP_SETTINGS : loadSettings()
  );

  const [center, setCenter] = useState<LatLng>(DEFAULT_CENTER);
  const [searchText, setSearchText] = useState("");
  const [radiusKm, setRadiusKm] = useState(initialSettings.radiusKm);
  const [starMode, setStarMode] = useState<StarMode>(
    initialSettings.starMode
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
  const [selectedCategoryIds, setSelectedCategoryIds] =
    useState<string[]>(initialSettings.selectedCategoryIds);
  const [pois, setPois] = useState<Poi[]>([]);
  const [results, setResults] = useState<StarResult[]>([]);
  const [selectedResultIndex, setSelectedResultIndex] = useState(0);
  const [selectedPoi, setSelectedPoi] = useState<Poi | null>(null);
  const [favorites, setFavorites] = useState<FavoriteItem[]>(() =>
    typeof window === "undefined" ? [] : loadFavorites()
  );
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("點擊地圖、搜尋地標或輸入座標來放置中心。");
  const [error, setError] = useState("");

  const selectedCategories = useMemo(
    () =>
      POI_CATEGORIES.filter((category) =>
        selectedCategoryIds.includes(category.id)
      ),
    [selectedCategoryIds]
  );

  const selectedResult = results[selectedResultIndex] ?? null;
  const radiusMeters = radiusKm * 1000;
  const maxAngleToleranceDeg = starMode === 5 ? 36 : 30;
  const effectiveAngleToleranceDeg = Math.min(
    angleToleranceDeg,
    maxAngleToleranceDeg
  );
  const solverParams = useMemo(
    () => ({
      mode: starMode,
      center,
      radiusMeters,
      angleToleranceDeg: effectiveAngleToleranceDeg,
      candidatesPerSlot,
      rotationStepDeg
    }),
    [
      candidatesPerSlot,
      center,
      effectiveAngleToleranceDeg,
      radiusMeters,
      rotationStepDeg,
      starMode
    ]
  );

  useEffect(() => {
    if (!mapElementRef.current || mapRef.current) return;

    const map = L.map(mapElementRef.current, {
      zoomControl: false
    }).setView([DEFAULT_CENTER.lat, DEFAULT_CENTER.lng], 8);

    L.control.zoom({ position: "bottomright" }).addTo(map);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
    }).addTo(map);

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
    };
  }, []);

  useEffect(() => {
    saveFavorites(favorites);
  }, [favorites]);

  useEffect(() => {
    saveSettings({
      radiusKm,
      starMode,
      angleToleranceDeg: effectiveAngleToleranceDeg,
      candidatesPerSlot,
      rotationStepDeg,
      showSectors,
      selectedCategoryIds
    });
  }, [
    candidatesPerSlot,
    effectiveAngleToleranceDeg,
    radiusKm,
    rotationStepDeg,
    selectedCategoryIds,
    showSectors,
    starMode
  ]);

  useEffect(() => {
    const group = centerLayerRef.current;
    if (!group) return;
    group.clearLayers();

    L.circle([center.lat, center.lng], {
      radius: radiusMeters,
      color: "#44546a",
      weight: 1,
      opacity: 0.65,
      fillColor: "#f2a12b",
      fillOpacity: 0.05
    }).addTo(group);

    L.marker([center.lat, center.lng], { icon: makeCenterIcon() })
      .bindTooltip("中心點", { direction: "top" })
      .addTo(group);
  }, [center, radiusMeters]);

  useEffect(() => {
    const group = poiLayerRef.current;
    if (!group) return;
    group.clearLayers();

    pois.slice(0, MAX_RENDERED_POIS).forEach((poi) => {
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
  }, [pois]);

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
          radiusMeters,
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
  }, [effectiveAngleToleranceDeg, radiusMeters, selectedResult, showSectors]);

  useEffect(() => {
    const group = starLayerRef.current;
    if (!group) return;
    group.clearLayers();
    if (!selectedResult) return;

    starLineSequences(selectedResult.mode).forEach((sequence) => {
      L.polyline(
        sequence.map((pointIndex) => {
          const point = selectedResult.points[pointIndex];
          return [point.lat, point.lng] as L.LatLngExpression;
        }),
        {
          color: "#263fd1",
          weight: 3,
          opacity: 0.9
        }
      ).addTo(group);
    });

    selectedResult.points.forEach((poi, index) => {
      L.circleMarker([poi.lat, poi.lng], {
        radius: 8,
        color: "#263fd1",
        weight: 2,
        fillColor: "#ffffff",
        fillOpacity: 1
      })
        .bindTooltip(`${index + 1}. ${poi.name}`, {
          direction: "top",
          permanent: true,
          className: "star-label"
        })
        .on("click", () => setSelectedPoi(poi))
        .addTo(group);
    });
  }, [selectedResult]);

  useEffect(() => {
    if (!selectedResult || !mapRef.current) return;
    const bounds = L.latLngBounds(
      selectedResult.points.map((point) => [point.lat, point.lng])
    );
    mapRef.current.fitBounds(bounds.pad(0.2), { maxZoom: 12 });
  }, [selectedResult?.id]);

  useEffect(() => {
    if (pois.length === 0) return;
    const nextResults = solveStarFromPois(pois, solverParams);
    setResults(nextResults);
    setSelectedResultIndex(0);
    if (nextResults.length === 0) {
      setStatus(`目前 ${pois.length} 個候選點不足以形成穩定的星形。`);
    }
  }, [solverParams]);

  const runSolver = (nextPois = pois) => {
    const nextResults = solveStarFromPois(nextPois, solverParams);
    setResults(nextResults);
    setSelectedResultIndex(0);

    if (nextResults.length === 0) {
      setStatus(`找到 ${nextPois.length} 個候選點，但沒有可用的星形組合。`);
      return nextResults;
    }

    setStatus(
      `找到 ${nextPois.length} 個候選點，已產生 ${nextResults.length} 組${
        starMode === 5 ? "五芒星" : "六芒星"
      }候選。角度容許 ±${effectiveAngleToleranceDeg.toFixed(
        0
      )}°，每角 ${candidatesPerSlot} 點。`
    );

    return nextResults;
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
      const { pois: nextPois, warnings } = await fetchPoisDetailed(
        center,
        radiusMeters,
        selectedCategories
      );
      setPois(nextPois);
      const nextResults = runSolver(nextPois);
      const notes = [...warnings];

      if (nextPois.length >= overpassResultLimit) {
        notes.push(
          `已讀取前 ${overpassResultLimit} 筆資料；若想更精準，請縮小半徑或減少類別。`
        );
      }

      if (notes.length > 0) {
        setStatus(
          `${notes.join(" ")} 已取得 ${nextPois.length} 筆資料${
            nextResults.length > 0
              ? `，仍找到 ${nextResults.length} 組${
                  starMode === 5 ? "五芒星" : "六芒星"
                }候選。`
              : "，但尚未找到符合條件的星形。"
          }`
        );
      }
    } catch (fetchError) {
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

  return (
    <main className="app-shell">
      <aside className="sidebar" aria-label="地圖控制">
        <header className="app-header">
          <div>
            <p className="eyebrow">OpenStreetMap 星形尋點</p>
            <h1>Mapping Star</h1>
          </div>
          <Sparkles aria-hidden="true" />
        </header>

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
          <label className="range-wrap">
            <span>搜尋半徑</span>
            <input
              type="range"
              min="1"
              max="30"
              step="1"
              value={radiusKm}
              onChange={(event) => setRadiusKm(Number(event.target.value))}
            />
            <strong>{radiusKm} km</strong>
          </label>
          <p className="coordinate">
            {center.lat.toFixed(6)}, {center.lng.toFixed(6)}
          </p>
        </section>

        <section className="panel">
          <div className="panel-title">
            <MapPin aria-hidden="true" />
            <h2>目標類別</h2>
          </div>
          <div className="category-grid">
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
              onClick={() => runSolver()}
              disabled={loading || pois.length === 0}
            >
              <Sparkles size={17} />
              重新計算
            </button>
          </div>
          <div className="status-box" aria-live="polite">
            {loading ? "處理中..." : status}
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
              {favorites.map((favorite) => (
                <div className="favorite-row" key={favorite.id}>
                  <span>{favorite.type === "poi" ? "地點" : "星形"}</span>
                  <strong>{favorite.name}</strong>
                  <button
                    className="icon-button compact"
                    type="button"
                    title="移除收藏"
                    onClick={() => removeFavorite(favorite.id)}
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              ))}
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
      </aside>

      <section className="map-wrap" aria-label="互動地圖">
        <div ref={mapElementRef} className="map" />
        <div className="map-counter">
          <strong>{pois.length}</strong> POI
          {pois.length > MAX_RENDERED_POIS && (
            <span>顯示前 {MAX_RENDERED_POIS} 筆</span>
          )}
        </div>
      </section>
    </main>
  );
}

export default App;
