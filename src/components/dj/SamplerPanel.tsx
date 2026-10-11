import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Mixer } from "@/lib/dj/engine";
import { sampleLibrary, type Sample } from "@/lib/dj/sampleLibrary";
import { ChevronDown, Grid3x3, Plus, Trash2, X } from "lucide-react";
import { Fader } from "./Fader";
import { Button } from "@/components/ui/button";

export function SamplerPanel({
  mixer,
  side = "left",
  deckLabel,
  inline = false,
}: {
  mixer: Mixer | null;
  side?: "left" | "right";
  deckLabel?: string;
  /** Render a compact pad bank embedded in the page (video-mode Samples view). */
  inline?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [packId, setPackId] = useState("sfx");
  const [menu, setMenu] = useState(false);
  const [manage, setManage] = useState(false);
  const [page, setPage] = useState(0);
  const [vol, setVol] = useState(0.9);
  const [hit, setHit] = useState<number | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const packs = useSyncExternalStore(sampleLibrary.subscribe, sampleLibrary.snapshot, sampleLibrary.snapshot);
  useEffect(() => { if (open || inline) void sampleLibrary.restore().catch(() => {}); }, [open, inline]);

  const pack = packs.find((p) => p.id === packId) ?? packs[0];
  const pages = Math.max(1, Math.ceil(pack.samples.length / 16));
  const pads: (Sample | null)[] = Array.from({ length: 16 }, (_, i) => pack.samples[page * 16 + i] ?? null);

  const trigger = (p: Sample, i: number) => {
    if (!mixer) return;
    mixer.resume();
    mixer.playSample(p.url, vol);
    setHit(i);
    window.setTimeout(() => setHit((h) => (h === i ? null : h)), 180);
  };

  if (inline) {
    return (
      <div className="w-full">
        <div className="mb-1 flex items-center gap-1 text-[10px]">
          <div className="relative flex-1">
            <button onClick={() => setMenu((m) => !m)} className="flex w-full items-center justify-between rounded-lg border border-border bg-secondary px-2 py-1">
              <span className="truncate">{pack.name} <span className="text-muted-foreground">({pack.samples.length})</span></span>
              <ChevronDown className="w-3 h-3" />
            </button>
            {menu && (
              <div className="absolute left-0 right-0 top-7 z-10 rounded-lg border border-border bg-popover p-1 shadow-lg">
                {packs.map((p) => (
                  <button key={p.id} onClick={() => { setPackId(p.id); setPage(0); setMenu(false); }} className={`block w-full rounded px-2 py-1 text-left ${p.id === pack.id ? "text-primary" : ""}`}>
                    {p.name} <span className="text-muted-foreground">({p.samples.length})</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <button onClick={() => fileRef.current?.click()} className="rounded-lg border border-border bg-secondary p-1" aria-label="Add samples"><Plus className="w-3 h-3" /></button>
          <input ref={fileRef} type="file" accept="audio/*" multiple className="hidden"
            onChange={(e) => { const f = Array.from(e.target.files ?? []); e.target.value = ""; void sampleLibrary.add(f).then(() => { setPackId("mine"); setPage(0); }); }} />
        </div>
        <div className="sampler-grid grid grid-cols-8 gap-1">
          {pads.map((p, i) => (
            <Button variant="ghost" key={i} disabled={!p} onPointerDown={() => p && trigger(p, i)}
              data-active={hit === i} className={`performance-pad animated-pad pad-tone-${i % 4} h-auto px-0.5 py-1 text-[8px] font-medium uppercase disabled:opacity-30`}>
              {p?.label ?? i + 1}
            </Button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className={`w-8 h-8 rounded-full flex items-center justify-center ${open ? "dj-glass-on" : "dj-glass"}`}
        title="Sampler" aria-label="Sampler"
      >
        <Grid3x3 className="w-4 h-4" />
      </button>
      {open && (
        <div
          className={`sampler-drawer fixed z-[65] top-1/2 -translate-y-1/2 w-[268px] max-w-[70vw] p-2.5 dj-panel rounded-2xl ${side === "left" ? "left-1" : "right-1"}`}
          style={{ boxShadow: "0 20px 50px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.14)" }}
        >
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-[10px] uppercase tracking-widest text-muted-foreground">
              Sampler{deckLabel ? ` · ${deckLabel}` : ""}
            </h2>
            <button onClick={() => setOpen(false)} className="text-muted-foreground" aria-label="Close sampler">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="flex items-center gap-1 mb-2 text-[10px]">
            <div className="relative flex-1">
              <button onClick={() => setMenu((m) => !m)} className="flex w-full items-center justify-between rounded-lg border border-border bg-secondary px-2 py-1.5">
                <span className="truncate">{pack.name} <span className="text-muted-foreground">({pack.samples.length})</span></span>
                <ChevronDown className="w-3 h-3" />
              </button>
              {menu && (
                <div className="absolute left-0 right-0 top-8 z-10 rounded-lg border border-border bg-popover p-1 shadow-lg">
                  {packs.map((p) => (
                    <button key={p.id} onClick={() => { setPackId(p.id); setPage(0); setMenu(false); setManage(false); }}
                      className={`block w-full rounded px-2 py-1.5 text-left ${p.id === pack.id ? "text-primary" : ""}`}>
                      {p.name} <span className="text-muted-foreground">({p.samples.length})</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button onClick={() => fileRef.current?.click()} className="rounded-lg border border-border bg-secondary p-1.5" aria-label="Add samples"><Plus className="w-3.5 h-3.5" /></button>
            {pack.id === "mine" && pack.samples.length > 0 && (
              <button onClick={() => setManage((m) => !m)} className={`rounded-lg border border-border p-1.5 ${manage ? "bg-destructive/30" : "bg-secondary"}`} aria-label="Delete samples"><Trash2 className="w-3.5 h-3.5" /></button>
            )}
            <input ref={fileRef} type="file" accept="audio/*" multiple className="hidden"
              onChange={(e) => { const f = Array.from(e.target.files ?? []); e.target.value = ""; void sampleLibrary.add(f).then(() => { setPackId("mine"); setPage(0); }); }} />
          </div>

          {manage && pack.id === "mine" ? (
            <div className="max-h-40 overflow-y-auto">
              {pack.samples.map((s) => (
                <div key={s.id} className="flex items-center justify-between border-b border-border/60 py-1.5 text-[11px]">
                  <span className="truncate">{s.label}</span>
                  <button onClick={() => void sampleLibrary.remove(s.id)} className="text-destructive" aria-label={`Delete ${s.label}`}><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex gap-2.5">
              <div className="flex-1">
                <div className="sampler-grid grid grid-cols-4 gap-1">
                  {pads.map((p, i) => {
                    const col = p?.color ?? "#ffffff";
                    const active = hit === i;
                    return (
                      <Button variant="ghost" key={i} disabled={!p} onPointerDown={() => p && trigger(p, i)}
                        data-active={active} className={`performance-pad animated-pad pad-tone-${i % 4} aspect-square h-auto px-1 text-[9px] font-medium uppercase disabled:opacity-30`}>
                        {p?.label ?? (pack.id === "mine" && i === 0 ? "+ Add" : i + 1)}
                      </Button>
                    );
                  })}
                </div>
                {pages > 1 && (
                  <div className="mt-1.5 flex items-center justify-center gap-2 text-[9px] text-muted-foreground">
                    <button onClick={() => setPage((p) => (p - 1 + pages) % pages)}>‹</button>
                    <span>Bank {page + 1}/{pages}</span>
                    <button onClick={() => setPage((p) => (p + 1) % pages)}>›</button>
                  </div>
                )}
              </div>
              <div className="flex flex-col items-center gap-1">
                <Fader value={vol} onChange={setVol} orientation="v" height={112} width={30} />
                <span className="text-[8px] uppercase tracking-widest text-muted-foreground">Vol</span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
