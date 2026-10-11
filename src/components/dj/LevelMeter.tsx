import { useEffect, useRef } from "react";
import { Deck } from "@/lib/dj/engine";

const SEGMENTS = 14;

/** Segmented VU meter: grey cells light from the bottom, white peak mark. */
export function LevelMeter({ deck, label }: { deck: Deck; label: string }) {
  const box = useRef<HTMLDivElement>(null);
  const peak = useRef(0);
  useEffect(() => {
    let raf = 0;
    let last = -1;
    const update = () => {
      const level = deck.getLevel();
      peak.current = Math.max(level, peak.current * 0.94);
      const lit = Math.round(Math.min(1, peak.current) * SEGMENTS);
      if (lit !== last && box.current) {
        last = lit;
        const cells = box.current.children;
        for (let i = 0; i < cells.length; i++) {
          const idx = SEGMENTS - 1 - i; // top cell first in DOM
          (cells[i] as HTMLElement).dataset.on = idx < lit ? (idx >= SEGMENTS - 2 ? "hot" : idx === lit - 1 ? "peak" : "1") : "0";
        }
      }
      raf = requestAnimationFrame(update);
    };
    raf = requestAnimationFrame(update);
    return () => cancelAnimationFrame(raf);
  }, [deck]);
  return (
    <div className="flex h-full min-h-20 flex-col items-center gap-1" aria-label={`${label} level meter`}>
      <div ref={box} className="vu-meter">
        {Array.from({ length: SEGMENTS }).map((_, i) => <span key={i} data-on="0" />)}
      </div>
      <span className="text-[8px] font-bold text-muted-foreground">{label}</span>
    </div>
  );
}
