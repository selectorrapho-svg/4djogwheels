import { ChevronDown, Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Deck } from "@/lib/dj/engine";
import { useDeck } from "@/lib/dj/useMixer";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

/** Compact djay-style tempo: BPM, % offset (tap to reset), slider, fine -/+. */
export function PitchMenu({ deck }: { deck: Deck }) {
  useDeck(deck);
  const bpm = deck.bpm ? deck.bpm * (1 + deck.pitch / 100) : 0;
  return <Popover>
    <PopoverTrigger asChild><Button variant="ghost" size="icon" className="size-6 p-0" title={`Pitch deck ${deck.id}`} aria-label={`Pitch deck ${deck.id}`}><ChevronDown className="size-3" /></Button></PopoverTrigger>
    <PopoverContent side="top" className="w-32 rounded-xl p-2 reference-menu">
      <div className="mt-2 text-center text-lg tabular-nums">{bpm ? bpm.toFixed(1) : "--"}</div>
      <button aria-label={`Reset pitch deck ${deck.id}`} onClick={() => deck.setPitch(0)} className="block w-full text-center text-xs tabular-nums text-muted-foreground">{deck.pitch > 0 ? "+" : ""}{deck.pitch.toFixed(1)}%</button>
      <div className="flex h-36 justify-center py-2"><input aria-label={`Pitch slider deck ${deck.id}`} type="range" min={-50} max={100} step={0.01} value={deck.pitch} onChange={e => deck.setPitch(Number(e.target.value))} className="reference-stem-slider" /></div>
      <div className="flex justify-around"><Button variant="ghost" size="icon" className="size-8" aria-label="Pitch down" onClick={() => deck.setPitch(deck.pitch - 0.1)}><Minus /></Button><Button variant="ghost" size="icon" className="size-8" aria-label="Pitch up" onClick={() => deck.setPitch(deck.pitch + 0.1)}><Plus /></Button></div>
    </PopoverContent>
  </Popover>;
}
