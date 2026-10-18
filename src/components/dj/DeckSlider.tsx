import { useState } from "react";
import { ChevronDown, Music2, Volume2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { Deck } from "@/lib/dj/engine";
import { useDeck } from "@/lib/dj/useMixer";
import { Fader } from "./Fader";

/** Landscape can switch modes; portrait keeps pitch permanently visible. */
export function DeckSlider({ deck, height = 120, pitchOnly = false }: { deck: Deck; height?: number; pitchOnly?: boolean }) {
  useDeck(deck);
  const [mode, setMode] = useState<"pitch" | "volume">("pitch");
  const [open, setOpen] = useState(false);
  return <div className="flex shrink-0 flex-col items-center gap-1">
    {pitchOnly ? <Button variant="ghost" className="h-7 px-1 text-[10px] tabular-nums" aria-label={`Reset pitch deck ${deck.id}`} onClick={() => deck.setPitch(0)}>{deck.pitch > 0 ? "+" : ""}{deck.pitch.toFixed(1)}%</Button> : <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild><Button variant="ghost" className="h-7 gap-0.5 px-1 text-[10px]" aria-label={`Slider mode deck ${deck.id}`}><span>{mode === "pitch" ? "Pitch" : "Volume"}</span><ChevronDown className="size-3" /></Button></PopoverTrigger>
      <PopoverContent className="reference-menu w-36 p-1" side="top">
        {(["pitch", "volume"] as const).map(m => <Button key={m} variant="ghost" className="h-9 w-full justify-start" aria-pressed={mode === m} onClick={() => { setMode(m); setOpen(false); }}>{m === "pitch" ? <Music2 /> : <Volume2 />}{m === "pitch" ? "Pitch" : "Volume"}</Button>)}
      </PopoverContent>
    </Popover>}
    <Fader marks={false} label={`${mode === "pitch" ? "Pitch" : "Volume"} deck ${deck.id}`} height={height} value={mode === "pitch" ? 1 - (deck.pitch + 25) / 50 : deck.volume} onChange={v => mode === "pitch" ? deck.setPitch((1 - v) * 50 - 25) : deck.setVolume(v)} />
  </div>;
}