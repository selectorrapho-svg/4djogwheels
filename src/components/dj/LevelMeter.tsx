import { useEffect, useRef } from "react";
import { Deck } from "@/lib/dj/engine";

const SEGMENTS = 28;

/** Segmented VU meter: grey cells light from the bottom, white peak mark. */
export function LevelMeter({ deck, label }: { deck: Deck; label: string }) {
  const box = useRef<HTMLDivElement>(null);
  const peak = useRef([0, 0]);
  useEffect(() => {
    let raf = 0;
    const last = [-1, -1];
    const update = () => {
      const levels = deck.getStereoLevels();
      for (let channel = 0; channel < 2; channel++) {
        peak.current[channel] = Math.max(levels[channel], peak.current[channel] * 0.94);
        const lit = Math.round(Math.min(1, peak.current[channel]) * SEGMENTS);
        if (lit === last[channel] || !box.current) continue;
        last[channel] = lit;
        const cells = box.current.children[channel].children;
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
      <div ref={box} className="vu-stereo" aria-label={`${label} left and right channels`}>
        {[0, 1].map(channel => <div key={channel} className="vu-meter">
          {Array.from({ length: SEGMENTS }).map((_, i) => <span key={i} data-on="0" />)}
        </div>)}
      </div>
    </div>
  );
}
