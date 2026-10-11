import { useMemo, useRef, useState } from "react";
import { Deck, FX_LIBRARY, FxKey } from "@/lib/dj/engine";
import { useDeck } from "@/lib/dj/useMixer";
import { Button } from "@/components/ui/button";
import { Sliders, X, ChevronLeft, ChevronRight, Settings2, Power } from "lucide-react";
import { EffectBrowser } from "./EffectBrowser";
import { useDjSettings } from "@/hooks/useDjSettings";
import { DeckDrawer } from "./DeckDrawer";

type Tab = "pad" | "instant" | "manual";

const INSTANT_DEFAULT: FxKey[] = [
  "echo_out_1_2",
  "echo_out_1",
  "gate_1_2",
  "gate_1",
  "double_beat",
  "brake",
  "reverb_hall",
  "backspin_echo",
] as FxKey[];

const MANUAL_DEFAULT: FxKey[] = ["echo_1_2", "flanger", "reverb_hall"] as FxKey[];

const FX_GROUPS = FX_LIBRARY.reduce<Record<string, typeof FX_LIBRARY>>((acc, p) => {
  const c = p.category ?? "Other";
  (acc[c] ??= []).push(p);
  return acc;
}, {});

/** FX library drop-down: every effect, grouped by category. */
function FxSelect({ value, onPick, deckId }: { value: FxKey; onPick: (k: FxKey) => void; deckId: string }) {
  const [browse, setBrowse] = useState(false);
  const [, update] = useDjSettings();
  return <><Button variant="secondary" className="h-7 min-w-0 w-full justify-between gap-1 px-1 text-[10px]" aria-label={`Choose effect ${fxLabel(value)}`} onPointerDown={e => e.stopPropagation()} onClick={e => { e.stopPropagation(); setBrowse(true); }}><span className="min-w-0 truncate">{fxLabel(value)}</span><ChevronRight className="size-3 shrink-0" /></Button>{browse && <EffectBrowser deckId={deckId} selected={value} onAudio={onPick} onVisual={visualPreset => update({ visualPreset })} onClose={() => setBrowse(false)} />}</>;
}

function fxLabel(key: FxKey) {
  return FX_LIBRARY.find((p) => p.key === key)?.label ?? String(key).replace(/_/g, " ");
}

/**
 * djay-style FX drawer: Pad (XY filter/FX pad), Instant (momentary grid),
 * Manual (per-slot ON + depth slider + knob). Frosted side drawer so the deck
 * stays visible behind it.
 */
