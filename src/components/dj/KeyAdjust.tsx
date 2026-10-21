import { useState } from "react";
import { ChevronDown, Minus, Plus } from "lucide-react";
import { Deck } from "@/lib/dj/engine";
import { getMixer } from "@/lib/dj/useMixer";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

const semitones = (pitchPercent: number) => 12 * Math.log2(1 + pitchPercent / 100);
const percentFor = (semitones: number) => (Math.pow(2, semitones / 12) - 1) * 100;

/** Serato-style Key Adjust popup: shift the track's key in semitones and Key Sync to the other deck. */
export function KeyAdjust({ deck, accent, side }: { deck: Deck; accent: string; side: "left" | "right" }) {
  const [open, setOpen] = useState(false);
  const offset = Math.round(semitones(deck.pitch));

  const shift = (delta: number) => {
    const next = Math.max(-5, Math.min(5, offset + delta));
    deck.setPitch(percentFor(next));
  };

  const keySync = () => {
    const mixer = getMixer();
    if (!mixer) return;
    const pair = mixer.activeDecks();
    const other = side === "left" ? pair.right : pair.left;
    // Nearest harmonic shift (max ±2 semitones, so tempo stays close) that
    // aligns this deck's key with the other deck's current key.
    let diff = Math.round(semitones(other.pitch) - semitones(deck.pitch));
    diff = ((diff % 12) + 12) % 12;
    if (diff > 6) diff -= 12;
    deck.setPitch(percentFor(offset + Math.max(-2, Math.min(2, diff))));
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" className="dj-glass h-7 gap-0.5 rounded-full px-1.5 text-[10px] font-bold tabular-nums" aria-label={`Key adjust deck ${deck.id}`}>
          <span style={{ color: accent }}>KEY</span>
          <span>{offset > 0 ? `+${offset}` : offset}</span>
          <ChevronDown className="size-3 text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent side="bottom" align="center" className="w-64 rounded-3xl p-4" style={{ background: "var(--popover)", border: "1px solid var(--glass-border)", backdropFilter: "blur(24px)" }}>
        <div className="mb-3 text-center text-sm font-semibold text-muted-foreground">Key Adjust</div>
        <div className="flex items-center justify-between">
          <button aria-label="Key down one semitone" className="grid size-14 place-items-center rounded-full" style={{ background: "var(--glass)", border: "1px solid var(--glass-border)" }} onClick={() => shift(-1)}>
            <Minus className="size-6" />
          </button>
          <div className="text-center">
            <div className="text-2xl font-bold tabular-nums" style={{ color: "#f0c23a" }}>{offset > 0 ? `+${offset}` : offset}</div>
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground">semitone{Math.abs(offset) === 1 ? "" : "s"}</div>
          </div>
          <button aria-label="Key up one semitone" className="grid size-14 place-items-center rounded-full" style={{ background: "var(--glass)", border: "1px solid var(--glass-border)" }} onClick={() => shift(1)}>
            <Plus className="size-6" />
          </button>
        </div>
        <Button onClick={keySync} className="mt-4 h-12 w-full rounded-full text-base" style={{ background: "var(--glass)", border: "1px solid var(--glass-border)", boxShadow: "var(--glass-shadow)" }}>
          Key Sync
        </Button>
      </PopoverContent>
    </Popover>
  );
}
