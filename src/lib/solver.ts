import type {
  LatLng,
  Poi,
  SearchStrategy,
  StarMode,
  StarResult
} from "../types";
import {
  angularDifferenceDegrees,
  bearingDegrees,
  haversineDistanceMeters,
  normalizeDegrees
} from "./geo";

export const DEFAULT_SOLVER_SEARCH_STRATEGY: SearchStrategy = "honeycomb";
export const DEFAULT_HEX_CELL_RADIUS_METERS = 4000;

const SQRT_3 = Math.sqrt(3);

interface SolveOptions {
  mode: StarMode;
  center: LatLng;
  radiusMeters: number;
  innerRadiusMeters?: number;
  maxResults?: number;
  angleToleranceMultiplier?: number;
  angleToleranceDeg?: number;
  candidatesPerSlot?: number;
  rotationStepDeg?: number;
  minDistanceMeters?: number;
  searchStrategy?: SearchStrategy;
  hexCellRadiusMeters?: number;
  hexPriorityRings?: number;
}

interface Evaluation {
  score: number;
  radiusMeanMeters: number;
  radiusStdMeters: number;
  angleErrorDeg: number;
}

interface HexCell {
  q: number;
  r: number;
}

interface PlanarPoint {
  x: number;
  y: number;
}

interface HoneycombPoint extends PlanarPoint {
  poi: Poi;
  cell: HexCell;
}

interface HoneycombContext {
  cellRadiusMeters: number;
  targetRadiusMeters: number;
  priorityRings: number;
  cells: Map<string, HoneycombPoint[]>;
  pointsById: Map<string, HoneycombPoint>;
}

interface StarEdgeSegment {
  fromIndex: number;
  toIndex: number;
  from: PlanarPoint;
  to: PlanarPoint;
}

type RankedStarResult = StarResult & {
  searchPriorityScore: number;
};

export const starLineSequences = (mode: StarMode) =>
  mode === 5
    ? [[0, 2, 4, 1, 3, 0]]
    : [
        [0, 2, 4, 0],
        [1, 3, 5, 1]
      ];

const getTargets = (mode: StarMode, rotationDeg: number) =>
  Array.from({ length: mode }, (_, index) =>
    normalizeDegrees(rotationDeg + (360 / mode) * index)
  );

const HEX_DIRECTIONS: HexCell[] = [
  { q: 1, r: 0 },
  { q: 1, r: -1 },
  { q: 0, r: -1 },
  { q: -1, r: 0 },
  { q: -1, r: 1 },
  { q: 0, r: 1 }
];

const HONEYCOMB_EXPANSION_SCORE_STEP = 4;

const getTargetRadiusMeters = (
  outerRadiusMeters: number,
  innerRadiusMeters: number
) => {
  const radiusRangeMeters = Math.max(1, outerRadiusMeters - innerRadiusMeters);
  return innerRadiusMeters > 0
    ? innerRadiusMeters + radiusRangeMeters / 2
    : outerRadiusMeters;
};

const toPlanarPoint = (distanceMeters: number, bearingDeg: number) => {
  const bearing = (bearingDeg * Math.PI) / 180;
  return {
    x: distanceMeters * Math.sin(bearing),
    y: distanceMeters * Math.cos(bearing)
  };
};

const hexKey = ({ q, r }: HexCell) => `${q},${r}`;

