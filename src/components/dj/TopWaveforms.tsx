import type { Deck } from "@/lib/dj/engine";
import { HorizontalWaveform } from "./HorizontalWaveform";

export function TopWaveforms({ decks }: { decks: Deck[] }) {
  return <div aria-label="Top scratch waveforms" className="grid h-24 shrink-0 grid-rows-2 border-b border-border">
    {decks.slice(0, 2).map((deck, index) => <div key={deck.id} className="min-h-0 border-b border-border last:border-0"><HorizontalWaveform deck={deck} index={index === 0 ? 1 : 2} color={index === 0 ? "var(--accent-orange)" : "var(--accent-blue)"} /></div>)}
  </div>;
}