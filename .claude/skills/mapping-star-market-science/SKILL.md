---
name: mapping-star-market-science
description: Design market-science analysis for Mapping Star using POI, category, distance-band, star-result, and spatial context. Use when turning Mapping Star outputs into site-selection, catchment, competitor-density, tourism/commercial mix, opportunity scoring, report, export, or analytics features while keeping assumptions explicit and data limits visible.
---

# Mapping Star Market Science

## Workflow

1. Read `docs/ai/mapping-star-project-map.md` before designing analytics on top of project data.
2. Convert the user request into a testable market question: site selection, category density, competitor spacing, amenity mix, attraction/tourism context, transport access, or symbolic/star-fit opportunity.
3. Identify available data and missing data. Mapping Star has OSM-derived POIs, categories, distances, bearings, star results, and user-selected radius bands; it does not include sales, foot traffic, demographics, rent, or live business performance unless new sources are supplied.
4. Define metrics before implementation. Keep formulas simple, reproducible, and documented in code or tests.
5. Keep analytics pure where possible, then wire results into UI, export, or reports.

## Suitable Metrics

- POI count and density by category and radius band.
- Category mix and concentration ratio inside the search band.
- Nearest-neighbor distance and competitor spacing for selected categories.
- Anchor proximity to transport, attractions, schools, medical, parks, water, or commercial high-rises.
- Directional distribution by bearing sector.
- Star-result quality as a spatial pattern score, not as proof of commercial success.
- Coverage or scarcity score compared with a user-provided benchmark.

## Scientific Guardrails

- Label OSM data bias and missingness. Absence from Overpass is not absence in the real world.
- Do not infer revenue, demographics, or demand from POI counts alone.
- Separate descriptive metrics from recommendations.
- Include confidence or caveat text when rankings are based on incomplete public data.
- Make weights configurable when they encode market assumptions.

## Implementation Pattern

- Put reusable analytics in a new or existing pure module under `src/lib/`.
- Reuse `Poi`, `PoiCategory`, `StarResult`, and radius settings from `src/types.ts` and `src/lib/settings.ts`.
- Add tests for metric formulas, empty inputs, tied rankings, malformed POI tags, and radius boundaries.
- If adding UI, keep it dense and operational: sortable metrics, compact tables, clear caveats, and export-friendly output.
- If adding exports, keep XML exporters intact and add a separate CSV/JSON path only when requested.
