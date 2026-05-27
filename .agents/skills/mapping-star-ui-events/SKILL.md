---
name: mapping-star-ui-events
description: Maintain Mapping Star React UI logic, state flow, and event handling. Use when changing `src/App.tsx`, Leaflet layer lifecycle, mobile interactions, pointer/touch/keyboard handlers, map controls, magic playback UI, result/favorite interactions, or component state contracts.
---

# Mapping Star UI Events

## Workflow

1. Read `docs/ai/mapping-star-project-map.md` when the affected flow is not already clear.
2. Locate the source of truth before editing: state in `src/App.tsx`, focused control state in `src/components/*`, persistent state in `src/lib/settings.ts` or `src/lib/favorites.ts`.
3. Trace the full event path from input to derived state, async side effect, map layer update, status/error text, and persistence.
4. Keep keyboard, pointer, touch, and screen-reader behavior aligned. Existing controls use explicit `aria-*`, roles, titles, and disabled states.
5. Validate with `npm run build`; add or update Vitest coverage when logic moves into pure helpers.

## React State Rules

- Keep derived values in `useMemo` when they depend on larger collections such as POIs, results, category sets, or honeycomb profiles.
- Use refs for mutable Leaflet objects, timers, playback state, and gesture tracking that should not trigger React renders.
- Clean up map layers, event listeners, timers, `ResizeObserver`, and pointer capture paths when adding new effects.
- Preserve abort and cancellation behavior for search/solve flows; stale async work must not overwrite newer user choices.
- Avoid broad `App.tsx` refactors unless the user asked for structural cleanup. Extract only when it reduces a real repeated UI pattern.

## Interaction Hotspots

- Radius range control: preserve inner/outer constraints, keyboard step behavior, pointer capture, and disabled state.
- Mobile tabs and splitter: keep swipe/tap thresholds stable and avoid layout shifts.
- Magic playback controls: keep mode, speed, direction, replay key, timeline position, and layer animation playback in sync.
- Category group selection: group toggles lock child categories and snapshot previous child selections; preserve restore behavior.
- Results and favorites: selection, expansion, map fitting, star export, and POI detail selection are linked; update them as a flow, not as isolated buttons.
- Map layers: Leaflet layers should be created, updated, and removed predictably through refs and helper functions.

## UI Verification

For meaningful visual or interaction changes, run the dev server and inspect the affected flow in a browser. Check desktop and mobile widths, text fit, disabled states, live progress, completion/error notices, and that the map is nonblank.
