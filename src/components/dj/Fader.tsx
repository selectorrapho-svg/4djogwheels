import { useCallback, useRef } from "react";

interface FaderProps {
  value: number; // 0..1
  onChange: (v: number) => void;
  orientation?: "v" | "h";
  height?: number;
  width?: number;
  marks?: boolean;
  knobColor?: string;
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
  knobColor = "#ffffff",
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
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    update(e.clientX, e.clientY);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!(e.buttons & 1)) return;
    update(e.clientX, e.clientY);
  };

  const railStyle: React.CSSProperties = {
    width: isV ? 9 : width,
    height: isV ? height : 9,
    borderRadius: 6,
    background: "rgba(255,255,255,0.08)",
    border: "1px solid rgba(255,255,255,0.14)",
    boxShadow: "inset 0 1px 4px rgba(0,0,0,0.75), 0 1px 0 rgba(255,255,255,0.07)",
    backdropFilter: "blur(14px)",
  };

  const capW = isV ? 30 : 22;
  const capH = isV ? 22 : 40;
  const travel = isV ? height - capH : width - capW;
  const pos = (isV ? 1 - value : value) * travel;

  return (
    <div
      ref={ref}
      className="relative flex items-center justify-center select-none"
      style={{ width: isV ? Math.max(width, capW) : width, height: isV ? height : capH, touchAction: "none" }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
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
                background: "rgba(255,255,255,0.28)",
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
          background: "rgba(255,255,255,0.15)",
          border: "1px solid rgba(255,255,255,0.26)",
          boxShadow:
            "0 6px 18px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.45), inset 0 -1px 0 rgba(0,0,0,0.35)",
        }}
      >
        <div
          style={{
            width: isV ? capW * 0.6 : 3,
            height: isV ? 3 : capH * 0.6,
            borderRadius: 2,
            background: knobColor,
            opacity: 0.92,
            boxShadow: `0 0 6px ${knobColor}80`,
          }}
        />
      </div>
    </div>
  );
}
