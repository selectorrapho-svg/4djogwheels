import { Deck, type StemKey } from "@/lib/dj/engine";
import { Drum, Guitar, Piano, Mic, X } from "lucide-react";
import { useRef, useState } from "react";
import { useDeck } from "@/lib/dj/useMixer";
import { Button } from "@/components/ui/button";
import logo from "@/assets/mix4deejays-logo.jpg.asset.json";
import { DeckFxPanel } from "./DeckFxPanel";
import { useDjSettings } from "@/hooks/useDjSettings";

const STEMS: { key: StemKey; label: string; Icon: typeof Drum }[] = [
  { key: "drums", label: "Drums", Icon: Drum },
  { key: "bass", label: "Bass", Icon: Guitar },
  { key: "other", label: "Harmonic", Icon: Piano },
  { key: "vocals", label: "Vocals", Icon: Mic },
];

/** Four vertical stem faders (djay Neural Mix style). Tap an icon to mute/unmute. */
export function StemsPanel({ deck, onClose, inline = false }: { deck: Deck; accent: string; onClose: () => void; inline?: boolean }) {
  useDeck(deck);
  const saved = useRef<Record<StemKey, number>>({ drums: 1, bass: 1, other: 1, vocals: 1 });
  const [route, setRoute] = useState<StemKey | null>(null);
  const [djs, setDjs] = useDjSettings();
  const [eq, setEqState] = useState({ high: 0, mid: 0, low: 0 });
  const eqMode = djs.stemsEqMode === "eq";
  const status = deck.realStems ? "Separated stems" : deck.stemStatus === "loading" ? "Separating… · frequency bands active" : deck.stemStatus === "locked" ? "AI separation · Pro required · frequency bands" : deck.stemStatus === "unsupported" ? "AI unavailable on this device · frequency bands" : deck.stemStatus === "error" ? "Separation failed · frequency bands" : "Frequency bands";
  return (
    <div className={`stems-panel flex min-h-0 flex-col overflow-auto border border-border bg-secondary ${inline ? "relative h-full" : "absolute inset-x-0 top-9 bottom-14 z-30"} rounded-md`}>
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border px-2 py-1">
        <img src={logo.url} alt="mix4deejays" className="h-9 w-20 object-contain" /><span className="text-xs text-muted-foreground">Deck {deck.id}</span>
        <DeckFxPanel deck={deck} accent="var(--accent-blue)" compact />
        <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close stems" className="size-7"><X className="size-3.5" /></Button>
      </div>
      <div className="flex items-center gap-2 px-2 py-1">
        <span role="status" className="min-w-0 flex-1 truncate text-[9px] text-muted-foreground">{eqMode ? "EQ" : status}</span>
        <Button variant="ghost" className={`h-5 px-2 text-[9px] ${!eqMode ? "dj-glass-on" : ""}`} onClick={() => setDjs({ stemsEqMode: "stems" })}>Stems</Button>
        <Button variant="ghost" className={`h-5 px-2 text-[9px] ${eqMode ? "dj-glass-on" : ""}`} onClick={() => setDjs({ stemsEqMode: "eq" })}>EQ</Button>
      </div>
      {eqMode ? (
        <div className="grid min-h-24 flex-1 grid-cols-3 divide-x divide-border">
          {(["high", "mid", "low"] as const).map((b) => (
            <div key={b} className="flex min-w-0 flex-col items-center gap-1 px-1 pb-2">
              <span className="text-[8px] uppercase text-muted-foreground">{b}</span>
              <input type="range" min={-26} max={6} step={0.5} value={eq[b]} onDoubleClick={() => { deck.setEq(b, 0); setEqState(e => ({ ...e, [b]: 0 })); }}
                onChange={(e) => { const v = Number(e.target.value); deck.setEq(b, v); setEqState(x => ({ ...x, [b]: v })); }}
                aria-label={`EQ ${b} deck ${deck.id}`} className="stem-slider reference-stem-slider" />
              <span className="text-[9px] tabular-nums text-muted-foreground">{eq[b] > 0 ? "+" : ""}{eq[b].toFixed(1)} dB</span>
            </div>
          ))}
        </div>
      ) : (
      <div className="grid min-h-24 flex-1 grid-cols-4 divide-x divide-border">
        {STEMS.map(({ key, label, Icon }) => {
          const v = deck.stemLevels[key];
          return (
            <div key={key} className="flex min-w-0 flex-col items-center gap-1 px-1 pb-2">
              <Button variant="ghost"
                onClick={() => { if (v > 0.01) saved.current[key] = v; deck.setStemLevel(key, v > 0.01 ? 0 : saved.current[key]); }}
                aria-label={`Toggle ${label} deck ${deck.id}`} aria-pressed={v <= 0.01}
                className={`h-7 w-full rounded-md border border-border p-0 ${v > 0.01 ? "bg-muted" : "bg-background opacity-50"}`}
              >
                <Icon className="size-4" />
              </Button>
              <span className="text-[8px] uppercase text-muted-foreground">{label}</span>
              <input
                type="range" min={0} max={1} step={0.01} value={v}
                onChange={(e) => deck.setStemLevel(key, Number(e.target.value))}
                aria-label={`${label} level deck ${deck.id}`}
                className="stem-slider reference-stem-slider"
              />
              <span className="text-[9px] tabular-nums text-muted-foreground">{Math.round(v * 100)}%</span>
              <Button variant="ghost" className="h-5 w-full p-0 text-[9px]" aria-label={`Solo ${label} deck ${deck.id}`} aria-pressed={route === key} onClick={() => { const next = route === key ? null : key; setRoute(next); STEMS.forEach(s => deck.setStemLevel(s.key, next === null ? saved.current[s.key] : s.key === next ? 1 : 0)); }}>Solo</Button>
            </div>
          );
        })}
      </div>
      )}
    </div>
  );
}
