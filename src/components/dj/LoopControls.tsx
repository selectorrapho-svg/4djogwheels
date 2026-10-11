import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Deck } from "@/lib/dj/engine";
import { useDeck } from "@/lib/dj/useMixer";

export function LoopControls({ deck }: { deck: Deck }) {
  useDeck(deck);
  const [beats, setBeats] = useState(4);
  const [mode, setMode] = useState("loop");
  return <div className="space-y-2">
    <div className="flex gap-2"><select aria-label={`Loop length deck ${deck.id}`} value={beats} onChange={e => { const n = Number(e.target.value); setBeats(n); deck.setLoopBeats(n); }} className="h-9 flex-1 rounded-sm bg-secondary text-foreground px-2 text-xs">{[0.25,0.5,1,2,4,8,16,32].map(n => <option key={n} value={n}>{n} beats</option>)}</select><select aria-label={`Loop mode deck ${deck.id}`} value={mode} onChange={e => setMode(e.target.value)} className="h-9 flex-1 rounded-sm bg-secondary px-2 text-xs"><option value="loop">Manual loop</option><option value="jump">Beat jump</option><option value="auto">Auto loop</option></select></div>
    {mode === "jump" ? <div className="grid grid-cols-2 gap-2">{[-1,1].map(d => <Button key={d} variant="secondary" aria-label={`${d < 0 ? "Back" : "Forward"} ${beats} beats deck ${deck.id}`} onClick={() => deck.skipBeats(d * beats)}>{d < 0 ? <ChevronLeft /> : <ChevronRight />}{beats}</Button>)}</div> : mode === "auto" ? <Button variant={deck.loopActive ? "default" : "secondary"} className="w-full" onClick={() => deck.toggleLoop(beats)}>{beats} beats</Button> : <><div className="grid grid-cols-3 gap-2"><Button variant="secondary" onClick={() => deck.setLoopIn()}>IN</Button><Button variant="secondary" onClick={() => deck.setLoopOut()}>OUT</Button><Button variant={deck.loopActive ? "default" : "secondary"} onClick={() => deck.reloop()}>RELOOP</Button></div><div className="grid grid-cols-2 gap-2"><Button variant="secondary" onClick={() => { setBeats(beats / 2); deck.setLoopBeats(deck.loopBeats / 2); }}>× ½</Button><Button variant="secondary" onClick={() => { setBeats(beats * 2); deck.setLoopBeats(deck.loopBeats * 2); }}>× 2</Button></div></>}
  </div>;
}