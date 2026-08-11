---
name: mapping-star-market-science
description: Design market-science analysis for Mapping Star using POI, category, distance-band, star-result, and spatial context. Use when turning Mapping Star outputs into site-selection, catchment, competitor-density, tourism/commercial mix, opportunity scoring, report, export, or analytics features while keeping assumptions explicit and data limits visible.
---

# Mapping Star Market Science

Available data and module layout: `docs/ai/mapping-star-project-map.md`.

Convert the request into a testable market question — site selection, category density, competitor spacing, amenity mix, tourism context, transport access, or star-fit opportunity. Define metrics before implementing, and keep formulas simple, reproducible, and documented in code or tests.

## Data Boundary

Available: OSM-derived POIs, categories, distances, bearings, star results, user-selected radius bands. Not available unless the user supplies a source: sales, foot traffic, demographics, rent, live business performance.

## Suitable Metrics

- POI count and density by category and radius band.
- Category mix and concentration ratio inside the search band.
- Nearest-neighbor distance and competitor spacing per category.
- Anchor proximity to transport, attractions, schools, medical, parks, water, commercial high-rises.
- Directional distribution by bearing sector.
- Star-result quality as a spatial pattern score, never as proof of commercial success.
- Coverage or scarcity score against a user-provided benchmark.

## Guardrails

- Absence from Overpass is not absence in the real world; label OSM bias and missingness.
- Never infer revenue, demographics, or demand from POI counts alone.
- Keep descriptive metrics separate from recommendations, and attach caveats when rankings rest on incomplete public data.
- Make weights configurable when they encode market assumptions.

## Implementation Pattern

- Put analytics in a pure module under `src/lib/`, reusing `Poi`, `PoiCategory`, `StarResult`, and radius settings.
- Test metric formulas, empty inputs, tied rankings, malformed POI tags, and radius boundaries before wiring UI or exports.
- UI stays dense and operational: sortable metrics, compact tables, visible caveats.
- Leave XML exporters intact; add a CSV/JSON path only when requested.
