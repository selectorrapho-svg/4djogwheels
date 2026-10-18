import { useState } from "react";
import { Grid2x2, Music4, Sliders, X, Zap } from "lucide-react";
import { Deck } from "@/lib/dj/engine";
import { getMixer } from "@/lib/dj/useMixer";
import { DeckFxPanel } from "./DeckFxPanel";
import { SamplerPanel } from "./SamplerPanel";
import { HotCuePanel } from "./HotCuePanel";
import { DeckDrawer } from "./DeckDrawer";
import { Button } from "@/components/ui/button";

/** One performance-tools entry point per deck, instead of three adjacent buttons. */
export function DeckTools({ deck, accent, side }: { deck: Deck; accent: string; side: "left" | "right" }) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"FX" | "Samples" | "Hot Cues">("FX");
  return <>
    <Button variant="ghost" aria-label={`Deck ${deck.id} tools`} title="FX, samples and hot cues" onClick={() => { setTab("FX"); setOpen((value) => !value); }} className={`grid size-9 place-items-center rounded-full ${open ? "dj-glass-on" : "dj-glass"}`}>
      <Sliders className="size-4" />
    </Button>
    {open && <DeckDrawer deckId={deck.id} side={side} reachTop label={`Deck ${deck.id} tools`} className="fx-drawer">
      <div className="flex items-center gap-1 border-b border-border px-2 py-1">
        {([["FX", Zap], ["Samples", Music4], ["Hot Cues", Grid2x2]] as const).map(([t, Icon]) => <Button key={t} variant="ghost" className="h-8 min-w-0 flex-1 px-1" aria-label={t} title={t} aria-pressed={tab === t} onClick={() => setTab(t)}><Icon className={`size-4 ${tab === t ? "text-primary" : "text-muted-foreground"}`} /></Button>)}
        <Button variant="ghost" size="icon" className="size-7 shrink-0" aria-label="Close tools" onClick={() => setOpen(false)}><X className="size-4" /></Button>
      </div>
      {tab === "FX" && <DeckFxPanel deck={deck} accent={accent} side={side} compact inline />}
      {tab === "Samples" && <div className="min-h-0 overflow-y-auto p-2"><SamplerPanel mixer={getMixer()} side={side} inline /></div>}
      {tab === "Hot Cues" && <HotCuePanel deck={deck} accent={accent} side={side} inline />}
    </DeckDrawer>}
  </>;
}