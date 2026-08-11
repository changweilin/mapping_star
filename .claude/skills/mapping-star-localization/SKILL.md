---
name: mapping-star-localization
description: Localize Mapping Star product copy and multilingual UX. Use when translating Traditional Chinese UI text, labels, aria/title copy, README/example docs, POI category names or descriptions, or when introducing a typed multilingual text system while preserving behavior, storage keys, OSM tags, and layout.
---

# Mapping Star Localization

Identifier and storage-key rules that copy edits must not break: `docs/ai/mapping-star-project-map.md`.

Search copy with `rg -n` before editing; visible text lives mostly in `src/App.tsx`, `src/components/*`, `src/data/categories.ts`, `README.md`, and `examples/`. Keep accessibility copy in sync with visible labels — `aria-label`, `title`, button text, status text, and empty states should describe the same action. Validate with `npm run build`, and `npm run test` when category data, naming, settings, or exporters change.

## Multilingual Architecture

- Introduce a typed dictionary or message module instead of conditional strings scattered through JSX.
- Traditional Chinese is the fallback locale unless the user specifies otherwise.
- Message keys stay stable, semantic, and ASCII, e.g. `search.centerLabel`, `results.emptyState`.
- Type interpolated values at call sites. Use small formatting helpers for distances, degrees, counts, and dates rather than concatenating translated fragments.
- Persisting a locale means extending `AppSettings` in `src/lib/settings.ts` with normalization and tests.

## Copy Rules

- Keep labels compact for dense map controls and mobile panels; long text belongs in tooltips or summaries only where the UI already has room.
- Check text length in mobile tabs, select labels, result rows, magic playback controls, and category chips.
- Preserve domain terms for star and symbolic modes — `五芒星`, `六芒星`, `七芒星`, `十字星`, `八卦圖`, `玫瑰曲線`, `Sierpinski`, zodiac names — unless a target-language glossary is requested.
- Error and warning text states what failed, what to try, and whether partial results are still usable.
- In `src/data/categories.ts`, keep `label`, `description`, `group`, `color`, `overpassFilters`, and `matches` coherent. Copy-only edits must not alter matching; if a category's meaning changes, use the parameter-data skill.
