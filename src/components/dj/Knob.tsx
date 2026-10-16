import { useCallback, useRef } from "react";

interface KnobProps {
  value: number; // 0..1 or min..max
  min?: number;
  max?: number;
  size?: number;
  label?: string;
  onChange: (v: number) => void;
  onDoubleClick?: () => void;
  color?: string;
  showTicks?: boolean;
  compact?: boolean;
}

// Metallic mixer knob: brushed cap, ring of ticks, coloured value arc.
export function Knob({
  value,
  min = 0,
  max = 1,
  size = 44,
  label,
  onChange,
  onDoubleClick,
  color = "var(--knob-accent)",
  showTicks = true,
  compact = false,
}: KnobProps) {
  const startY = useRef(0);
  const startV = useRef(0);
  const range = max - min;
  const norm = Math.max(0, Math.min(1, (value - min) / range));
  const angle = -135 + norm * 270;

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      startY.current = e.clientY;
      startV.current = value;
    },
    [value],
  );
  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!(e.buttons & 1)) return;
      const dy = startY.current - e.clientY;
      const next = Math.max(min, Math.min(max, startV.current + (dy / 140) * range));
      onChange(next);
    },
    [min, max, range, onChange],
  );

  const r = size / 2;

  return (
    <div className={`flex flex-col items-center select-none ${compact ? "mixer-knob gap-0" : "gap-1"}`}>
      <div className="relative" style={{ width: size, height: size }}>
        {/* tick ring */}
        {showTicks && <svg width={size} height={size} className="absolute inset-0 pointer-events-none">
          {Array.from({ length: 11 }).map((_, i) => {
            const a = (-135 + (i / 10) * 270) * (Math.PI / 180);
            const x1 = r + Math.sin(a) * (r - 1.5);
            const y1 = r - Math.cos(a) * (r - 1.5);
            const x2 = r + Math.sin(a) * (r - 4.5);
            const y2 = r - Math.cos(a) * (r - 4.5);
            const on = i / 10 <= norm;
            return (
              <line
                key={i}
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke={on ? color : "var(--border)"}
                strokeWidth={1.4}
                strokeLinecap="round"
              />
            );
          })}
        </svg>}
        {/* blue value arc around the outer ring — starts at centre for bipolar knobs */}
        <svg width={size} height={size} className="absolute inset-0 pointer-events-none" aria-hidden>
          {(() => {
            const rr = r - 3;
            const pt = (deg: number) => {
              const a = (deg * Math.PI) / 180;
              return `${r + Math.sin(a) * rr} ${r - Math.cos(a) * rr}`;
            };
            const bipolar = min < 0 && max > 0;
            const from = bipolar ? -135 + ((0 - min) / range) * 270 : -135;
            const a0 = Math.min(from, angle), a1 = Math.max(from, angle);
            return (
              <>
                <path d={`M ${pt(-135)} A ${rr} ${rr} 0 1 1 ${pt(135)}`} fill="none" stroke="var(--knob-ring)" strokeWidth={compact ? 5 : 3} strokeLinecap="butt" />
                {a1 - a0 > 0.5 && <path d={`M ${pt(a0)} A ${rr} ${rr} 0 ${a1 - a0 > 180 ? 1 : 0} 1 ${pt(a1)}`} fill="none" stroke="var(--control-blue)" strokeWidth={compact ? 5 : 3} strokeLinecap="butt" />}
              </>
            );
          })()}
        </svg>
        {/* cap */}
        <div
          className="absolute rounded-full"
          style={{
            inset: compact ? 8 : 6,
            background: "radial-gradient(circle at 50% 35%, var(--secondary), var(--background) 78%)",
            border: "1px solid var(--knob-ring)",
            boxShadow: "inset 0 1px 0 color-mix(in oklab, var(--foreground) 18%, transparent), 0 3px 8px color-mix(in oklab, var(--background) 80%, transparent)",
            touchAction: "none",
          }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onDoubleClick={() => { if (onDoubleClick) onDoubleClick(); else onChange(min < 0 && max > 0 ? 0 : min + range / 2); }}
        >
          <div
            className="absolute left-1/2"
            style={{
              width: 2.5,
              height: (size - 12) * 0.42,
              marginLeft: -1.25,
              top: 3,
              background: "var(--foreground)",
              borderRadius: 2,
              transformOrigin: `50% ${(size - 12) / 2 - 3}px`,
              transform: `rotate(${angle}deg)`,
              
            }}
          />
        </div>
      </div>
      {label && <span className="text-[9px] leading-3 text-muted-foreground uppercase">{label}</span>}
    </div>
  );
}
