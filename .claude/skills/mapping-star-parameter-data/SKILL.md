---
name: mapping-star-parameter-data
description: Manage Mapping Star parameter data, POI taxonomy, Overpass rules, settings schema, persisted browser data, and export data contracts. Use when adding or changing POI categories, category groups, Overpass filters, tag matchers, defaults, setting clamps, migrations, localStorage keys, GPX/KML output, or category-driven tests.
---

# Mapping Star Parameter Data

Contract locations and compatibility rules: `docs/ai/mapping-star-project-map.md`.

Identify which contract is changing — taxonomy, query generation, settings normalization, favorites shape, export output, or UI defaults — then update the source of truth first and dependents after. Run `npm run test` when category, Overpass, settings, favorites, or exporter behavior changes.

## POI Categories

`src/data/categories.ts` is the taxonomy source. Each `PoiCategory` needs a stable ASCII `id`, a `group` present in `CATEGORY_GROUP_ORDER` and settings normalization, user-facing `label` and `description`, a distinct `color`, bounded `overpassFilters`, and a `matches(tags)` predicate covering the same semantics as those filters. Set `broad: true` only for intentionally wide searches.

New or renamed categories require test updates for query construction, category matching, defaults, and settings normalization. Keep OSM tags literal.

## Overpass Rules

- Prefer narrower filters plus local post-filtering over broad `nwr` scans.
- `buildOverpassQuery`, `buildOverpassBboxQuery`, and `parseOverpassElements` must agree on filters and match predicates.

## Settings and Persistence

- Clamp numeric values in `normalizeSettings`, not in scattered UI code.
- Validate `StarMode`, `SearchStrategy`, theme, map layer, selected categories, selected groups, and group snapshots.

## Exports

GPX/KML must stay valid XML. Escape user-facing names, preserve route sequence logic from `starLineSequences`, and add tests for any new field or format.
