import { useState } from "react";
import { Deck } from "@/lib/dj/engine";
import { useDeck } from "@/lib/dj/useMixer";
import { Button } from "@/components/ui/button";
import { LockKeyhole } from "lucide-react";

// Cue point editor (djay-style): tab row on top, then a pad table where each
// saved cue shows its timestamp with a coloured triangle marker underneath.
// Empty slots show a "+" — tapping sets a cue at the current position.
// "Pitch Cue" replays a saved cue at a fixed pitch offset; "Skip" jumps whole
// beats on the beat grid.
const CUE_COLORS = ["#ff3b3b", "#ff8a3b", "#3bd2ff", "#3bff8a", "#c04dff", "#ff4dd2", "#ffd23b", "#ffffff"];
const PITCHES = [-4, -2, -1, 0, 1, 2, 4, 8];
const SKIPS = [-32, -16, -8, -4, 4, 8, 16, 32];
const TABS = ["Cue", "Pitch Cue", "Skip"] as const;

export function CuePointGrid({ deck }: { deck: Deck }) {
  useDeck(deck);
  const [tab, setTab] = useState<(typeof TABS)[number]>("Cue");

  const fmt = (t: number) =>
    `${Math.floor(t / 60).toString().padStart(2, "0")}:${Math.floor(t % 60).toString().padStart(2, "0")}`;

  const padLabel = (i: number) =>
    tab === "Pitch Cue" ? `${PITCHES[i] > 0 ? "+" : ""}${PITCHES[i]}%` : tab === "Skip" ? `${SKIPS[i] > 0 ? "+" : ""}${SKIPS[i]}` : fmt(deck.hotCues[i]?.time ?? 0);

  const fire = (i: number) => {
    const cue = deck.hotCues[i];
    if (tab === "Cue") {
      if (cue) { deck.seek(cue.time); deck.play(); }
      else deck.setHotCue(i);
    } else if (tab === "Pitch Cue") {
      deck.triggerPitchCue(i, PITCHES[i]);
    } else {
      deck.skipBeats(SKIPS[i]);
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex shrink-0 items-center gap-1 border-b border-border px-2 py-1">
        {TABS.map((t) => (
           <Button variant="ghost"
            key={t}
            onClick={() => setTab(t)}
             className={`h-6 px-1.5 py-0.5 text-[10px] font-semibold ${
              tab === t
                ? "bg-primary/20 text-primary ring-1 ring-primary/60"
                : "text-muted-foreground"
            }`}
          >
            {t}
           </Button>
        ))}
        <Button variant="ghost" size="icon" className="size-6 shrink-0" aria-label={`Key lock deck ${deck.id}`} aria-pressed={deck.keyLock} disabled={!deck.keyLockReady} title={deck.keyLockReady ? "Key lock" : "Key lock requires browser audio; native support is not available"} onClick={() => deck.setKeyLock(!deck.keyLock)}><LockKeyhole className={`size-3 ${deck.keyLock ? "text-foreground" : "text-muted-foreground"}`} /></Button>
      </div>

      <div className="grid flex-1 min-h-0 grid-cols-4 content-start gap-1.5 overflow-auto p-2">
        {Array.from({ length: 8 }).map((_, i) => {
          const cue = deck.hotCues[i];
          const color = CUE_COLORS[i % CUE_COLORS.length];
          const empty = !cue && (tab === "Cue" || tab === "Pitch Cue");
          if (empty) {
            return (
              <button
                key={i}
                onClick={() => fire(i)}
                onContextMenu={(e) => e.preventDefault()}
                className="grid aspect-[5/4] place-items-center rounded-md border border-border bg-secondary/40 text-lg text-muted-foreground"
                title="Set cue at current position"
              >
                +
              </button>
            );
          }
          if (tab === "Pitch Cue" && !cue) {
            return (
              <span key={i} className="grid aspect-[5/4] place-items-center rounded-md border border-border/50 bg-secondary/20 text-[10px] text-muted-foreground">
                —
              </span>
            );
          }
          return (
            <button
              key={i}
              onClick={() => fire(i)}
              onContextMenu={(e) => {
                e.preventDefault();
                if (cue) deck.clearHotCue(i);
              }}
              className="flex aspect-[5/4] flex-col items-center justify-center gap-1 rounded-md"
              style={{
                background: `${color}22`,
                border: `1px solid ${color}66`,
                boxShadow: `0 0 8px ${color}33`,
              }}
              title={
                tab === "Cue" ? `Seek to ${fmt(cue?.time ?? 0)} — right-click to clear`
                : tab === "Pitch Cue" ? `Play cue at ${PITCHES[i] > 0 ? "+" : ""}${PITCHES[i]}% pitch`
                : `Jump ${SKIPS[i] > 0 ? "forward" : "back"} ${Math.abs(SKIPS[i])} beats`
              }
            >
              <span className="text-[10px] font-semibold tabular-nums">{padLabel(i)}</span>
              {tab === "Cue" && (
                <span
                  style={{
                    width: 10,
                    height: 10,
                    background: color,
                    clipPath: "polygon(0 0, 100% 50%, 0 100%)",
                  }}
                />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
