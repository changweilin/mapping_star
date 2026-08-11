---
name: mapping-star-spatial-analysis
description: Analyze and modify Mapping Star spatial math, star solving, honeycomb search, numerical scoring, geometry generation, and magic-circle target profiles. Use when changing `geo.ts`, `hexGrid.ts`, `solver.ts`, `starPatterns.ts`, `honeycombStrategy.ts`, `magicCircle.ts`, spatial tests, scoring thresholds, distance/bearing math, or performance-sensitive candidate search.
---

# Mapping Star Spatial Analysis

Units, coordinate rules, and module layout: `docs/ai/mapping-star-project-map.md`.

State the invariant before editing — units, coordinate system, expected range, tolerance, performance cap. Prefer pure helpers with tests over numerical logic inside `src/App.tsx`.

## Stable Outputs

Keep compatible: `Poi.distanceMeters`, `Poi.bearingDeg`, `StarResult.score`, `rotationDeg`, `radiusMeanMeters`, `radiusStdMeters`, `angleErrorDeg`, `centerErrorMeters`.

## Solver Rules

- `Poi.id` is unique per result; no duplicate POIs in one star.
- Bound combinatorial growth via `candidatesPerSlot`, rotation steps, honeycomb rings, target nodes, result caps.
- Preserve generator progress from `solveStarFromPoisSteps`; UI progress and cancellation depend on it.
- Keep angular and honeycomb strategies on the shared evaluation path where possible.
- Scoring changes need tests for better/worse geometry, tie-breaking, center error, radius variance, angle tolerance.

## Honeycomb and Symbolic Profiles

- `honeycombStrategy.ts` defines search target bands/nodes for star, cross, bagua, rose, Sierpinski, zodiac; `magicCircle.ts` defines the visual geometry. Keep the two conceptually aligned.
- Profiles needing internal target nodes set `ignoreInnerRadius`; reflect that in UI notes and solver params.
- Clamp user-controlled depth, petal count, radius, and ring settings to avoid runaway searches.

## Numerical Quality

Run the spatial test set after changes: geo, hexGrid, honeycombStrategy, solver, magicCircle, plus starNaming when naming depends on geometry. Document non-obvious tolerances in tests; prefer deterministic examples with known coordinates and expected ordering over visual-only assertions.
