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
import {
  defaultCandidatesPerSlotForMode,
  defaultRotationStepForMode,
  starLineSequencesForMode
} from "./starPatterns";

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
  centerErrorMeters: number;
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

export type SolveProgressStage =
  | "target-corners"
  | "target-rotation"
  | "radius-expansion"
  | "fallback"
  | "angular";

export interface SolveProgress {
  stage: SolveProgressStage;
  label: string;
  completedSteps: number;
  totalSteps: number;
  progress: number;
  results: StarResult[];
  bestResult: StarResult | null;
}

export const starLineSequences = starLineSequencesForMode;

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

const getTargetRadiusMeters = (
  outerRadiusMeters: number,
  innerRadiusMeters: number
) => Math.max(1, (outerRadiusMeters + Math.max(0, innerRadiusMeters)) / 2);

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
  const planarPoints = points.map((point) =>
    toPlanarPoint(point.distanceMeters, point.bearingDeg)
  );
  const centerOffset = planarPoints.reduce(
    (total, point) => ({
      x: total.x + point.x / planarPoints.length,
      y: total.y + point.y / planarPoints.length
    }),
    { x: 0, y: 0 }
  );
  const centerErrorMeters = Math.hypot(centerOffset.x, centerOffset.y);
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
    angleErrorDeg,
    centerErrorMeters
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
    const existing = results[existingIndex];
    const scoreDelta = existing.score - result.score;
    if (
      scoreDelta < -0.000001 ||
      (Math.abs(scoreDelta) <= 0.000001 &&
        existing.searchPriorityScore <= searchPriorityScore)
    ) {
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
      a.score - b.score || a.searchPriorityScore - b.searchPriorityScore
  );
  if (results.length > maxResults) results.length = maxResults;
};

const toPublicResults = (results: RankedStarResult[], maxResults: number) =>
  results
    .slice(0, maxResults)
    .map(({ searchPriorityScore, ...result }) => result);

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

export function* solveStarFromPoisSteps(
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
): Generator<SolveProgress, StarResult[]> {
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
    Math.min(slotWidth, rotationStepDeg ?? defaultRotationStepForMode(mode))
  );
  const toleranceDeg = Math.max(
    1,
    Math.min(halfSlot, angleToleranceDeg ?? halfSlot * angleToleranceMultiplier)
  );
  const slotCandidateLimit = Math.max(
    1,
    Math.min(
      16,
      Math.floor(candidatesPerSlot ?? defaultCandidatesPerSlotForMode(mode))
    )
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

  let completedSteps = 0;
  let searchPriorityStep = 0;
  const makeProgress = (
    stage: SolveProgressStage,
    label: string,
    totalSteps: number
  ): SolveProgress => {
    completedSteps += 1;
    const publicResults = toPublicResults(results, maxResults);

    return {
      stage,
      label,
      completedSteps,
      totalSteps,
      progress: totalSteps <= 0 ? 1 : completedSteps / totalSteps,
      results: publicResults,
      bestResult: publicResults[0] ?? null
    };
  };

  if (honeycombContext) {
    const totalSteps =
      rotations.length +
      rotations.length * honeycombContext.priorityRings * 2 +
      rotations.length;
    const addHoneycombStageResults = (
      rotationDeg: number,
      maxRing: number,
      minRing = 0
    ) => {
      const targets = getTargets(mode, rotationDeg);
      const edges = makeStarEdgeSegments(
        mode,
        targets,
        honeycombContext.targetRadiusMeters
      );
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
        searchPriorityStep
      );
      searchPriorityStep += 1;
    };

    for (const [rotationIndex, rotationDeg] of rotations.entries()) {
      addHoneycombStageResults(rotationDeg, 0);
      yield makeProgress(
        rotationIndex === 0 ? "target-corners" : "target-rotation",
        rotationIndex === 0
          ? `掃描第 1 到 ${mode} 號目標蜂巢`
          : `沿目標半徑旋轉搜尋 ${rotationIndex + 1}/${rotations.length}`,
        totalSteps
      );
    }

    for (let ring = 1; ring <= honeycombContext.priorityRings; ring += 1) {
      for (const [rotationIndex, rotationDeg] of rotations.entries()) {
        addHoneycombStageResults(rotationDeg, ring);
        yield makeProgress(
          "radius-expansion",
          `往內外半徑擴展第 ${ring} 圈 ${rotationIndex + 1}/${
            rotations.length
          }`,
          totalSteps
        );
      }

      for (const [rotationIndex, rotationDeg] of rotations.entries()) {
        addHoneycombStageResults(rotationDeg, ring, ring);
        yield makeProgress(
          "radius-expansion",
          `精搜第 ${ring} 圈蜂巢 ${rotationIndex + 1}/${rotations.length}`,
          totalSteps
        );
      }
    }

    for (const [rotationIndex, rotationDeg] of rotations.entries()) {
      const targets = getTargets(mode, rotationDeg);
      const edges = makeStarEdgeSegments(
        mode,
        targets,
        honeycombContext.targetRadiusMeters
      );
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
        searchPriorityStep
      );
      searchPriorityStep += 1;
      yield makeProgress(
        "fallback",
        `整理備援角度結果 ${rotationIndex + 1}/${rotations.length}`,
        totalSteps
      );
    }

    return toPublicResults(results, maxResults);
  }

  const totalSteps = rotations.length;
  for (const [rotationIndex, rotationDeg] of rotations.entries()) {
    const targets = getTargets(mode, rotationDeg);

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
      rotationDeg,
      searchPriorityStep
    );
    searchPriorityStep += 1;
    yield makeProgress(
      "angular",
      `角度旋轉搜尋 ${rotationIndex + 1}/${rotations.length}`,
      totalSteps
    );
  }

  return toPublicResults(results, maxResults);
}

export const solveStarFromPois = (
  pois: Poi[],
  options: SolveOptions
): StarResult[] => {
  const iterator = solveStarFromPoisSteps(pois, options);
  let step = iterator.next();

  while (!step.done) {
    step = iterator.next();
  }

  return step.value;
};
