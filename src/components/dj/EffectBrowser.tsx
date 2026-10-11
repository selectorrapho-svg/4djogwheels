import { useMemo, useState } from "react";
import { Star, Check, Film, AudioLines, ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Portal } from "./Portal";
import { FX_LIBRARY, type FxKey } from "@/lib/dj/engine";
import { VISUAL_PRESETS, TRANSITION_PRESETS } from "@/lib/dj/videoPresets";
import { useDjSettings } from "@/hooks/useDjSettings";
import { DeckDrawer } from "./DeckDrawer";

type BrowserTab = "Audio" | "Visual" | "Favorites";
export function EffectBrowser({ deckId, selected, onAudio, onVisual, onTransition, onClose, transitions = false, initialTab = "Audio" }: {
  deckId?: string;
  selected?: string; onAudio?: (key: FxKey) => void; onVisual?: (key: string) => void; onTransition?: (key: string) => void; onClose: () => void; transitions?: boolean; initialTab?: BrowserTab;
}) {
  const [tab, setTab] = useState<BrowserTab>(initialTab);
  const [category, setCategory] = useState("All");
  const [settings, update] = useDjSettings();
  const favorites = settings.fxFavorites;
  const setFavorites = (fn: (previous: string[]) => string[]) => update({ fxFavorites: fn(favorites) });
  const audio = FX_LIBRARY.map(p => ({ key: p.key, label: p.label, category: p.category ?? "Other", kind: "audio" as const }));
  const visual = (transitions ? TRANSITION_PRESETS : VISUAL_PRESETS).map(p => ({ ...p, kind: "visual" as const }));
  const entries = tab === "Audio" ? audio : tab === "Visual" ? visual : [...audio, ...visual];
  const categories = ["All", ...new Set(entries.map(p => p.category))];
  const filtered = useMemo(() => entries.filter(p => (tab !== "Favorites" || favorites.includes(`${p.kind}:${p.key}`)) && (category === "All" || p.category === category)), [entries, tab, favorites, category]);
  const pick = (p: typeof entries[number]) => {
    if (p.kind === "audio") onAudio?.(p.key as FxKey);
    else if (transitions) onTransition?.(p.key); else onVisual?.(p.key);
    onClose();
  };
  const favKey = (p: typeof entries[number]) => `${p.kind}:${p.key}`;
  const content = <>
      <Button variant="ghost" className="h-7 justify-start px-2 text-xs" onClick={onClose}><ChevronLeft className="size-3" />Select FX</Button>
      <div className="m-2 grid grid-cols-3 gap-0.5 rounded-lg bg-secondary p-0.5">{(["Audio", "Visual", "Favorites"] as BrowserTab[]).map(t => <Button variant="ghost" key={t} aria-label={t} aria-pressed={tab === t} onClick={() => { setTab(t); setCategory("All"); }} className={`grid h-8 place-items-center rounded-md text-sm ${tab === t ? "bg-secondary text-foreground" : "text-muted-foreground"}`}>{t === "Favorites" ? <Star className="size-4 fill-current" /> : t}</Button>)}</div>
      <div className="flex items-center gap-2 border-b border-border px-3 pb-2">
        {category !== "All" && <button aria-label="All categories" onClick={() => setCategory("All")}><ChevronLeft className="size-4" /></button>}
        <span className="grid size-7 place-items-center rounded-md bg-secondary">{tab === "Audio" ? <AudioLines className="size-4" /> : <Film className="size-4" />}</span>
        <select aria-label="Effect category" value={category} onChange={e => setCategory(e.target.value)} className="min-w-0 flex-1 bg-transparent text-sm font-semibold text-muted-foreground outline-none">{categories.map(c => <option key={c} value={c}>{c === "All" ? (tab === "Visual" ? "Visuals" : "Essentials · all") : c}</option>)}</select>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">{filtered.map(p => <div key={favKey(p)} className="flex items-center border-b border-border/60">
        <button className="flex min-h-11 flex-1 items-center gap-2 px-4 text-left text-[15px] disabled:opacity-40" disabled={p.kind === "audio" ? !onAudio : transitions ? !onTransition : !onVisual} onClick={() => pick(p)}><span className="min-w-0 flex-1 truncate">{p.label}</span>{selected === p.key && <Check className="size-4 text-primary" />}</button>
        <button className="px-3" aria-label={`Favorite ${p.label}`} aria-pressed={favorites.includes(favKey(p))} onClick={() => setFavorites(f => f.includes(favKey(p)) ? f.filter(k => k !== favKey(p)) : [...f, favKey(p)])}><Star className={`size-3 ${favorites.includes(favKey(p)) ? "fill-current text-primary" : "text-muted-foreground"}`} /></button>
      </div>)}{!filtered.length && <p className="py-6 text-center text-sm text-muted-foreground">No effects here</p>}</div>
    </>;
  if (deckId) return <DeckDrawer deckId={deckId} label="Effect browser" layer={400}>{content}</DeckDrawer>;
  return <Portal><div className="fixed inset-0 z-[400] flex items-center justify-center p-3" onClick={onClose}><section role="dialog" aria-modal="true" aria-label={transitions ? "Transition browser" : "Effect browser"} className="flex max-h-[min(380px,82dvh)] w-[min(320px,92vw)] flex-col overflow-hidden rounded-md border border-border bg-popover text-foreground shadow-lg" onClick={e => e.stopPropagation()}>{content}</section></div></Portal>;
}
