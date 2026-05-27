---
name: mapping-star-parameter-data
description: Manage Mapping Star parameter data, POI taxonomy, Overpass rules, settings schema, persisted browser data, and export data contracts. Use when adding or changing POI categories, category groups, Overpass filters, tag matchers, defaults, setting clamps, migrations, localStorage keys, GPX/KML output, or category-driven tests.
---

# Mapping Star Parameter Data

## Workflow

1. Read `docs/ai/mapping-star-project-map.md` before changing data contracts.
2. Identify which contract is changing: POI category taxonomy, Overpass query generation, settings normalization, favorites shape, export output, or UI option defaults.
3. Update the source of truth first, then dependent UI, tests, and docs.
4. Preserve backward compatibility for persisted settings and favorites unless the user explicitly approves a migration break.
5. Run targeted tests, then `npm run test` when category, Overpass, settings, favorites, or exporters change.

## POI Categories

`src/data/categories.ts` is the taxonomy source. Each `PoiCategory` needs:

- Stable ASCII `id`.
- `group` that appears in `CATEGORY_GROUP_ORDER` and settings normalization.
- User-facing `label` and `description`.
- Distinct `color`.
- Bounded `overpassFilters`.
- A `matches(tags)` predicate that matches the same semantic category as the filters.
- Optional `broad: true` only for intentionally wide searches.

When adding a category, update tests that assert query construction, category matching, defaults, and settings normalization. Keep OSM tags literal and do not translate them.

## Overpass Rules

- Keep queries bounded by radius, bbox, category batching, and existing result caps.
- Prefer narrower filters and local post-filtering over broad `nwr` scans.
- Preserve endpoint fallback, transient-status retry behavior, timeout handling, warnings, and abort semantics.
- Ensure `buildOverpassQuery`, `buildOverpassBboxQuery`, and `parseOverpassElements` still agree on category filters and match predicates.

## Settings and Persistence

- Defaults live in `DEFAULT_APP_SETTINGS`; normalization and migration live in `normalizeSettings`.
- Clamp numeric values at the settings boundary, not in scattered UI code.
- Keep `StarMode`, `SearchStrategy`, theme, map layer, selected categories, selected groups, and group snapshots validated.
- Do not rename `mapping-star:settings` or `mapping-star:favorites` without a migration.
- If adding persisted fields, include fallback behavior for missing, malformed, or legacy data.

## Exports

GPX/KML output must remain valid XML. Escape user-facing names, preserve route sequence logic from `starLineSequences`, and add tests for any new field or format.
