import { useRef, useState } from "react";
import { Grid2x2, ArrowLeft, ArrowRight, Flag, Undo2 } from "lucide-react";
import { Deck } from "@/lib/dj/engine";
import { useDeck } from "@/lib/dj/useMixer";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export function BeatGridEditor({ deck, editing, onEditing }: { deck: Deck; editing: boolean; onEditing: (value: boolean) => void }) {
  useDeck(deck);
  const [open, setOpen] = useState(false);
  const original = useRef({ bpm: deck.bpm, firstBeat: deck.firstBeat });
  const taps = useRef<number[]>([]);
  const apply = (bpm: number, firstBeat = deck.firstBeat) => deck.setBeatGrid(bpm, firstBeat);
  return <Popover open={open} onOpenChange={value => { if (value) original.current = { bpm: deck.bpm, firstBeat: deck.firstBeat }; setOpen(value); }}>
    <PopoverTrigger asChild><Button variant="ghost" className="dj-glass size-6 p-0" aria-label={`Edit beat grid deck ${deck.id}`} title="Edit beat grid" onPointerDown={e => e.stopPropagation()}><Grid2x2 className="size-3" /></Button></PopoverTrigger>
    <PopoverContent className="w-64 bg-background border-border p-3" onPointerDown={e => e.stopPropagation()}>
      <h2 className="text-sm font-semibold mb-3">Beat grid · Deck {deck.id}</h2>
      <label className="flex items-center justify-between gap-2 text-xs">BPM<input aria-label={`Grid BPM deck ${deck.id}`} type="number" min="20" max="400" step="0.01" value={deck.bpm || 120} onChange={e => apply(Number(e.target.value))} className="w-24 rounded-sm border border-border bg-secondary px-2 py-1 tabular-nums" /></label>
      <div className="grid grid-cols-3 gap-1 my-2">
        <Button variant="outline" size="sm" onClick={() => apply(deck.bpm / 2)}>½</Button>
        <Button variant="outline" size="sm" onClick={() => { const now = performance.now(); taps.current = [...taps.current.filter(t => now - t < 3000), now].slice(-8); const t = taps.current; if (t.length > 1) apply(60000 * (t.length - 1) / (t[t.length - 1] - t[0])); }}>Tap</Button>
        <Button variant="outline" size="sm" onClick={() => apply(deck.bpm * 2)}>×2</Button>
      </div>
      <label className="flex items-center justify-between gap-2 text-xs">Beat anchor (s)<input aria-label={`Beat anchor deck ${deck.id}`} type="number" step="0.001" value={Number(deck.firstBeat.toFixed(3))} onChange={e => apply(deck.bpm || 120, Number(e.target.value))} className="w-24 rounded-sm border border-border bg-secondary px-2 py-1 tabular-nums" /></label>
      <div className="flex gap-1 my-2">
        <Button variant="outline" size="icon" title="Grid earlier by 1 ms" aria-label="Grid earlier by 1 ms" onClick={() => apply(deck.bpm || 120, deck.firstBeat - 0.001)}><ArrowLeft /></Button>
        <Button variant="outline" className="flex-1 text-xs" onClick={() => apply(deck.bpm || 120, deck.currentTime)}><Flag className="size-3" />Set downbeat</Button>
        <Button variant="outline" size="icon" title="Grid later by 1 ms" aria-label="Grid later by 1 ms" onClick={() => apply(deck.bpm || 120, deck.firstBeat + 0.001)}><ArrowRight /></Button>
      </div>
      <div className="flex gap-1"><Button variant={editing ? "default" : "outline"} className="flex-1 text-xs" aria-pressed={editing} onClick={() => { onEditing(!editing); setOpen(false); }}>Drag markers</Button><Button variant="ghost" size="icon" title="Undo grid changes" aria-label="Undo grid changes" onClick={() => apply(original.current.bpm, original.current.firstBeat)}><Undo2 /></Button></div>
    </PopoverContent>
  </Popover>;
}

export function useGridDrag(deck: Deck, axis: "x" | "y", pixelsPerSecond: () => number) {
  const drag = useRef<{ pointer: number; pixel: number; anchor: number } | null>(null);
  return {
    onPointerDown: (e: React.PointerEvent) => { if (!deck.buffer) return; e.preventDefault(); e.currentTarget.setPointerCapture(e.pointerId); drag.current = { pointer: e.pointerId, pixel: axis === "x" ? e.clientX : e.clientY, anchor: deck.firstBeat }; },
    onPointerMove: (e: React.PointerEvent) => { const start = drag.current; if (!start || e.pointerId !== start.pointer) return; const pixel = axis === "x" ? e.clientX : e.clientY; deck.setBeatGrid(deck.bpm || 120, start.anchor + (pixel - start.pixel) / Math.max(1, pixelsPerSecond())); },
    onPointerUp: () => { drag.current = null; },
    onPointerCancel: () => { drag.current = null; },
    onLostPointerCapture: () => { drag.current = null; },
  };
}