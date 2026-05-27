---
name: mapping-star-spatial-analysis
description: Analyze and modify Mapping Star spatial math, star solving, honeycomb search, numerical scoring, geometry generation, and magic-circle target profiles. Use when changing `geo.ts`, `hexGrid.ts`, `solver.ts`, `starPatterns.ts`, `honeycombStrategy.ts`, `magicCircle.ts`, spatial tests, scoring thresholds, distance/bearing math, or performance-sensitive candidate search.
---

# Mapping Star Spatial Analysis

## Workflow

1. Read `docs/ai/mapping-star-project-map.md` to refresh module boundaries.
2. State the mathematical invariant before editing: units, coordinate system, expected range, tolerances, and performance cap.
3. Prefer pure helper changes with tests over embedding numerical logic inside `src/App.tsx`.
4. Keep existing public outputs compatible: `Poi.distanceMeters`, `Poi.bearingDeg`, `StarResult.score`, `rotationDeg`, `radiusMeanMeters`, `radiusStdMeters`, `angleErrorDeg`, and `centerErrorMeters`.
5. Run the spatial test set after changes: geo, hexGrid, honeycombStrategy, solver, magicCircle, and starNaming when naming depends on geometry.

## Units and Coordinates

- Store latitude/longitude in decimal degrees.
- Use meters for distance calculations and solver internals.
- Normalize bearings and rotations to `[0, 360)`.
- Use spherical calculations in `geo.ts` for real map positions.
- Use planar points only for local candidate ranking, hex-grid indexing, and symbolic target layouts.

## Solver Rules

- Keep POI identity unique by `Poi.id`; do not allow duplicate POIs in one result.
- Control combinatorial growth through `candidatesPerSlot`, rotation steps, honeycomb rings, target nodes, and result caps.
- Preserve generator progress from `solveStarFromPoisSteps`; UI progress and cancellation depend on it.
- Keep angular and honeycomb strategies comparable through the shared evaluation path where possible.
- When changing scoring, update tests to cover better/worse geometry, tie-breaking, center error, radius variance, and angle tolerance.

## Honeycomb and Symbolic Profiles

- `honeycombStrategy.ts` defines target bands and nodes for star, cross, bagua, rose, Sierpinski, and zodiac shapes.
- Profiles that need internal target nodes may set `ignoreInnerRadius`; reflect that in UI notes and solver params.
- Keep `magicCircle.ts` visual target geometry and `honeycombStrategy.ts` search target geometry conceptually aligned.
- Clamp user-controlled depth, petal count, radius, and ring settings to avoid runaway searches.

## Numerical Quality

Document non-obvious tolerances in tests. Prefer deterministic examples with known coordinates, bearings, and expected ordering over visual-only assertions.
