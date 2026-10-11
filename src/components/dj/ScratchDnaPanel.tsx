import { useEffect, useRef, useState } from "react";
import { Plus, Trash2, Save, Pencil, Play, MapPin } from "lucide-react";
import type { Deck } from "@/lib/dj/engine";
import { PRESET_DNA, loadCustomDna, saveCustomDna, playDna, type DnaPattern, type DnaStep } from "@/lib/dj/scratchDna";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { TrackOverview } from "./Waveform";

const LENGTHS = [0.5, 1, 2, 4];

/** VirtualDJ-style Scratch DNA pads (hold to repeat, tap to play once) plus a pattern editor. */
export function ScratchDnaPanel({ deck, accent }: { deck: Deck; accent: string }) {
  const [custom, setCustom] = useState<DnaPattern[]>([]);
  const [beats, setBeats] = useState(1);
  const [editing, setEditing] = useState<DnaPattern | null>(null);
  const [anchor, setAnchor] = useState<number | null>(null);
  const [selected, setSelected] = useState(PRESET_DNA[0].id);
  const stopRef = useRef<(() => void) | null>(null);
  useEffect(() => setCustom(loadCustomDna()), []);
  useEffect(() => () => stopRef.current?.(), []);
  const all = [...PRESET_DNA, ...custom];

  const down = (p: DnaPattern, repeat = true) => { stopRef.current?.(); setSelected(p.id); stopRef.current = playDna(deck, p, beats, repeat, anchor ?? deck.currentTime); };
  const up = () => { stopRef.current?.(); stopRef.current = null; };

  const persist = (list: DnaPattern[]) => { setCustom(list); saveCustomDna(list); };
  const save = () => {
    if (!editing || !editing.name.trim() || !editing.steps.length) return;
    const exists = custom.some((c) => c.id === editing.id);
    persist(exists ? custom.map((c) => (c.id === editing.id ? editing : c)) : [...custom, editing]);
    setEditing(null);
  };
  const setStep = (i: number, patch: Partial<DnaStep>) => editing && setEditing({ ...editing, steps: editing.steps.map((s, k) => (k === i ? { ...s, ...patch } : s)) });

  if (editing) return (
    <div className="space-y-2">
      <input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} aria-label="Pattern name" className="h-8 w-full rounded-md border border-border bg-background px-2 text-xs" />
      <div className="space-y-1">
        {editing.steps.map((st, i) => (
          <div key={i} className="flex items-center gap-1 text-[10px]">
            <span className="w-4 text-muted-foreground">{i + 1}</span>
            <input type="range" min={-3} max={3} step={0.1} value={st.speed} aria-label={`Step ${i + 1} speed`} onChange={(e) => setStep(i, { speed: Number(e.target.value) })} className="min-w-0 flex-1" style={{ accentColor: accent }} />
            <span className="w-8 tabular-nums">{st.speed > 0 ? "▶" : st.speed < 0 ? "◀" : "■"}{Math.abs(st.speed).toFixed(1)}</span>
            <select value={st.beats} aria-label={`Step ${i + 1} length`} onChange={(e) => setStep(i, { beats: Number(e.target.value) })} className="h-6 rounded bg-secondary px-0.5">
              {[0.0625, 0.125, 0.25, 0.5, 1].map((b) => <option key={b} value={b}>{b < 1 ? `1/${1 / b}` : "1"}</option>)}
            </select>
             <Switch aria-label={`Step ${i + 1} sound open`} checked={st.open} onCheckedChange={open => setStep(i, { open })} />
            <Button variant="ghost" size="icon" className="size-6" aria-label="Remove step" onClick={() => setEditing({ ...editing, steps: editing.steps.filter((_, k) => k !== i) })}><Trash2 className="size-3" /></Button>
          </div>
        ))}
      </div>
      <div className="flex gap-1">
        <Button variant="ghost" className="h-8 flex-1 text-[11px]" onClick={() => setEditing({ ...editing, steps: [...editing.steps, { beats: 0.25, speed: 1.5, open: true }] })}><Plus className="size-3" /> Step</Button>
         <Button variant="ghost" className="h-8 flex-1 text-[11px]" onPointerDown={e => { e.currentTarget.setPointerCapture(e.pointerId); down(editing); }} onPointerUp={up} onPointerCancel={up}>Test</Button>
         <Button variant="ghost" disabled={!editing.steps.length || !editing.name.trim()} className="h-8 flex-1 text-[11px]" onClick={save}><Save className="size-3" /> Save</Button>
      </div>
      <Button variant="ghost" className="h-7 w-full text-[11px] text-muted-foreground" onClick={() => setEditing(null)}>Cancel</Button>
    </div>
  );

  return (
    <div>
      <div className="mb-2 h-8"><TrackOverview deck={deck} accent="var(--accent-red)" /></div>
      <div className="mb-2 flex items-center gap-1"><Button variant="outline" className="h-8 flex-1 px-2 text-[10px]" onClick={() => setAnchor(deck.currentTime)}><MapPin />Set scratch start</Button><input aria-label="Scratch starting position in seconds" type="number" min={0} max={deck.duration} step={0.01} value={anchor ?? ''} placeholder="Current" onChange={e => setAnchor(e.target.value === '' ? null : Math.max(0, Math.min(deck.duration, Number(e.target.value))))} className="h-8 w-20 rounded border border-border bg-secondary px-2 text-xs" /></div>
      <div className="mb-2 grid grid-cols-4 gap-0.5 rounded-lg bg-secondary p-0.5 text-[10px]">
        {LENGTHS.map((b) => <Button variant="ghost" key={b} aria-pressed={beats === b} onClick={() => setBeats(b)} className={`h-6 px-1 text-[10px] rounded-md ${beats === b ? "bg-background text-primary" : "text-muted-foreground"}`}>{b < 1 ? "½" : b} beat</Button>)}
      </div>
      <div className="grid grid-cols-4 gap-2">
        {all.map((p, i) => (
          <Button key={p.id} variant="ghost" data-tone={i % 8} className="cue-pad h-12 flex-col gap-0 p-1 text-[10px] font-bold touch-none"
            onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); down(p); }}
            onPointerUp={up} onPointerCancel={up}
            onContextMenu={(e) => { e.preventDefault(); if (p.custom) setEditing(p); }}>
            <span>{p.name}</span>
            <span className="text-[8px] font-normal text-muted-foreground">{p.custom ? "custom" : "DNA"}</span>
          </Button>
        ))}
      </div>
      <div className="mt-2 flex gap-1">
        <Button variant="outline" size="icon" title="Play selected pattern once" aria-label="Play DNA once" onClick={() => { const p = all.find(p => p.id === selected); if (p) down(p, false); }}><Play /></Button>
        <Button variant="outline" size="icon" title="Edit selected pattern" aria-label="Edit DNA pattern" onClick={() => { const p = all.find(p => p.id === selected); if (p) setEditing({ ...p, id: p.custom ? p.id : `c${Date.now()}`, custom: true, steps: p.steps.map(st => ({ ...st })) }); }}><Pencil /></Button>
        <Button variant="ghost" className="h-8 flex-1 text-[11px]" onClick={() => setEditing({ id: `c${Date.now()}`, name: "My scratch", custom: true, steps: [{ beats: 0.25, speed: 1.5, open: true }, { beats: 0.25, speed: -1.5, open: false }] })}><Plus className="size-3" /> New pattern</Button>
        {custom.length > 0 && <Button variant="ghost" className="h-8 text-[11px] text-muted-foreground" onClick={() => persist([])}>Clear custom</Button>}
      </div>
    </div>
  );
}
