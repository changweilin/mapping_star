import L from "leaflet";
import {
  MAGIC_SPEED_OPTIONS,
  type MagicCircleStroke,
  type MagicSpeed
} from "./magicCircle";
import type { MagicPlayback, MagicPlaybackDirection, StarResult } from "../types";

export const MAGIC_POINT_DELAY_MS = 1880;
export const MAGIC_POINT_STEP_MS = 90;
export const MAGIC_POINT_DURATION_MS = 520;
export const MAGIC_TIMELINE_END_PADDING_MS = 140;

export type MagicSymbolStroke = Extract<MagicCircleStroke, { kind: "symbol" }>;

export const formatMagicSpeed = (speed: MagicSpeed) => `${speed}x`;

export const parseMagicSpeed = (value: string): MagicSpeed => {
  const numericValue = Number(value);
  return (
    MAGIC_SPEED_OPTIONS.find((option) => option === numericValue) ??
    MAGIC_SPEED_OPTIONS[0]
  );
};

export const getMagicTimelineDurationMs = (
  result: StarResult,
  strokes: MagicCircleStroke[]
) => {
  const strokeEndMs = strokes.reduce(
    (latestEndMs, stroke) =>
      Math.max(latestEndMs, stroke.delayMs + stroke.durationMs),
    0
  );
  const pointEndMs =
    result.points.length > 0
      ? MAGIC_POINT_DELAY_MS +
        (result.points.length - 1) * MAGIC_POINT_STEP_MS +
        MAGIC_POINT_DURATION_MS
      : 0;

  return Math.max(strokeEndMs, pointEndMs);
};

export const getMagicDelayMs = (
  delayMs: number,
  durationMs: number,
  direction: MagicPlaybackDirection,
  timelineDurationMs: number,
  timelinePositionMs: number
) => {
  const directedDelayMs =
    direction === "reverse"
      ? Math.max(0, timelineDurationMs - delayMs - durationMs)
      : delayMs;
  const directedPositionMs =
    direction === "reverse"
      ? Math.max(0, timelineDurationMs - timelinePositionMs)
      : timelinePositionMs;

  return directedDelayMs - directedPositionMs;
};

export const clampMagicTimelinePosition = (
  positionMs: number,
  durationMs: number
) => Math.max(0, Math.min(durationMs, positionMs));

export const getMagicBoundaryPosition = (
  direction: MagicPlaybackDirection,
  durationMs: number
) => (direction === "reverse" ? durationMs : 0);

const getLayerElement = (layer: L.Layer) => {
  const pathLayer = layer as L.Layer & {
    getElement?: () => HTMLElement | SVGElement | null;
  };

  return typeof pathLayer.getElement === "function"
    ? pathLayer.getElement()
    : null;
};

const setElementAnimationPlayback = (
  element: HTMLElement | SVGElement,
  playback: MagicPlayback,
  direction: MagicPlaybackDirection
) => {
  const animationPlayState = playback === "playing" ? "running" : "paused";
  const animationDirection = direction === "reverse" ? "reverse" : "normal";
  const applyAnimationState = (target: HTMLElement | SVGElement) => {
    target.style.animationPlayState = animationPlayState;
    target.style.animationDirection = animationDirection;
    if (direction === "reverse") {
      target.style.animationFillMode = "both";
    } else {
      target.style.removeProperty("animation-fill-mode");
    }
  };

  applyAnimationState(element);
  element
    .querySelectorAll<HTMLElement | SVGElement>("*")
    .forEach(applyAnimationState);
};

export const applyMagicStrokeTiming = (
  layer: L.Layer,
  stroke: MagicCircleStroke,
  speed: MagicSpeed,
  playback: MagicPlayback,
  direction: MagicPlaybackDirection,
  timelineDurationMs: number,
  timelinePositionMs: number
) => {
  const element = getLayerElement(layer);
  if (!element) return;

  element.classList.add("magic-drawable");
  if (stroke.kind !== "symbol" && element instanceof SVGElement) {
    element.setAttribute("pathLength", "1");
  }
  element.style.setProperty(
    "--magic-delay",
    `${
      getMagicDelayMs(
        stroke.delayMs,
        stroke.durationMs,
        direction,
        timelineDurationMs,
        timelinePositionMs
      ) / speed
    }ms`
  );
  element.style.setProperty("--magic-duration", `${stroke.durationMs / speed}ms`);
  if (stroke.kind === "symbol") {
    element.style.setProperty("--magic-symbol-size", `${stroke.sizePx}px`);
    element.style.setProperty("--magic-symbol-rotate", `${stroke.bearingDeg}deg`);
    element.style.setProperty("--magic-symbol-color", stroke.color);
    element.style.setProperty("--magic-symbol-accent", stroke.accent);
    element.style.setProperty("--magic-symbol-pale", stroke.pale);
    element.style.setProperty("--magic-symbol-opacity", `${stroke.opacity}`);
    element.style.setProperty("--magic-symbol-phase", `${stroke.phase}deg`);
  }
  setElementAnimationPlayback(element, playback, direction);
};

export const applyMagicMarkerTiming = (
  element: SVGElement,
  delayMs: number,
  durationMs: number,
  speed: MagicSpeed,
  playback: MagicPlayback,
  direction: MagicPlaybackDirection,
  timelineDurationMs: number,
  timelinePositionMs: number
) => {
  element.style.setProperty(
    "--magic-delay",
    `${
      getMagicDelayMs(
        delayMs,
        durationMs,
        direction,
        timelineDurationMs,
        timelinePositionMs
      ) / speed
    }ms`
  );
  element.style.setProperty("--magic-duration", `${durationMs / speed}ms`);
  setElementAnimationPlayback(element, playback, direction);
};

export const setMagicLayerPlayback = (
  group: L.LayerGroup | null,
  playback: MagicPlayback,
  direction: MagicPlaybackDirection
) => {
  group?.eachLayer((layer) => {
    const element = getLayerElement(layer);
    if (!element?.classList.contains("magic-drawable")) return;
    setElementAnimationPlayback(element, playback, direction);
  });
};
