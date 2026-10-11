import { useRef, useState } from "react";
import { Deck } from "@/lib/dj/engine";
import { useDeck } from "@/lib/dj/useMixer";
import { Grid2x2, X, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

const CUE_COLORS = ["#ff3b3b", "#ffcf3b", "#3bff8a", "#3bd2ff", "#a83bff", "#ff3bd2", "#ffffff", "#ff7a3b"];
const LOOP_LENGTHS = ["1/32", "1/16", "1/8", "1/4", "1/2", "1", "2", "4", "8", "16", "32"];
const LOOP_BEATS = [1 / 32, 1 / 16, 1 / 8, 1 / 4, 1 / 2, 1, 2, 4, 8, 16, 32];

/** Compact frosted side drawer with hot cues + loop sizes (djay-style pads). */
export function HotCuePanel({
  deck,
  accent,
  side = "left",
  inline = false,
}: {
  inline?: boolean;
  deck: Deck;
  accent: string;
  side?: "left" | "right";
}) {
  useDeck(deck);
  const [open, setOpen] = useState(false);
  const [loopIdx, setLoopIdx] = useState(7);
  const [mode, setMode] = useState<"Cue" | "Pitch Cue" | "Skip">("Cue");
  const hasAny = deck.hotCues.some(Boolean);

  return (
    <>
      {!inline && <button
        onClick={() => setOpen((o) => !o)}
        className={`w-9 h-9 rounded-full flex items-center justify-center ${open ? "dj-glass-on" : "dj-glass"}`}
        style={{ boxShadow: hasAny ? `0 0 10px ${accent}66, var(--glass-shadow)` : undefined }}
        title="Hot cues & loops"
      >
        <Grid2x2 className="w-4 h-4" style={{ color: hasAny ? accent : "var(--muted-foreground)" }} />
      </button>}

      {(inline || open) && (
        <div
          className={inline ? "p-2 overflow-y-auto" : `hotcue-drawer fixed top-[52px] bottom-[52px] z-[62] p-2.5 overflow-y-auto dj-panel rounded-lg ${
            side === "left" ? "left-1.5" : "right-1.5"
          }`}
        >

          <div className="flex items-center justify-between mb-2">
            <h2 className="text-[11px] uppercase tracking-widest" style={{ color: accent }}>
              Deck {deck.id} Cues
            </h2>
            {!inline && <button onClick={() => setOpen(false)} className="text-muted-foreground">
              <X className="w-4 h-4" />
            </button>}
          </div>

          <div className="mb-2 grid grid-cols-3 gap-0.5 rounded-lg bg-secondary p-0.5 text-xs">{(["Cue", "Pitch Cue", "Skip"] as const).map(t => <button key={t} aria-pressed={mode === t} onClick={() => setMode(t)} className={`h-7 rounded-md ${mode === t ? "bg-background text-primary" : "text-muted-foreground"}`}>{t}</button>)}</div>
          {mode === "Cue" && <div className="grid grid-cols-4 gap-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <HotCuePad key={i} deck={deck} index={i} color={CUE_COLORS[i]} hasCue={!!deck.hotCues[i]} />
            ))}
          </div>}
          {mode === "Pitch Cue" && <div className="grid grid-cols-4 gap-2">{[0, 1, 2, 3, -4, -3, -2, -1].map(st => <Button key={st} variant="ghost" data-tone={0} className="cue-pad h-12 justify-start gap-1 text-sm font-bold" aria-label={`Pitch cue ${st} semitones`} onClick={() => { if (!deck.hotCues[0]) deck.setHotCue(0); deck.triggerPitchCue(0, (Math.pow(2, st / 12) - 1) * 100); }}><span className="text-destructive">▶</span>{st > 0 ? `+${st}` : st}</Button>)}</div>}
          {mode === "Skip" && <div className="grid grid-cols-4 gap-2">{[-1, -2, -4, -8, 1, 2, 4, 8].map(b => <Button key={b} variant="ghost" data-tone={3} className="cue-pad h-12 text-sm font-bold" aria-label={`Skip ${b} beats`} onClick={() => deck.skipBeats(b)}>{b > 0 ? `+${b}` : b}</Button>)}</div>}

          <div className="mt-3 text-[9px] uppercase tracking-widest text-muted-foreground mb-1">Loop</div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => {
                const n = Math.max(0, loopIdx - 1);
                setLoopIdx(n);
                if (deck.loopActive) deck.setLoopBeats(LOOP_BEATS[n]);
              }}
              className="w-7 h-7 grid place-items-center rounded-full dj-glass"
              aria-label="Halve loop"
            >
              <ChevronLeft className="w-3 h-3" />
            </button>
            <button
              onClick={() => deck.toggleLoop(LOOP_BEATS[loopIdx])}
              className={`flex-1 h-7 rounded-full text-[10px] font-bold tabular-nums ${
                deck.loopActive ? "dj-glass-on" : "dj-glass"
              }`}
              style={{ color: deck.loopActive ? "#3bff8a" : accent }}
            >
              ↻ {LOOP_LENGTHS[loopIdx]}
            </button>
            <button
              onClick={() => {
                const n = Math.min(LOOP_LENGTHS.length - 1, loopIdx + 1);
                setLoopIdx(n);
                if (deck.loopActive) deck.setLoopBeats(LOOP_BEATS[n]);
              }}
              className="w-7 h-7 grid place-items-center rounded-full dj-glass"
              aria-label="Double loop"
            >
              <ChevronRight className="w-3 h-3" />
            </button>
          </div>
          <div className="mt-2 text-[8px] text-muted-foreground leading-tight">
            Tap empty pad to set · hold to play momentary · long-press (right-click) to clear.
          </div>
        </div>
      )}
    </>
  );
}

function HotCuePad({ deck, index, color, hasCue }: { deck: Deck; index: number; color: string; hasCue: boolean }) {
  const heldRef = useRef<{ wasPlaying: boolean; t: number } | null>(null);
  return (
    <Button variant="ghost"
      aria-label={`Hot cue ${String.fromCharCode(65 + index)}`}
      data-tone={index}
      data-active={hasCue}
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        if (!hasCue) {
          deck.setHotCue(index);
          return;
        }
        heldRef.current = { wasPlaying: deck.playing, t: performance.now() };
        const cue = deck.hotCues[index];
        if (!cue) return;
        deck.seek(cue.time);
        deck.play();
      }}
      onPointerUp={() => {
        const h = heldRef.current;
        heldRef.current = null;
        if (!h) return;
        if (performance.now() - h.t > 200) {
          const cue = deck.hotCues[index];
          if (cue) deck.seek(cue.time);
          if (!h.wasPlaying) deck.pause();
        }
      }}
      onPointerCancel={() => (heldRef.current = null)}
      onContextMenu={(e) => {
        e.preventDefault();
        deck.clearHotCue(index);
      }}
      className="cue-pad aspect-square h-auto min-h-12 flex-col justify-between p-2 text-[10px] font-bold"
    >
      <span className="self-start">{String.fromCharCode(65 + index)}</span>
      <span className="cue-marker">{hasCue ? `${Math.floor((deck.hotCues[index]?.time ?? 0) / 60)}:${Math.floor((deck.hotCues[index]?.time ?? 0) % 60).toString().padStart(2, "0")}` : "+"}</span>
    </Button>
  );
}
