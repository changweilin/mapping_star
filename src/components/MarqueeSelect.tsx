import {
  type CSSProperties,
  type ChangeEvent,
  type ReactNode,
  type TouchEvent,
  type WheelEvent,
  useEffect,
  useRef,
  useState
} from "react";

type MarqueeSelectProps = {
  label: string;
  hideLabel?: boolean;
  value: string | number;
  valueLabel: string;
  children: ReactNode;
  onChange: (value: string) => void;
  onTouchCancel?: (event: TouchEvent<HTMLElement>) => void;
  onTouchEnd?: (event: TouchEvent<HTMLElement>) => void;
  onTouchMove?: (event: TouchEvent<HTMLElement>) => void;
  onTouchStart?: (event: TouchEvent<HTMLElement>) => void;
  onWheel?: (event: WheelEvent<HTMLElement>) => void;
};

export const MarqueeSelect = ({
  label,
  hideLabel = false,
  value,
  valueLabel,
  children,
  onChange,
  onTouchCancel,
  onTouchEnd,
  onTouchMove,
  onTouchStart,
  onWheel
}: MarqueeSelectProps) => {
  const rootRef = useRef<HTMLLabelElement>(null);
  const viewportRef = useRef<HTMLSpanElement>(null);
  const textRef = useRef<HTMLSpanElement>(null);
  const [isOverflowing, setIsOverflowing] = useState(false);
  const [marqueeShiftPx, setMarqueeShiftPx] = useState(0);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return undefined;

    const preventNativeScroll = (event: Event) => {
      event.preventDefault();
    };

    root.addEventListener("wheel", preventNativeScroll, { passive: false });

    return () => {
      root.removeEventListener("wheel", preventNativeScroll);
    };
  }, []);

  useEffect(() => {
    const measure = () => {
      const viewport = viewportRef.current;
      const text = textRef.current;
      if (!viewport || !text) return;

      const overflowPx = Math.max(0, text.scrollWidth - viewport.clientWidth);
      setIsOverflowing(overflowPx > 1);
      setMarqueeShiftPx(Math.ceil(overflowPx));
    };

    measure();

    if (typeof window === "undefined") return undefined;

    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", measure);
      return () => window.removeEventListener("resize", measure);
    }

    const observer = new ResizeObserver(measure);
    if (viewportRef.current) observer.observe(viewportRef.current);
    if (textRef.current) observer.observe(textRef.current);

    return () => observer.disconnect();
  }, [valueLabel]);

  const className = isOverflowing
    ? "select-wrap select-wrap--compact select-wrap--marquee"
    : "select-wrap select-wrap--compact";
  const marqueeStyle = {
    "--select-marquee-shift": `-${marqueeShiftPx}px`
  } as CSSProperties;

  return (
    <label
      className={className}
      ref={rootRef}
      onTouchCancel={onTouchCancel}
      onTouchEnd={onTouchEnd}
      onTouchMove={onTouchMove}
      onTouchStart={onTouchStart}
      onWheel={onWheel}
    >
      {!hideLabel && <span className="select-wrap__label">{label}</span>}
      <span className="select-shell" title={valueLabel}>
        <select
          aria-label={label}
          value={value}
          onChange={(event: ChangeEvent<HTMLSelectElement>) =>
            onChange(event.target.value)
          }
        >
          {children}
        </select>
        <span
          aria-hidden="true"
          className="select-marquee"
          ref={viewportRef}
        >
          <span className="select-marquee__track" style={marqueeStyle}>
            <span ref={textRef}>{valueLabel}</span>
          </span>
        </span>
      </span>
    </label>
  );
};
