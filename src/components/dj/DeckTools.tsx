import { useState } from "react";
import { ChevronRight, Power, Sliders } from "lucide-react";
import { Deck, FX_LIBRARY, FxKey } from "@/lib/dj/engine";
import { useDeck } from "@/lib/dj/useMixer";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { EffectBrowser } from "./EffectBrowser";
import { Knob } from "./Knob";

const fxLabel = (key: FxKey) => FX_LIBRARY.find(p => p.key === key)?.label ?? String(key).replace(/_/g, " ");

/**
 * One FX entry point per deck (Serato-style popup): effect dropdown, ON button
 * and two knobs — effect depth and beat length. Hot cues, sampler and Scratch
 * DNA pads were removed from the deck tools.
 */
export function DeckTools({ deck, accent, side }: { deck: Deck; accent: string; side: "left" | "right" }) {
  useDeck(deck);
  const [open, setOpen] = useState(false);
  const [browse, setBrowse] = useState(false);
  const [fx, setFx] = useState<FxKey>("echo_1_2");
  const [on, setOn] = useState(false);
  const [depth, setDepth] = useState(0.6);
  const beats = deck.fxBeatOverrides[fx] ?? FX_LIBRARY.find(p => p.key === fx)?.params?.beats ?? 1;

  const toggle = () => {
    const next = !on;
    setOn(next);
    if (next) deck.setFx(fx, depth);
    else deck.setFx(null);
  };
  const pick = (key: FxKey) => {
    setFx(key);
    if (on) deck.setFx(key, depth);
  };

  return <>
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" aria-label={`Deck ${deck.id} FX`} title="FX" className={`grid size-9 place-items-center rounded-full ${open ? "dj-glass-on" : "dj-glass"}`} style={{ boxShadow: deck.activeFx ? `0 0 10px ${accent}` : undefined }}>
          <Sliders className="size-4" style={{ color: deck.activeFx ? accent : "var(--muted-foreground)" }} />
        </Button>
      </PopoverTrigger>
      <PopoverContent side={side === "left" ? "right" : "left"} align="center" className="w-60 rounded-3xl p-3" style={{ background: "var(--popover)", border: "1px solid var(--glass-border)", backdropFilter: "blur(24px)" }}>
        <button onClick={() => setBrowse(true)} className="flex h-11 w-full items-center justify-between rounded-2xl px-3 text-sm font-semibold uppercase tracking-wide" style={{ background: "var(--glass)", border: "1px solid var(--glass-border)" }}>
          <span className="min-w-0 truncate">{fxLabel(fx)}</span><ChevronRight className="size-4 shrink-0 text-muted-foreground" />
        </button>
        <div className="mt-3 flex items-center justify-around">
          <button
            aria-label="FX on/off"
            aria-pressed={on}
            onClick={toggle}
            className={`grid size-14 place-items-center rounded-2xl text-sm font-bold ${on ? "dj-glass-on" : "dj-glass"}`}
            style={on ? { color: "var(--control-blue)", boxShadow: "0 0 14px color-mix(in oklab, var(--control-blue) 50%, transparent)" } : undefined}
          >
            <Power className="size-5" />
          </button>
          <Knob value={depth} size={54} label="DEPTH" color={accent} showTicks={false} onChange={(v) => { setDepth(v); if (on) deck.setFxAmount(v); }} />
          <Knob value={beats} min={0.25} max={4} size={54} label="BEAT" color={accent} showTicks={false} onChange={(v) => deck.setFxBeats(fx, v)} />
        </div>
      </PopoverContent>
    </Popover>
    {browse && <EffectBrowser deckId={deck.id} selected={fx} onAudio={pick} onVisual={() => { /* visual FX handled in video mode */ }} onClose={() => setBrowse(false)} />}
  </>;
}
