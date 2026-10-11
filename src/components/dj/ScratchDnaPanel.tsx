import { useEffect, useRef, useState } from "react";
import { Plus, Trash2, Save } from "lucide-react";
import type { Deck } from "@/lib/dj/engine";
import { PRESET_DNA, loadCustomDna, saveCustomDna, playDna, type DnaPattern, type DnaStep } from "@/lib/dj/scratchDna";
import { Button } from "@/components/ui/button";

const LENGTHS = [0.5, 1, 2, 4];

/** VirtualDJ-style Scratch DNA pads (hold to repeat, tap to play once) plus a pattern editor. */
export function ScratchDnaPanel({ deck, accent }: { deck: Deck; accent: string }) {
  const [custom, setCustom] = useState<DnaPattern[]>([]);
  const [beats, setBeats] = useState(1);
  const [editing, setEditing] = useState<DnaPattern | null>(null);
  const stopRef = useRef<(() => void) | null>(null);
  useEffect(() => setCustom(loadCustomDna()), []);
  const all = [...PRESET_DNA, ...custom];

  const down = (p: DnaPattern) => { stopRef.current = playDna(deck, p, beats, true); };
  const up = () => { stopRef.current?.(); stopRef.current = null; };

  const persist = (list: DnaPattern[]) => { setCustom(list); saveCustomDna(list); };
  const save = () => {
    if (!editing) return;
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
            <Button variant="ghost" className="h-6 px-1.5 text-[10px]" aria-pressed={st.open} onClick={() => setStep(i, { open: !st.open })}>{st.open ? "Open" : "Cut"}</Button>
            <Button variant="ghost" size="icon" className="size-6" aria-label="Remove step" onClick={() => setEditing({ ...editing, steps: editing.steps.filter((_, k) => k !== i) })}><Trash2 className="size-3" /></Button>
          </div>
        ))}
      </div>
      <div className="flex gap-1">
        <Button variant="ghost" className="h-8 flex-1 text-[11px]" onClick={() => setEditing({ ...editing, steps: [...editing.steps, { beats: 0.25, speed: 1.5, open: true }] })}><Plus className="size-3" /> Step</Button>
        <Button variant="ghost" className="h-8 flex-1 text-[11px]" onPointerDown={() => down(editing)} onPointerUp={up} onPointerLeave={up}>Hold to test</Button>
        <Button variant="ghost" className="h-8 flex-1 text-[11px]" onClick={save}><Save className="size-3" /> Save</Button>
      </div>
      <Button variant="ghost" className="h-7 w-full text-[11px] text-muted-foreground" onClick={() => setEditing(null)}>Cancel</Button>
    </div>
  );

  return (
    <div>
      <div className="mb-2 grid grid-cols-4 gap-0.5 rounded-lg bg-secondary p-0.5 text-[10px]">
        {LENGTHS.map((b) => <button key={b} aria-pressed={beats === b} onClick={() => setBeats(b)} className={`h-6 rounded-md ${beats === b ? "bg-background text-primary" : "text-muted-foreground"}`}>{b < 1 ? "½" : b} beat</button>)}
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
        <Button variant="ghost" className="h-8 flex-1 text-[11px]" onClick={() => setEditing({ id: `c${Date.now()}`, name: "My scratch", custom: true, steps: [{ beats: 0.25, speed: 1.5, open: true }, { beats: 0.25, speed: -1.5, open: false }] })}><Plus className="size-3" /> New pattern</Button>
        {custom.length > 0 && <Button variant="ghost" className="h-8 text-[11px] text-muted-foreground" onClick={() => persist([])}>Clear custom</Button>}
      </div>
      <div className="mt-2 text-[8px] leading-tight text-muted-foreground">Hold a pad to scratch in time with the beat · long-press a custom pad to edit.</div>
    </div>
  );
}
