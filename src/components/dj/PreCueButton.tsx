import { Headphones } from "lucide-react";
import type { Deck } from "@/lib/dj/engine";
import { useDeck } from "@/lib/dj/useMixer";

/** Headphone pre-cue (PFL) toggle — hear the deck before it goes to the crowd. */
export function PreCueButton({ deck, size = 28 }: { deck: Deck; size?: number }) {
  useDeck(deck);
  return <button
    aria-label={`Pre-cue deck ${deck.id} in headphones`}
    aria-pressed={deck.cueOn}
    title="Pre-cue (headphones)"
    onClick={() => deck.toggleCue()}
    style={{ width: size, height: size }}
    className={`grid shrink-0 place-items-center rounded-full border ${deck.cueOn ? "border-primary bg-primary text-primary-foreground" : "border-border bg-secondary text-muted-foreground"}`}
  ><Headphones className="size-3.5" /></button>;
}
