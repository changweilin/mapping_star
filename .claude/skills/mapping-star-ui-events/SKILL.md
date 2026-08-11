---
name: mapping-star-ui-events
description: Maintain Mapping Star React UI logic, state flow, and event handling. Use when changing `src/App.tsx`, Leaflet layer lifecycle, mobile interactions, pointer/touch/keyboard handlers, map controls, magic playback UI, result/favorite interactions, or component state contracts.
---

# Mapping Star UI Events

Module layout and `App.tsx` cautions: `docs/ai/mapping-star-project-map.md`.

Locate the source of truth before editing — state in `src/App.tsx`, control state in `src/components/*`, persisted state in `src/lib/settings.ts` or `src/lib/favorites.ts`, Leaflet objects in refs. Trace the full path from input to derived state, async side effect, map layer update, status/error text, and persistence.

## React State Rules

- `useMemo` for values derived from larger collections: POIs, results, category sets, honeycomb profiles.
- Refs for mutable Leaflet objects, timers, playback state, and gesture tracking that must not trigger renders.
- Every new effect cleans up its map layers, listeners, timers, `ResizeObserver`, and pointer capture.
- Preserve abort/cancellation for search and solve; stale async work must not overwrite newer user choices.
- Keep keyboard, pointer, touch, `aria-*`, role, title, and disabled behavior aligned with existing controls.

## Interaction Hotspots

- Radius range control: inner/outer constraints, keyboard step, pointer capture, disabled state.
- Mobile tabs and splitter: stable swipe/tap thresholds, no layout shifts.
- Magic playback: mode, speed, direction, replay key, timeline position, and layer animation stay in sync.
- Category groups: group toggles lock child categories and snapshot previous child selections; preserve restore behavior.
- Results and favorites: selection, expansion, map fitting, star export, and POI detail are one linked flow.
- Map layers: create, update, and remove predictably through refs and helper functions.

## Verification

`npm run build` for edits; add Vitest coverage when logic moves into pure helpers. For meaningful visual or interaction changes, run the dev server and check desktop and mobile widths, text fit, disabled states, live progress, completion/error notices, and that the map is nonblank.
