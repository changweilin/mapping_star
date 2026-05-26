export interface HexCell {
  q: number;
  r: number;
}

export interface PlanarPoint {
  x: number;
  y: number;
}

const SQRT_3 = Math.sqrt(3);
const MIN_HEX_CELL_RADIUS_METERS = 250;
const HEX_DIRECTIONS: HexCell[] = [
  { q: 1, r: 0 },
  { q: 1, r: -1 },
  { q: 0, r: -1 },
  { q: -1, r: 0 },
  { q: -1, r: 1 },
  { q: 0, r: 1 }
];

export const getHexTargetRadiusMeters = (
  outerRadiusMeters: number,
  innerRadiusMeters: number
) => Math.max(1, (outerRadiusMeters + Math.max(0, innerRadiusMeters)) / 2);

export const normalizeHexCellRadius = (
  outerRadiusMeters: number,
  hexCellRadiusMeters?: number,
  fallbackRadiusMeters = outerRadiusMeters
) => {
  const requestedRadius =
    typeof hexCellRadiusMeters === "number" &&
    Number.isFinite(hexCellRadiusMeters)
      ? hexCellRadiusMeters
      : fallbackRadiusMeters;

  return Math.max(
    MIN_HEX_CELL_RADIUS_METERS,
    Math.min(Math.max(MIN_HEX_CELL_RADIUS_METERS, outerRadiusMeters), requestedRadius)
  );
};

export const toPlanarPoint = (
  distanceMeters: number,
  bearingDeg: number
): PlanarPoint => {
  const bearing = (bearingDeg * Math.PI) / 180;
  return {
    x: distanceMeters * Math.sin(bearing),
    y: distanceMeters * Math.cos(bearing)
  };
};

export const planarDistanceMeters = (first: PlanarPoint, second: PlanarPoint) =>
  Math.hypot(first.x - second.x, first.y - second.y);

export const hexKey = ({ q, r }: HexCell) => `${q},${r}`;

export const roundHex = (q: number, r: number): HexCell => {
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

export const pointToHex = ({ x, y }: PlanarPoint, cellRadiusMeters: number) =>
  roundHex(
    ((SQRT_3 / 3) * x - y / 3) / cellRadiusMeters,
    ((2 / 3) * y) / cellRadiusMeters
  );

export const hexDistance = (a: HexCell, b: HexCell) =>
  (Math.abs(a.q - b.q) +
    Math.abs(a.q + a.r - b.q - b.r) +
    Math.abs(a.r - b.r)) /
  2;

export const addHex = (a: HexCell, b: HexCell, scale = 1): HexCell => ({
  q: a.q + b.q * scale,
  r: a.r + b.r * scale
});

export const getHexRing = (center: HexCell, ring: number) => {
  if (ring === 0) return [center];

  const cells: HexCell[] = [];
  let current = addHex(center, HEX_DIRECTIONS[4], ring);

  for (const direction of HEX_DIRECTIONS) {
    for (let step = 0; step < ring; step += 1) {
      cells.push(current);
      current = addHex(current, direction);
    }
  }

  return cells;
};

export const getHexCellCenterPlanar = (
  cell: HexCell,
  cellRadiusMeters: number
): PlanarPoint => ({
  x: cellRadiusMeters * SQRT_3 * (cell.q + cell.r / 2),
  y: cellRadiusMeters * 1.5 * cell.r
});
