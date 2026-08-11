# Mapping Star Project Map

Canonical AI context for this repo. Skills and agent definitions point here; do not restate this content elsewhere.

## What It Is

React 18 + TypeScript + Vite + Vitest map tool. It finds POI combinations around a chosen center that form star-like or symbolic geometry: queries OpenStreetMap through Overpass, scores candidates, renders on Leaflet, animates magic-circle overlays, saves favorites in `localStorage`, exports GPX/KML.

External services: Overpass, Nominatim, OSM/OpenTopoMap/Esri tiles.
Commands: `npm run dev`, `npm run test`, `npm run build`.

## Modules

- `src/App.tsx` — stateful UI coordinator: state, handlers, Leaflet layers, search, solve, favorites, export, magic playback.
- `src/types.ts` — `LatLng`, `Poi`, `PoiCategory`, `StarMode`, `SearchStrategy`, `StarResult`.
- `src/data/categories.ts` — POI taxonomy: groups, labels, colors, `overpassFilters`, `matches(tags)`.
- `src/lib/overpass.ts` — query builders, endpoint fallback, timeouts, element parsing, POI normalization, warnings.
- `src/lib/placeSearch.ts` — Nominatim search and coordinate parsing.
- `src/lib/settings.ts` — `DEFAULT_APP_SETTINGS`, `normalizeSettings`, legacy migration, clamps.
- `src/lib/geo.ts` — spherical distance, bearing, destination point, degree normalization.
- `src/lib/hexGrid.ts` — local planar projection and axial hex-grid utilities.
- `src/lib/honeycombStrategy.ts` — target-cell profiles for star, cross, bagua, rose, Sierpinski, zodiac.
- `src/lib/solver.ts` — POI prep, angular/honeycomb ranking, target assignment, scoring, progress steps, `StarResult`.
- `src/lib/starPatterns.ts` — symbolic modes and line sequences.
- `src/lib/magicCircle.ts` — magic elements, symbolic geometry, zodiac data, animation strokes.
- `src/lib/favorites.ts` — favorite POI/star serialization.
- `src/lib/exporters.ts` — GPX/KML generation.
- `src/components/*` — presentational controls and summaries.

## Data Flow

1. Center comes from coordinate input, browser location, or Nominatim result.
2. Settings and category selections load from `mapping-star:settings`, normalize, then write back on change.
3. Selected categories build Overpass queries; returned elements match back to categories and gain distance/bearing.
4. Solver prepares POIs, picks angular or honeycomb strategy, ranks combinations, scores geometry, returns sorted `StarResult`s.
5. `App.tsx` renders sectors, honeycomb targets, POI markers, star lines, summary metrics, magic strokes.
6. Favorites persist under `mapping-star:favorites`; stars and favorites export to GPX/KML.

## Invariants

- WGS84 decimal degrees; meters internally, km only at UI boundaries; bearings and rotations normalized to `[0, 360)`.
- Planar projections are for local ranking, hex indexing, and symbolic layouts only — never for real map positions.
- `StarMode` is `4 | 5 | 6 | 7 | 8`. Keep `starPatterns`, settings clamps, solver, UI options, magic geometry, and tests aligned.
- `SearchStrategy` is `angular | honeycomb`; honeycomb profiles may set `ignoreInnerRadius` for inner-node symbols. The angular strategy exists because combination counts explode with POI density, so the search splits the radius band into bearing sectors and picks one POI per sector — see [angular-search-concept.jpg](angular-search-concept.jpg).
- A category's `overpassFilters` and `matches(tags)` must stay semantically identical.
- Keep Overpass queries bounded: narrow filters, category batching, result caps, warnings. Preserve endpoint fallback, retry, timeout, abort, and partial-result behavior — public services fail and rate-limit.
- `mapping-star:settings` and `mapping-star:favorites` shapes are backward compatible; new fields need defaults plus malformed/legacy fallback. No key rename without a migration.
- `App.tsx` is large and stateful. Trace the existing source of truth before moving state or adding handlers; no broad refactors unless asked.
- UI copy is mostly Traditional Chinese. Never translate OSM tag keys, category IDs, storage keys, CSS classes, XML tags, or TypeScript identifiers unless a migration is explicitly requested.

## Validation

- Spatial/solving: `geo`, `hexGrid`, `honeycombStrategy`, `solver`, `magicCircle` tests in `src/test/`.
- Data/API: `overpass`, `settings`, `placeSearch`.
- Persistence/export/naming: `favorites`, `exporters`, `lastStar`, `starNaming`.
- `npm run test` for logic, `npm run build` for type/build. Inspect the running app in a browser for meaningful UI behavior changes.
