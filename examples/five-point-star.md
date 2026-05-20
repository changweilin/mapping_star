# 五芒星成功繪製範例

本文件提供三組可重現的五芒星範例。每組都使用專案的幾何邏輯產生五個方位點，並可交給 `solveStarFromPois` 解出五芒星。

專案繪製五芒星的連線順序是：

```text
點 1 -> 點 3 -> 點 5 -> 點 2 -> 點 4 -> 點 1
```

## 範例 1：台北 101 周邊

建議參數：

```ts
mode: 5
center: { lat: 25.033964, lng: 121.564468 }
radiusMeters: 12000
angleToleranceDeg: 6
candidatesPerSlot: 1
rotationStepDeg: 1
```

五個點：

| 順序 | 方位角 | 緯度 | 經度 |
|---:|---:|---:|---:|
| 1 | 0° | 25.123896 | 121.564468 |
| 2 | 72° | 25.061725 | 121.658888 |
| 3 | 144° | 24.961196 | 121.622775 |
| 4 | 216° | 24.961196 | 121.506161 |
| 5 | 288° | 25.061725 | 121.470048 |

## 範例 2：高雄中央公園周邊

建議參數：

```ts
mode: 5
center: { lat: 22.623283, lng: 120.301435 }
radiusMeters: 10000
angleToleranceDeg: 6
candidatesPerSlot: 1
rotationStepDeg: 1
```

五個點：

| 順序 | 方位角 | 緯度 | 經度 |
|---:|---:|---:|---:|
| 1 | 18° | 22.691706 | 120.325533 |
| 2 | 90° | 22.623264 | 120.379378 |
| 3 | 162° | 22.554857 | 120.325509 |
| 4 | 234° | 22.580982 | 120.238397 |
| 5 | 306° | 22.665559 | 120.238358 |

## 範例 3：台中公園周邊

建議參數：

```ts
mode: 5
center: { lat: 24.144671, lng: 120.683981 }
radiusMeters: 8000
angleToleranceDeg: 6
candidatesPerSlot: 1
rotationStepDeg: 1
```

五個點：

| 順序 | 方位角 | 緯度 | 經度 |
|---:|---:|---:|---:|
| 1 | 36° | 24.188321 | 120.718750 |
| 2 | 108° | 24.127986 | 120.740212 |
| 3 | 180° | 24.090712 | 120.683981 |
| 4 | 252° | 24.127986 | 120.627750 |
| 5 | 324° | 24.188321 | 120.649212 |

## Solver 使用範例

以下片段示範如何將「台北 101 周邊」的五個點交給專案演算法：

```ts
import { POI_CATEGORIES } from "../src/data/categories";
import { solveStarFromPois } from "../src/lib/solver";
import type { Poi } from "../src/types";

const category = POI_CATEGORIES[0];
const center = { lat: 25.033964, lng: 121.564468 };

const pois: Poi[] = [
  [1, "台北星點 1", 25.123896, 121.564468],
  [2, "台北星點 2", 25.061725, 121.658888],
  [3, "台北星點 3", 24.961196, 121.622775],
  [4, "台北星點 4", 24.961196, 121.506161],
  [5, "台北星點 5", 25.061725, 121.470048]
].map(([id, name, lat, lng]) => ({
  id: `example/${id}`,
  osmType: "node",
  osmId: Number(id),
  name: String(name),
  lat: Number(lat),
  lng: Number(lng),
  categoryId: category.id,
  categoryLabel: category.label,
  categoryColor: category.color,
  tags: {},
  distanceMeters: 0,
  bearingDeg: 0
}));

const results = solveStarFromPois(pois, {
  mode: 5,
  center,
  radiusMeters: 12000,
  angleToleranceDeg: 6,
  candidatesPerSlot: 1,
  rotationStepDeg: 1
});

console.log(results[0].points.map((point) => point.name));
// ["台北星點 1", "台北星點 2", "台北星點 3", "台北星點 4", "台北星點 5"]
```

預期結果：

- `results.length` 會大於 `0`
- `results[0].mode` 會是 `5`
- `results[0].angleErrorDeg` 接近 `0`
- 地圖實際繪製線段時，會依 `1 -> 3 -> 5 -> 2 -> 4 -> 1` 呈現五芒星