const roundHex = (q: number, r: number): HexCell => {
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

const pointToHex = ({ x, y }: PlanarPoint, cellRadiusMeters: number) =>
  roundHex(
    ((SQRT_3 / 3) * x - y / 3) / cellRadiusMeters,
    ((2 / 3) * y) / cellRadiusMeters
  );

const hexDistance = (a: HexCell, b: HexCell) =>
  (Math.abs(a.q - b.q) +
    Math.abs(a.q + a.r - b.q - b.r) +
    Math.abs(a.r - b.r)) /
  2;

const addHex = (a: HexCell, b: HexCell, scale = 1): HexCell => ({
  q: a.q + b.q * scale,
  r: a.r + b.r * scale
});

const getHexRing = (center: HexCell, ring: number) => {
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

const normalizeHexCellRadius = (
  radiusMeters: number,
  hexCellRadiusMeters?: number
) => {
  const requestedRadius =
    typeof hexCellRadiusMeters === "number" &&
    Number.isFinite(hexCellRadiusMeters)
      ? hexCellRadiusMeters
      : DEFAULT_HEX_CELL_RADIUS_METERS;

  return Math.max(250, Math.min(Math.max(250, radiusMeters), requestedRadius));
};

const normalizeHexPriorityRings = (hexPriorityRings?: number) =>
  Math.max(
    0,
    Math.min(
      6,
      Math.floor(
        typeof hexPriorityRings === "number" &&
          Number.isFinite(hexPriorityRings)
          ? hexPriorityRings
          : 2
      )
    )
  );

const buildHoneycombContext = (
  prepared: Poi[],
  outerRadiusMeters: number,
  innerRadiusMeters: number,
  hexCellRadiusMeters?: number,
  hexPriorityRings?: number
): HoneycombContext => {
  const cellRadiusMeters = normalizeHexCellRadius(
    outerRadiusMeters,
    hexCellRadiusMeters
  );
  const cells = new Map<string, HoneycombPoint[]>();
  const pointsById = new Map<string, HoneycombPoint>();

  prepared.forEach((poi) => {
    const point = toPlanarPoint(poi.distanceMeters, poi.bearingDeg);
    const honeycombPoint = {
      poi,
      ...point,
      cell: pointToHex(point, cellRadiusMeters)
    };
    const key = hexKey(honeycombPoint.cell);
    const bucket = cells.get(key);
    if (bucket) {
      bucket.push(honeycombPoint);
    } else {
      cells.set(key, [honeycombPoint]);
    }
    pointsById.set(poi.id, honeycombPoint);
  });

  return {
    cellRadiusMeters,
    targetRadiusMeters: getTargetRadiusMeters(
      outerRadiusMeters,
      innerRadiusMeters
    ),
    priorityRings: normalizeHexPriorityRings(hexPriorityRings),
    cells,
    pointsById
  };
};

const collectHoneycombPoints = (
  context: HoneycombContext,
  targetCell: HexCell,
  maxRing = context.priorityRings,
  minRing = 0
) => {
  const points: HoneycombPoint[] = [];
  const seen = new Set<string>();

  for (let ring = Math.max(0, minRing); ring <= maxRing; ring += 1) {
    for (const cell of getHexRing(targetCell, ring)) {
      const bucket = context.cells.get(hexKey(cell));
      if (!bucket) continue;
      for (const point of bucket) {
        if (seen.has(point.poi.id)) continue;
        seen.add(point.poi.id);
        points.push(point);
      }
    }
  }

  return points;
};

const pointSegmentDistanceMeters = (
  point: PlanarPoint,
  start: PlanarPoint,
  end: PlanarPoint
) => {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const lengthSquared = dx * dx + dy * dy;
  if (lengthSquared === 0) {
    return Math.hypot(point.x - start.x, point.y - start.y);
  }

  const t = Math.max(
    0,
    Math.min(
      1,
      ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared
    )
  );
  const projected = {
    x: start.x + t * dx,
    y: start.y + t * dy
  };

  return Math.hypot(point.x - projected.x, point.y - projected.y);
};

const makeStarEdgeSegments = (
  mode: StarMode,
  targets: number[],
  targetRadiusMeters: number
) => {
  const targetPoints = targets.map((bearing) =>
    toPlanarPoint(targetRadiusMeters, bearing)
  );

  return starLineSequences(mode).flatMap((sequence) =>
    sequence.slice(0, -1).map((fromIndex, index) => ({
      fromIndex,
      toIndex: sequence[index + 1],
      from: targetPoints[fromIndex],
      to: targetPoints[sequence[index + 1]]
    }))
  );
};

const getConnectedEdgeDistanceMeters = (
  point: HoneycombPoint,
  slotIndex: number,
  edges: StarEdgeSegment[]
) => {
  const connectedEdges = edges.filter(
    (edge) => edge.fromIndex === slotIndex || edge.toIndex === slotIndex
  );
  if (connectedEdges.length === 0) return 0;

  return Math.min(
    ...connectedEdges.map((edge) =>
      pointSegmentDistanceMeters(point, edge.from, edge.to)
    )
  );
};

const rankHoneycombCandidates = (
  candidates: Array<{ poi: Poi; error: number }>,
  context: HoneycombContext,
  targetCell: HexCell,
  slotIndex: number,
  edges: StarEdgeSegment[]
) =>
  candidates
    .map(({ poi, error }) => {
      const point = context.pointsById.get(poi.id);
      return {
        poi,
        error,
        cornerRing: point
          ? hexDistance(point.cell, targetCell)
          : Number.MAX_SAFE_INTEGER,
        edgeDistanceMeters: point
          ? getConnectedEdgeDistanceMeters(point, slotIndex, edges)
          : Number.MAX_SAFE_INTEGER,
        radialErrorMeters: Math.abs(
          poi.distanceMeters - context.targetRadiusMeters
        )
      };
    })
    .sort((a, b) => {
      const cornerDelta = a.cornerRing - b.cornerRing;
      if (cornerDelta !== 0) return cornerDelta;

      const radialDelta = a.radialErrorMeters - b.radialErrorMeters;
      if (Math.abs(radialDelta) > 0.001) return radialDelta;

      const edgeDelta = a.edgeDistanceMeters - b.edgeDistanceMeters;
      if (Math.abs(edgeDelta) > 0.001) return edgeDelta;

      const angleDelta = a.error - b.error;
      if (Math.abs(angleDelta) > 0.0001) return angleDelta;

      return b.poi.distanceMeters - a.poi.distanceMeters;
    });

const cartesianUnique = (
  slots: Poi[][],
  onCombination: (points: Poi[]) => void
) => {
  const selected: Poi[] = [];
  const used = new Set<string>();

  const visit = (slotIndex: number) => {
    if (slotIndex === slots.length) {
      onCombination([...selected]);
      return;
    }

    for (const candidate of slots[slotIndex]) {
      if (used.has(candidate.id)) continue;
      used.add(candidate.id);
      selected.push(candidate);
      visit(slotIndex + 1);
      selected.pop();
      used.delete(candidate.id);
    }
  };

  visit(0);
};

const evaluate = (
  points: Poi[],
  targets: number[],
  outerRadiusMeters: number,
  innerRadiusMeters: number
): Evaluation => {
  const radii = points.map((point) => point.distanceMeters);
  const radiusMeanMeters =
    radii.reduce((total, radius) => total + radius, 0) / radii.length;
  const radiusVariance =
    radii.reduce(
      (total, radius) => total + (radius - radiusMeanMeters) ** 2,
      0
    ) / radii.length;
  const radiusStdMeters = Math.sqrt(radiusVariance);

  const angleErrors = points.map((point, index) =>
    angularDifferenceDegrees(point.bearingDeg, targets[index])
  );
  const angleErrorDeg =
    angleErrors.reduce((total, error) => total + error, 0) /
    angleErrors.length;

  const halfSlot = 180 / points.length;
  const angleScore =
    angleErrors.reduce((total, error) => total + (error / halfSlot) ** 2, 0) /
    angleErrors.length;
  const radialScore =
    radiusMeanMeters > 0 ? Math.min(1.5, radiusStdMeters / radiusMeanMeters) : 1;
  const radiusRangeMeters = Math.max(1, outerRadiusMeters - innerRadiusMeters);
  const targetRadiusMeters = getTargetRadiusMeters(
    outerRadiusMeters,
    innerRadiusMeters
  );
  const radiusPositionPenalty = Math.min(
    1,
    Math.abs(radiusMeanMeters - targetRadiusMeters) / radiusRangeMeters
  );

  return {
    score: angleScore * 0.56 + radialScore * 0.34 + radiusPositionPenalty * 0.1,
    radiusMeanMeters,
    radiusStdMeters,
    angleErrorDeg
  };
};

const insertBest = (
  results: RankedStarResult[],
  result: StarResult,
  maxResults: number,
  searchPriorityScore = result.score
) => {
  const signature = result.points
    .map((point) => point.id)
    .sort()
    .join("|");
  const existingIndex = results.findIndex(
    (existing) =>
      existing.points
        .map((point) => point.id)
        .sort()
        .join("|") === signature
  );
  if (existingIndex >= 0) {
    if (results[existingIndex].searchPriorityScore <= searchPriorityScore) {
      return;
    }
    results.splice(existingIndex, 1);
  }

  results.push({
    ...result,
    searchPriorityScore
  });
  results.sort(
    (a, b) =>
      a.searchPriorityScore - b.searchPriorityScore || a.score - b.score
  );
  if (results.length > maxResults) results.length = maxResults;
};

export const preparePois = (pois: Poi[], center: LatLng): Poi[] =>
  pois.map((poi) => {
    const position = { lat: poi.lat, lng: poi.lng };
    return {
      ...poi,
      distanceMeters: haversineDistanceMeters(center, position),
      bearingDeg: bearingDegrees(center, position)
    };
  });

const getAngularCandidates = (
  prepared: Poi[],
  target: number,
  toleranceDeg: number
) =>
  prepared
    .map((poi) => ({
      poi,
      error: angularDifferenceDegrees(poi.bearingDeg, target)
    }))
    .filter(({ error }) => error <= toleranceDeg);

const getAngularSlotCandidates = (
  prepared: Poi[],
  target: number,
  toleranceDeg: number,
  limit: number
) =>
  getAngularCandidates(prepared, target, toleranceDeg)
    .sort((a, b) => {
      const angleDelta = a.error - b.error;
      if (Math.abs(angleDelta) > 0.0001) return angleDelta;
      return b.poi.distanceMeters - a.poi.distanceMeters;
    })
    .slice(0, limit)
    .map(({ poi }) => poi);

const getHoneycombSlotCandidates = (
  context: HoneycombContext,
  target: number,
  slotIndex: number,
  toleranceDeg: number,
  limit: number,
  edges: StarEdgeSegment[],
  maxRing: number,
  minRing = 0
) => {
  const targetPoint = toPlanarPoint(context.targetRadiusMeters, target);
  const targetCell = pointToHex(targetPoint, context.cellRadiusMeters);
  const priorityCandidates = collectHoneycombPoints(
    context,
    targetCell,
    maxRing,
    minRing
  )
    .map((point) => ({
      poi: point.poi,
      error: angularDifferenceDegrees(point.poi.bearingDeg, target)
    }))
    .filter(({ error }) => error <= toleranceDeg);

  const rankedPriority = rankHoneycombCandidates(
    priorityCandidates,
    context,
    targetCell,
    slotIndex,
    edges
  );
  const candidates: Poi[] = [];

  for (const candidate of rankedPriority) {
    if (candidates.length >= limit) break;
    candidates.push(candidate.poi);
  }

  return candidates;
};

const getHoneycombFallbackSlotCandidates = (
  prepared: Poi[],
  context: HoneycombContext,
  target: number,
  slotIndex: number,
  toleranceDeg: number,
  limit: number,
  edges: StarEdgeSegment[]
) => {
  const targetPoint = toPlanarPoint(context.targetRadiusMeters, target);
  const targetCell = pointToHex(targetPoint, context.cellRadiusMeters);

  return rankHoneycombCandidates(
    getAngularCandidates(prepared, target, toleranceDeg),
    context,
    targetCell,
    slotIndex,
    edges
  )
    .slice(0, limit)
    .map(({ poi }) => poi);
};

const scoreHoneycombRotation = (
  context: HoneycombContext,
  targets: number[]
) =>
  targets.reduce((score, target) => {
    const targetCell = pointToHex(
      toPlanarPoint(context.targetRadiusMeters, target),
      context.cellRadiusMeters
    );
    return score + Math.min(12, collectHoneycombPoints(context, targetCell).length);
  }, 0);

export const solveStarFromPois = (
  pois: Poi[],
  {
    mode,
    center,
    radiusMeters,
    innerRadiusMeters = 0,
    maxResults = 5,
    angleToleranceMultiplier = 1,
    angleToleranceDeg,
    candidatesPerSlot,
    rotationStepDeg,
    minDistanceMeters = 30,
    searchStrategy = DEFAULT_SOLVER_SEARCH_STRATEGY,
    hexCellRadiusMeters,
    hexPriorityRings
  }: SolveOptions
): StarResult[] => {
  const minimumRadiusMeters = Math.max(minDistanceMeters, innerRadiusMeters);
  const prepared = preparePois(pois, center).filter(
    (poi) =>
      poi.distanceMeters >= minimumRadiusMeters &&
      poi.distanceMeters <= radiusMeters
  );

  if (prepared.length < mode) return [];

  const results: RankedStarResult[] = [];
  const slotWidth = 360 / mode;
  const halfSlot = slotWidth / 2;
  const step = Math.max(
    1,
    Math.min(slotWidth, rotationStepDeg ?? (mode === 5 ? 6 : 5))
  );
  const toleranceDeg = Math.max(
    1,
    Math.min(halfSlot, angleToleranceDeg ?? halfSlot * angleToleranceMultiplier)
  );
  const slotCandidateLimit = Math.max(
    1,
    Math.min(16, Math.floor(candidatesPerSlot ?? (mode === 5 ? 5 : 4)))
  );
  const resultPool = Math.max(maxResults * 8, 24);
  const honeycombContext =
    searchStrategy === "honeycomb"
      ? buildHoneycombContext(
          prepared,
          radiusMeters,
          innerRadiusMeters,
          hexCellRadiusMeters,
          hexPriorityRings
        )
      : null;
  const rotations: number[] = [];

  for (let rotationDeg = 0; rotationDeg < slotWidth; rotationDeg += step) {
    rotations.push(rotationDeg);
  }

  if (honeycombContext) {
    const rotationScores = new Map(
      rotations.map((rotationDeg) => [
        rotationDeg,
        scoreHoneycombRotation(
          honeycombContext,
          getTargets(mode, rotationDeg)
        )
      ])
    );
    rotations.sort((a, b) => {
      const scoreDelta =
        (rotationScores.get(b) ?? 0) - (rotationScores.get(a) ?? 0);
      return scoreDelta !== 0 ? scoreDelta : a - b;
    });
  }

  const addResultsFromSlots = (
    slots: Poi[][],
    targets: number[],
    rotationDeg: number,
    searchPriorityOffset = 0
  ) => {
    if (slots.some((slot) => slot.length === 0)) return;

    cartesianUnique(slots, (points) => {
      const evaluated = evaluate(
        points,
        targets,
        radiusMeters,
        innerRadiusMeters
      );
      insertBest(
        results,
        {
          id: `star-${mode}-${Date.now()}-${Math.random()
            .toString(36)
            .slice(2)}`,
          mode,
          center,
          points,
          rotationDeg,
          createdAt: new Date().toISOString(),
          ...evaluated
        },
        resultPool,
        searchPriorityOffset + evaluated.score
      );
    });
  };

  for (const rotationDeg of rotations) {
    const targets = getTargets(mode, rotationDeg);
    const edges = honeycombContext
      ? makeStarEdgeSegments(mode, targets, honeycombContext.targetRadiusMeters)
      : [];

    if (honeycombContext) {
      const addHoneycombStageResults = (
        maxRing: number,
        searchPriorityOffset: number,
        minRing = 0
      ) => {
        const slots = targets.map((target, slotIndex) =>
          getHoneycombSlotCandidates(
            honeycombContext,
            target,
            slotIndex,
            toleranceDeg,
            slotCandidateLimit,
            edges,
            maxRing,
            minRing
          )
        );

        addResultsFromSlots(
          slots,
          targets,
          rotationDeg,
          searchPriorityOffset
        );
      };

      for (let ring = 0; ring <= honeycombContext.priorityRings; ring += 1) {
        const searchPriorityOffset = ring * HONEYCOMB_EXPANSION_SCORE_STEP;
        addHoneycombStageResults(ring, searchPriorityOffset);
        if (ring > 0) {
          addHoneycombStageResults(ring, searchPriorityOffset, ring);
        }
      }

      const fallbackSlots = targets.map((target, slotIndex) =>
        getHoneycombFallbackSlotCandidates(
          prepared,
          honeycombContext,
          target,
          slotIndex,
          toleranceDeg,
          slotCandidateLimit,
          edges
        )
      );

      addResultsFromSlots(
        fallbackSlots,
        targets,
        rotationDeg,
        (honeycombContext.priorityRings + 1) *
          HONEYCOMB_EXPANSION_SCORE_STEP
      );
      continue;
    }

    addResultsFromSlots(
      targets.map((target) =>
        getAngularSlotCandidates(
          prepared,
          target,
          toleranceDeg,
          slotCandidateLimit
        )
      ),
      targets,
      rotationDeg
    );
  }

  return results
    .slice(0, maxResults)
    .map(({ searchPriorityScore, ...result }) => result);
};
