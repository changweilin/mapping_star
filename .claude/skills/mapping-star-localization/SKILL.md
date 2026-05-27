---
name: mapping-star-localization
description: Localize Mapping Star product copy and multilingual UX. Use when translating Traditional Chinese UI text, labels, aria/title copy, README/example docs, POI category names or descriptions, or when introducing a typed multilingual text system while preserving behavior, storage keys, OSM tags, and layout.
---

# Mapping Star Localization

## Workflow

1. Read `docs/ai/mapping-star-project-map.md` when the task touches unfamiliar modules.
2. Search copy with `rg -n` before editing. Visible text lives mostly in `src/App.tsx`, `src/components/*`, `src/data/categories.ts`, `README.md`, and examples.
3. Separate human-facing copy from stable identifiers. Never translate TypeScript identifiers, `PoiCategory.id`, category group logic, OSM/Overpass tag keys, CSS classes, storage keys, route/export XML tags, or test fixture IDs unless the user explicitly asks for a data migration.
4. Keep accessibility copy in sync with visible labels: `aria-label`, `title`, button text, status text, and empty-state text should describe the same action.
5. After editing copy, run the narrowest useful validation. Use `npm run build` for TypeScript/JSX edits and `npm run test` when category data, naming, settings, or exporters change.

## Multilingual Architecture

- If the task asks for multiple languages, introduce a typed dictionary or message module instead of scattering conditional strings through JSX.
- Use Traditional Chinese as the fallback locale unless the user specifies another default.
- Keep message keys stable, semantic, and ASCII, for example `search.centerLabel` or `results.emptyState`.
- Keep interpolated values typed at call sites. Prefer small formatting helpers for distances, degrees, counts, and dates rather than concatenating translated fragments.
- Preserve existing `localStorage` data. If locale must be persisted, extend `AppSettings` through `src/lib/settings.ts` with normalization and tests.

## UI Copy Rules

- Maintain compact labels for dense map controls and mobile panels. Long text should move to supporting copy, tooltips, or summaries only when the existing UI has a place for it.
- Check text length in controls such as mobile tabs, select labels, result rows, magic playback controls, and category chips.
- Preserve domain language for star and symbolic modes: `五芒星`, `六芒星`, `七芒星`, `十字星`, `八卦圖`, `玫瑰曲線`, `Sierpinski`, and zodiac names unless a target-language glossary is requested.
- Translate user-facing error and warning text with operational clarity: what failed, what the user can try, and whether partial results remain usable.

## Category Copy

When editing `src/data/categories.ts`, keep each category's `label`, `description`, `group`, `color`, `overpassFilters`, and `matches` predicate coherent. Copy-only edits should not alter matching behavior. If a category name changes meaning, use the parameter-data skill instead.