export function DeckFxPanel({
  deck,
  accent,
  side = "left",
  compact,
  inline = false,
}: {
  deck: Deck;
  accent: string;
  side?: "left" | "right";
  compact?: boolean;
  inline?: boolean;
}) {
  useDeck(deck);
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<Tab>("pad");
  const [padFx, setPadFx] = useState<FxKey>(INSTANT_DEFAULT[2]);
  const [padOn, setPadOn] = useState(true);
  const [instant, setInstant] = useState<FxKey[]>(INSTANT_DEFAULT);
  const [manual, setManual] = useState<FxKey[]>(MANUAL_DEFAULT);
  const [manualOn, setManualOn] = useState<boolean[]>([false, false, false]);
  const [manualVal, setManualVal] = useState<number[]>([0.5, 0.8, 0.4]);
  const [held, setHeld] = useState<FxKey | null>(null);
  const [beatSettings, setBeatSettings] = useState(false);
  const [lock, setLock] = useState(false);
  const [xy, setXy] = useState<{ x: number; y: number } | null>(null);
  const padRef = useRef<HTMLDivElement>(null);

  const order = useMemo(() => FX_LIBRARY.map((p) => p.key as FxKey), []);
  const cycle = (key: FxKey, dir: 1 | -1) => {
    const i = order.indexOf(key);
    return order[(i + dir + order.length) % order.length];
  };

  const oneShot = (key: FxKey) => /^(echo_out|backspin|brake)/.test(String(key));
  const fire = (key: FxKey) => {
    // Lock: tapping a latched pad again turns it off.
    if (lock && held === key) {
      setHeld(null);
      deck.releaseFx(true);
      return;
    }
    setHeld(key);
    deck.holdFx(key);
  };
  const release = (key: FxKey) => {
    if (lock && !oneShot(key)) return;
    setHeld(null);
    if (oneShot(key)) return;
    deck.releaseFx(true);
  };

  // XY pad: vertical = filter sweep (LP ↓ / HP ↑), horizontal = FX depth.
  const padMove = (e: React.PointerEvent) => {
    const el = padRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const x = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
    const y = Math.min(1, Math.max(0, (e.clientY - r.top) / r.height));
    setXy({ x, y });
    deck.setFilter((0.5 - y) * 2);
    deck.setFxAmount(x);
  };

  const Selector = ({ value, onPick }: { value: FxKey; onPick: (k: FxKey) => void }) => (
    <div className="flex items-center justify-between px-1">
      <button onClick={() => onPick(cycle(value, -1))} className="p-1 text-muted-foreground">
        <ChevronLeft className="w-3.5 h-3.5" />
      </button>
      <div className="flex-1 min-w-0 px-1"><FxSelect deckId={deck.id} value={value} onPick={onPick} /></div>
      <button onClick={() => onPick(cycle(value, 1))} className="p-1 text-muted-foreground">
        <ChevronRight className="w-3.5 h-3.5" />
      </button>
    </div>
  );

  return (
    <>
      {!inline && <Button variant="ghost"
        onClick={() => setOpen((o) => !o)}
        className="w-9 h-9 rounded-full flex items-center justify-center dj-glass"
        style={{ boxShadow: deck.activeFx ? `0 0 10px ${accent}` : undefined }}
        title="FX" aria-label={`Deck ${deck.id} FX`}
      >
        <Sliders className="w-4 h-4" style={{ color: deck.activeFx ? accent : "var(--muted-foreground)" }} />
      </Button>}

      {(inline || open) && (
        <FxFrame inline={inline} deckId={deck.id} side={side}>
          {/* tab bar — djay style pill highlight */}
          <div className="flex items-center gap-1 px-2 py-2 border-b border-[var(--glass-border)]">
            {(["pad", "instant", "manual"] as Tab[]).map((t) => (
              <Button variant="ghost"
                key={t}
                onClick={() => setTab(t)}
                className="h-7 min-w-0 flex-1 px-1 rounded-md text-[10px] capitalize"
                aria-pressed={tab === t}
              >
                {t}
              </Button>
            ))}
            <Button variant="ghost" size="icon" aria-label="FX beat settings" title="FX beat settings" onClick={() => setBeatSettings(v => !v)}><Settings2 /></Button>
            {!inline && <Button variant="ghost" size="icon" aria-label="Close FX" onClick={() => setOpen(false)} className="p-1 text-muted-foreground">
              <X className="w-4 h-4" />
            </Button>}
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto p-2">
            {beatSettings && <div className="mb-2 border-b border-border pb-2 space-y-1">
              {Array.from(new Set([padFx, ...instant, ...manual])).filter(key => { const base = FX_LIBRARY.find(p => p.key === key)?.base; return base && ["echo", "delay", "gate", "roll", "tremolo", "flanger", "phaser"].includes(base); }).map(key => <label key={key} className="flex items-center justify-between gap-1 text-[10px]"><span className="truncate">{fxLabel(key)}</span><select aria-label={`${fxLabel(key)} beats`} className="bg-background border border-border p-1" value={deck.fxBeatOverrides[key] ?? FX_LIBRARY.find(p => p.key === key)?.params?.beats ?? 1} onChange={e => deck.setFxBeats(key, Number(e.target.value))}>{[0.0625, 0.125, 0.25, 0.5, 1, 2, 3, 4].map(b => <option key={b} value={b}>{b < 1 ? `1/${1 / b}` : `${b}/1`} beat</option>)}</select></label>)}
            </div>}
            {tab === "pad" && (
              <div className="flex flex-col gap-2">
              <div className="flex items-center gap-1">
                <div className="flex-1 min-w-0"><Selector value={padFx} onPick={(k) => setPadFx(k)} /></div>
                <button
                  aria-label="Pad FX on/off"
                  aria-pressed={padOn}
                  title={padOn ? "Pad FX on — tap to disable" : "Pad FX off — tap to enable"}
                  onClick={() => setPadOn((o) => { if (o) { deck.setFilter(0); deck.setFx(null); } return !o; })}
                  className={`grid size-8 shrink-0 place-items-center rounded-full ${padOn ? "dj-glass-on text-primary" : "dj-glass text-muted-foreground"}`}
                  style={padOn ? { boxShadow: "0 0 10px rgba(80,160,255,0.35), var(--glass-shadow)" } : undefined}
                >
                  <Power className="w-3.5 h-3.5" />
                </button>
              </div>
              <div
                  ref={padRef}
                  onPointerDown={(e) => {
                    if (!padOn) return;
                    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
                    deck.setFx(padFx, 0.6);
                    padMove(e);
                  }}
                  onPointerMove={(e) => padOn && xy && padMove(e)}
                  onPointerUp={() => {
                    setXy(null);
                    deck.setFilter(0);
                    deck.setFx(null);
                  }}
                  className="fx-xy-pad relative rounded-md overflow-hidden select-none"
                  style={{
                    opacity: padOn ? 1 : 0.35,
                    height: compact ? 120 : 160,
                    touchAction: "none",
                    background:
                      "repeating-linear-gradient(0deg, rgba(255,255,255,0.035) 0 1px, transparent 1px 6px), var(--glass)",
                    border: "1px solid var(--glass-border)",
                  }}
                >
                  <span className="absolute top-2 left-1/2 -translate-x-1/2 text-[11px] text-muted-foreground">HP</span>
                  <span className="absolute bottom-2 left-1/2 -translate-x-1/2 text-[11px] text-muted-foreground">LP</span>
                  <span className="absolute left-2 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-white/50" />
                  <span
                    className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 rounded-full border"
                    style={{ borderColor: "rgba(255,255,255,0.5)" }}
                  />
                  {xy && (
                    <span
                      className="absolute w-5 h-5 rounded-full -translate-x-1/2 -translate-y-1/2 pointer-events-none"
                      style={{
                        left: `${xy.x * 100}%`,
                        top: `${xy.y * 100}%`,
                        background: accent,
                        boxShadow: `0 0 18px ${accent}`,
                      }}
                    />
                  )}
                </div>
                <p className="text-[9px] text-muted-foreground text-center">

                </p>
              </div>
            )}

            {tab === "instant" && (
              <>
              <button
                onClick={() => {
                  setLock((l) => !l);
                  if (held) { deck.releaseFx(true); setHeld(null); }
                }}
                className="w-full mb-2 py-1.5 rounded-lg text-[11px] font-semibold"
                style={
                  lock
                    ? { border: "1px solid #f0a02a", color: "#f0a02a", background: "rgba(240,160,42,0.1)" }
                    : { border: "1px solid var(--glass-border)", color: "var(--muted-foreground)" }
                }
              >
                {lock ? "LOCK" : "HOLD"}
              </button>
              <div className="fx-instant-grid grid grid-cols-4 gap-1 overflow-hidden" style={{ background: "var(--glass-border)" }}>
                {instant.slice(0, 8).map((key, i) => {
                  const on = held === key || deck.activeFx === key;
                  return (
                    <div
                      key={i}
                      onPointerDown={e => { e.currentTarget.setPointerCapture(e.pointerId); fire(key); }}
                      onPointerUp={() => release(key)}
                      onPointerCancel={() => release(key)}
                      onPointerLeave={() => !lock && held === key && release(key)}
                      className={`performance-pad animated-pad pad-tone-${i % 4} px-1 py-0.5 select-none active:opacity-80`}
                       data-active={on}
                      style={{ touchAction: "none" }}
                    >
                      <div className="text-[9px] italic text-muted-foreground">FX</div>
                      <div className="text-[10px] leading-tight min-h-7 break-words text-foreground">
                        {fxLabel(key)}
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-[9px] text-muted-foreground">{i + 1}</span>
                      </div>
                      <div className="mt-1">
                        <FxSelect
                          deckId={deck.id}
                          value={key}
                          onPick={(k) => setInstant((p) => p.map((v, idx) => (idx === i ? k : v)))}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
              <label className="mt-3 flex items-center gap-2 text-[10px] text-muted-foreground">Amount<input aria-label="Instant FX amount" type="range" min={0} max={1} step={0.01} defaultValue={0.6} onChange={e => deck.setFxAmount(Number(e.target.value))} className="fx-glass-slider min-w-0 flex-1" /></label>
              </>
            )}

            {tab === "manual" && (
              <div className="flex flex-col">
                {manual.map((key, i) => (
                  <div key={i} className="py-1 border-b border-border">
                    <Selector
                      value={key}
                      onPick={(k) => setManual((p) => p.map((v, idx) => (idx === i ? k : v)))}
                    />
                    <div className="flex items-center gap-2 mt-1.5">
                      <button
                        onClick={() => {
                          const next = !manualOn[i];
                          setManualOn((p) => p.map((v, idx) => (idx === i ? next : v)));
                          if (next) deck.setFx(key, manualVal[i]);
                          else deck.setFx(null);
                        }}
                        className="w-9 h-9 rounded-full grid place-items-center text-[9px] font-semibold shrink-0"
                        style={{
                          border: `1px solid ${manualOn[i] ? "#f0a02a" : "var(--glass-border)"}`,
                          color: manualOn[i] ? "#f0a02a" : "var(--muted-foreground)",
                          background: manualOn[i] ? "rgba(240,160,42,0.12)" : "transparent",
                        }}
                      >
                        ON
                      </button>
                      <input
                        type="range"
                        min={0}
                        max={1}
                        step={0.01}
                        value={manualVal[i]}
                        onChange={(e) => {
                          const v = parseFloat(e.target.value);
                          setManualVal((p) => p.map((x, idx) => (idx === i ? v : x)));
                          if (manualOn[i]) deck.setFxAmount(v);
                        }}
                        aria-label={`${fxLabel(key)} amount`}
                        className="fx-glass-slider flex-1 min-w-0"
                      />

                    </div>
                  </div>
                ))}
                <div className="flex items-center justify-between pt-2">
                  <span className="text-[9px] uppercase tracking-widest text-muted-foreground">Filter</span>
                  <input
                    type="range"
                    min={-1}
                    max={1}
                    step={0.01}
                    defaultValue={0}
                    onChange={(e) => deck.setFilter(parseFloat(e.target.value))}
                    aria-label="FX filter"
                    className="fx-glass-slider w-1/2"
                  />
                  <button
                    onClick={() => {
                      deck.setFx(null);
                      deck.setFilter(0);
                      setManualOn([false, false, false]);
                    }}
                    className="text-[9px] uppercase text-muted-foreground"
                  >
                    Off
                  </button>
                </div>
              </div>
            )}
          </div>
        </FxFrame>
      )}
    </>
  );
}

function FxFrame({ inline, deckId, side, children }: { inline: boolean; deckId: string; side: "left" | "right"; children: React.ReactNode }) {
  return inline ? <section className="flex min-h-0 flex-1 flex-col">{children}</section> : <DeckDrawer deckId={deckId} side={side} reachTop label={`Deck ${deckId} effects`} className="fx-drawer">{children}</DeckDrawer>;
}
