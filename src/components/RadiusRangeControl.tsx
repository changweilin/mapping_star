import {
  type KeyboardEvent,
  type PointerEvent,
  useRef,
  useState
} from "react";

type RadiusHandle = "inner" | "outer";

export const RadiusRangeControl = ({
  innerRadiusKm,
  outerRadiusKm,
  maxRadiusKm,
  disabled = false,
  onInnerChange,
  onOuterChange
}: {
  innerRadiusKm: number;
  outerRadiusKm: number;
  maxRadiusKm: number;
  disabled?: boolean;
  onInnerChange: (value: number) => void;
  onOuterChange: (value: number) => void;
}) => {
  const trackRef = useRef<HTMLDivElement | null>(null);
  const [dragging, setDragging] = useState<RadiusHandle | null>(null);
  const innerPercent = (innerRadiusKm / maxRadiusKm) * 100;
  const outerPercent = (outerRadiusKm / maxRadiusKm) * 100;

  const clampRadius = (handle: RadiusHandle, value: number) =>
    handle === "inner"
      ? Math.max(0, Math.min(value, outerRadiusKm - 1))
      : Math.min(maxRadiusKm, Math.max(value, innerRadiusKm + 1));

  const updateRadius = (handle: RadiusHandle, value: number) => {
    const nextValue = clampRadius(handle, value);
    if (handle === "inner") {
      onInnerChange(nextValue);
    } else {
      onOuterChange(nextValue);
    }
  };

  const valueFromPointer = (clientX: number) => {
    const track = trackRef.current;
    if (!track) return 0;
    const rect = track.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    return Math.round(ratio * maxRadiusKm);
  };

  const updateFromPointer = (
    handle: RadiusHandle,
    event: PointerEvent<HTMLElement>
  ) => {
    updateRadius(handle, valueFromPointer(event.clientX));
  };

  const handleTrackPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (disabled) return;
    const value = valueFromPointer(event.clientX);
    const handle =
      Math.abs(value - innerRadiusKm) <= Math.abs(value - outerRadiusKm)
        ? "inner"
        : "outer";
    updateRadius(handle, value);
  };

  const handlePointerDown = (
    handle: RadiusHandle,
    event: PointerEvent<HTMLSpanElement>
  ) => {
    if (disabled) return;
    event.preventDefault();
    event.stopPropagation();
    setDragging(handle);
    event.currentTarget.setPointerCapture(event.pointerId);
    updateFromPointer(handle, event);
  };

  const handlePointerMove = (
    handle: RadiusHandle,
    event: PointerEvent<HTMLSpanElement>
  ) => {
    if (disabled) return;
    if (dragging === handle) updateFromPointer(handle, event);
  };

  const handlePointerUp = (event: PointerEvent<HTMLSpanElement>) => {
    event.currentTarget.releasePointerCapture(event.pointerId);
    setDragging(null);
  };

  const handleKeyDown = (
    handle: RadiusHandle,
    event: KeyboardEvent<HTMLSpanElement>
  ) => {
    if (disabled) return;
    const currentValue = handle === "inner" ? innerRadiusKm : outerRadiusKm;
    const step = event.shiftKey ? 5 : 1;
    const keyActions: Record<string, number> = {
      ArrowLeft: currentValue - step,
      ArrowDown: currentValue - step,
      ArrowRight: currentValue + step,
      ArrowUp: currentValue + step,
      Home: handle === "inner" ? 0 : innerRadiusKm + 1,
      End: handle === "inner" ? outerRadiusKm - 1 : maxRadiusKm
    };

    if (!(event.key in keyActions)) return;
    event.preventDefault();
    updateRadius(handle, keyActions[event.key]);
  };

  return (
    <div
      className={disabled ? "dual-range dual-range--disabled" : "dual-range"}
      ref={trackRef}
      onPointerDown={handleTrackPointerDown}
    >
      <div className="dual-range__track" aria-hidden="true">
        <span
          style={{
            left: `${innerPercent}%`,
            right: `${100 - outerPercent}%`
          }}
        />
      </div>
      <span
        aria-label="內徑"
        aria-valuemax={outerRadiusKm - 1}
        aria-valuemin={0}
        aria-valuenow={innerRadiusKm}
        className="dual-range__handle"
        role="slider"
        tabIndex={disabled ? -1 : 0}
        style={{ left: `${innerPercent}%` }}
        onKeyDown={(event) => handleKeyDown("inner", event)}
        onPointerDown={(event) => handlePointerDown("inner", event)}
        onPointerMove={(event) => handlePointerMove("inner", event)}
        onPointerUp={handlePointerUp}
      />
      <span
        aria-label="外徑"
        aria-valuemax={maxRadiusKm}
        aria-valuemin={innerRadiusKm + 1}
        aria-valuenow={outerRadiusKm}
        className="dual-range__handle"
        role="slider"
        tabIndex={disabled ? -1 : 0}
        style={{ left: `${outerPercent}%` }}
        onKeyDown={(event) => handleKeyDown("outer", event)}
        onPointerDown={(event) => handlePointerDown("outer", event)}
        onPointerMove={(event) => handlePointerMove("outer", event)}
        onPointerUp={handlePointerUp}
      />
    </div>
  );
};
