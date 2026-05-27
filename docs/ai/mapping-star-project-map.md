# Mapping Star Project Map

## Purpose

Mapping Star is a React/Vite map tool that finds POI combinations around a chosen center that can form star-like or symbolic geometry. It queries OpenStreetMap data through Overpass, scores candidate POIs, renders the result on Leaflet, animates magic-circle overlays, saves favorites in `localStorage`, and exports GPX/KML.

## Stack

- React 18, TypeScript, Vite, Vitest
- Leaflet for map rendering
- OpenStreetMap, OpenTopoMap, Esri tiles, Nominatim search, Overpass API
- Core commands: `npm run test`, `npm run build`, `npm run dev`

## Primary Modules

- `src/App.tsx`: large UI coordinator for state, event handlers, Leaflet layers, search, solve, favorites, export, and magic playback.
- `src/types.ts`: shared domain types such as `LatLng`, `Poi`, `PoiCategory`, `StarMode`, `SearchStrategy`, and `StarResult`.
- `src/data/categories.ts`: POI taxonomy, group labels, colors, Overpass filters, and local tag-match predicates.
- `src/lib/overpass.ts`: Overpass query builders, endpoint fallback, timeout handling, element parsing, POI normalization, warnings.
- `src/lib/placeSearch.ts`: Nominatim search and coordinate parsing.
- `src/lib/settings.ts`: default settings, persisted settings normalization, legacy migration, clamp rules.
- `src/lib/geo.ts`: spherical distance, bearing, destination point, degree normalization.
- `src/lib/hexGrid.ts`: local planar projection and axial hex-grid utilities.
- `src/lib/honeycombStrategy.ts`: target-cell profiles for star, cross, bagua, rose, Sierpinski, and zodiac search.
- `src/lib/solver.ts`: POI preparation, angular/honeycomb candidate ranking, target assignment, scoring, progress steps, public `StarResult` output.
- `src/lib/starPatterns.ts`: supported symbolic modes and line sequences.
- `src/lib/magicCircle.ts`: magic element definitions, symbolic geometry, zodiac data, animation stroke generation.
- `src/lib/favorites.ts`: favorite POI/star serialization in browser storage.
- `src/lib/exporters.ts`: GPX/KML generation.
- `src/components/*`: focused presentational controls and summaries.

## Data Flow

1. User sets a center by coordinate, browser location, or Nominatim result.
2. Settings and category selections are loaded from `mapping-star:settings`, normalized, then written back on change.
3. Selected `PoiCategory` records produce Overpass queries; returned elements are matched back to categories and enriched with distance and bearing.
4. Solver prepares POIs, chooses angular or honeycomb strategy, ranks combinations, scores geometry, and returns sorted `StarResult` records.
5. `App.tsx` renders sectors, honeycomb targets, POI markers, star lines, summary metrics, and magic-circle strokes.
6. Favorites are stored under `mapping-star:favorites`; selected stars and favorites export to GPX/KML.

## Domain Invariants

- Keep lat/lng in WGS84 decimal degrees. Use meters internally for distances and km only at UI boundaries.
- Normalize bearings and rotations to `[0, 360)`.
- `StarMode` is currently `4 | 5 | 6 | 7 | 8`; keep `starPatterns`, settings clamps, solver logic, UI options, tests, and magic geometry aligned.
- `SearchStrategy` is `angular | honeycomb`; honeycomb profiles may ignore inner radius for inner-node symbols.
- POI category changes must keep `overpassFilters` and `matches(tags)` semantically aligned.
- Overpass queries must remain bounded. Prefer narrower filters, existing result caps, category batching, and warnings over unbounded fetches.
- `App.tsx` is stateful and large. Trace the existing source of truth before moving state or introducing new handlers.
- Public service calls can fail or rate-limit; preserve abort, fallback, warning, and partial-result behavior.
- UI copy is mostly Traditional Chinese. Do not translate OSM tag keys, category IDs, storage keys, CSS classes, or TypeScript identifiers unless explicitly asked.

## Validation Map

- Spatial math and solving: `src/test/geo.test.ts`, `src/test/hexGrid.test.ts`, `src/test/honeycombStrategy.test.ts`, `src/test/solver.test.ts`, `src/test/magicCircle.test.ts`.
- Data and API rules: `src/test/overpass.test.ts`, `src/test/settings.test.ts`, `src/test/placeSearch.test.ts`.
- Persistence/export/naming: `src/test/favorites.test.ts`, `src/test/exporters.test.ts`, `src/test/lastStar.test.ts`, `src/test/starNaming.test.ts`.
- Use `npm run test` for logic changes and `npm run build` for type/build validation. For meaningful UI behavior changes, also inspect the running app in a browser.
