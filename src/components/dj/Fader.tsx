import { useCallback, useRef } from "react";

interface FaderProps {
  value: number; // 0..1
  onChange: (v: number) => void;
  orientation?: "v" | "h";
  height?: number;
  width?: number;
  marks?: boolean;
  knobColor?: string;
  label?: string;
}

// Hardware-style fader: recessed dark channel with tick marks and a tall
// rounded frosted cap carrying a single centre line (reference images).
export function Fader({
  value,
  onChange,
  orientation = "v",
  height = 160,
  width = 30,
  marks = true,
  knobColor = "var(--switch-thumb)",
  label = "Fader",
}: FaderProps) {
  const ref = useRef<HTMLDivElement>(null);
  const isV = orientation === "v";

  const update = useCallback(
    (clientX: number, clientY: number) => {
      const el = ref.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const p = isV ? 1 - (clientY - r.top) / r.height : (clientX - r.left) / r.width;
      onChange(Math.max(0, Math.min(1, p)));
    },
    [isV, onChange],
  );

  const onPointerDown = (e: React.PointerEvent) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    update(e.clientX, e.clientY);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!e.currentTarget.hasPointerCapture(e.pointerId)) return;
    update(e.clientX, e.clientY);
  };

  const railStyle: React.CSSProperties = {
    width: isV ? 9 : width,
    height: isV ? height : 9,
    borderRadius: 6,
    background: "var(--fader-line)",
    border: "1px solid var(--glass-border)",
    boxShadow: "var(--glass-shadow)",
    backdropFilter: "blur(14px)",
  };

  const capW = isV ? 30 : 22;
  const capH = isV ? 13 : 40;
  const travel = isV ? height - capH : width - capW;
  const pos = (isV ? 1 - value : value) * travel;

  return (
    <div
      ref={ref}
      role="slider" tabIndex={0} aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(value * 100)}
      className="relative flex items-center justify-center select-none"
      style={{ width: isV ? Math.max(width, capW) : width, height: isV ? height : capH, touchAction: "none" }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onKeyDown={e => { if (["ArrowUp", "ArrowRight", "ArrowDown", "ArrowLeft", "Home", "End"].includes(e.key)) { e.preventDefault(); onChange(e.key === "Home" ? 0 : e.key === "End" ? 1 : Math.max(0, Math.min(1, value + (["ArrowUp", "ArrowRight"].includes(e.key) ? 0.02 : -0.02)))); } }}
    >
      {marks && (
        <div
          className={`absolute pointer-events-none ${isV ? "inset-y-1 left-0 flex flex-col justify-between" : "inset-x-1 top-0 flex justify-between"}`}
          style={isV ? { left: -2 } : { top: -2 }}
        >
          {Array.from({ length: 11 }).map((_, i) => (
            <div
              key={i}
              style={{
                width: isV ? (i % 5 === 0 ? 7 : 4) : 1,
                height: isV ? 1 : i % 5 === 0 ? 7 : 4,
                background: "var(--muted-foreground)",
              }}
            />
          ))}
        </div>
      )}
      <div style={railStyle} />
      <div
        className="absolute grid place-items-center backdrop-blur-2xl"
        style={{
          width: capW,
          height: capH,
          left: isV ? "50%" : pos,
          top: isV ? pos : "50%",
          transform: isV ? "translateX(-50%)" : "translateY(-50%)",
          borderRadius: 11,
          background: "var(--fader-cap-fill)",
          border: "1px solid var(--glass-border)",
          boxShadow: "var(--glass-shadow)",
        }}
      >
        <div
          style={{
            width: isV ? capW * 0.6 : 3,
            height: isV ? 3 : capH * 0.6,
            borderRadius: 2,
            background: "var(--switch-thumb)",
            opacity: 0.92,
          }}
        />
      </div>
    </div>
  );
}
