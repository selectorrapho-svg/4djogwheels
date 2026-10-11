import { Deck, Mixer } from "@/lib/dj/engine";
import { useDeck, useActivePair } from "@/lib/dj/useMixer";
import { JogWheel } from "./JogWheel";
import { TrackOverview, Waveform } from "./Waveform";
import { useDjSettings } from "@/hooks/useDjSettings";
import { HorizontalWaveform } from "./HorizontalWaveform";
import { TopWaveforms } from "./TopWaveforms";
import { Crossfader } from "./Crossfader";
import { SamplerPanel } from "./SamplerPanel";
import { DeckFxPanel } from "./DeckFxPanel";
import { ThemeToggle } from "./ThemeToggle";
import { SettingsPanel } from "./SettingsPanel";
import { VideoMixStage } from "./VideoMixStage";
import { Knob } from "./Knob";
import { CuePointGrid } from "./CuePointGrid";
import { AppMode } from "@/hooks/useAppMode";
import { Play, Music, Sliders, Activity, Grid3x3, X, Repeat, Disc3, ChevronLeft, ChevronRight, Library } from "lucide-react";
import { SyncButton } from "./SyncButton";
import { TrackLibraryOverlay } from "./TrackLibraryOverlay";
import { Button } from "@/components/ui/button";
import brandLogo from "@/assets/djogwheels-user-logo-cropped.png";
import { useState, useRef, useEffect } from "react";
import { PitchMenu } from "./PitchMenu";
import { PreCueButton } from "./PreCueButton";
import { ScratchDnaPanel } from "./ScratchDnaPanel";
import { MixerView } from "./CenterColumn";
import { LoopControls } from "./LoopControls";
import { StemsPanel } from "./StemsPanel";
import { WaveformOptions } from "./WaveformOptions";

function MiniDeckHeader({ deck, side, onLibrary }: { deck: Deck; side: "left" | "right"; onLibrary: () => void }) {
  useDeck(deck);
  const accent = side === "left" ? "#ff8a3b" : "#3bd2ff";
  const fmt = (s: number) => {
    if (!isFinite(s)) return "0:00";
    const m = Math.floor(Math.abs(s) / 60);
    const sec = Math.floor(Math.abs(s) % 60);
    return `${s < 0 ? "-" : ""}${m}:${sec.toString().padStart(2, "0")}`;
  };
  const remain = Math.max(0, deck.duration - deck.currentTime);
  return (
    <button
      onClick={onLibrary}
      className="flex items-center gap-2 px-2 py-1 min-w-0 flex-1 text-left"
      aria-label={`Load track on deck ${deck.id}`}
    >
      <div className="w-8 h-8 rounded-full shrink-0 flex items-center justify-center border border-border bg-secondary">
        {deck.coverUrl ? <img src={deck.coverUrl} alt="" onError={e => { e.currentTarget.style.display = "none"; }} className="size-full rounded-full object-cover" /> : <Music className="w-3.5 h-3.5" style={{ color: accent }} />}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[9px] uppercase tracking-widest" style={{ color: accent }}>Deck {deck.id}</div>
        <div className="text-[11px] text-foreground truncate font-medium">{deck.trackName || "Load track"}</div>
        <div className="text-[9px] text-muted-foreground tabular-nums">-{fmt(remain)} · {deck.bpm ? deck.bpm.toFixed(1) : "—"} BPM</div>
        <div className="h-5 mt-1"><TrackOverview deck={deck} accent={accent} /></div>
      </div>
    </button>
  );
}

function DeckEqStrip({ deck, accent }: { deck: Deck; accent: string }) {
  useDeck(deck);
  const [lo, setLo] = useState(0);
  const [mid, setMid] = useState(0);
  const [hi, setHi] = useState(0);
  return (
    <div className="flex flex-col items-center gap-2 flex-1">
      <div className="text-[9px] uppercase tracking-widest" style={{ color: accent }}>EQ</div>
      <Knob value={hi} min={-24} max={24} size={44} label="HI" color={accent}
        onChange={(v) => { setHi(v); deck.setEq("high", v); }}
        onDoubleClick={() => { setHi(0); deck.setEq("high", 0); }} />
      <Knob value={mid} min={-24} max={24} size={44} label="MID" color={accent}
        onChange={(v) => { setMid(v); deck.setEq("mid", v); }}
        onDoubleClick={() => { setMid(0); deck.setEq("mid", 0); }} />
      <Knob value={lo} min={-24} max={24} size={44} label="LOW" color={accent}
        onChange={(v) => { setLo(v); deck.setEq("low", v); }}
        onDoubleClick={() => { setLo(0); deck.setEq("low", 0); }} />
    </div>
  );
}

type Sheet = null | "tools";
type MainView = "decks" | "wave" | "pads" | "mixer";
type ToolTab = "loop" | "cues" | "fx" | "samples" | "eq" | "dna";

function BottomSheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-end" onClick={onClose}>
      <div className="w-full dj-panel border-t max-h-[70vh] overflow-auto rounded-t-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-3 py-2 sticky top-0 dj-panel">
          <div className="text-xs uppercase tracking-widest text-muted-foreground">{title}</div>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center text-muted-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-3">{children}</div>
      </div>
    </div>
  );
}

export function PortraitLayout({
  mixer,
  mode,
  setMode,
  onAutomix,
}: {
  mixer: Mixer;
  mode: AppMode;
  setMode: (m: AppMode) => void;
  onAutomix?: () => void;
}) {
  const pair = useActivePair(mixer);
  const { left: deckLeft, right: deckRight } = mixer.activeDecks();

  const [sheet, setSheet] = useState<Sheet>(null);
  const [libraryDeck, setLibraryDeck] = useState<Deck | null>(null);
  const [mainView, setMainView] = useState<MainView>("decks");
  const [toolTab, setToolTab] = useState<ToolTab>("fx");
  const [topVisible, setTopVisible] = useState(false);
  const [toolDeck, setToolDeck] = useState<"left" | "right">("left");
  const [loopIndex, setLoopIndex] = useState(7);
  const [jogSize, setJogSize] = useState(160);
  const [stemsDeck, setStemsDeck] = useState<Deck | null>(null);
  useEffect(() => {
    const resize = () => setJogSize(Math.min(210, Math.max(112, Math.min(window.innerWidth / 2 - 12, (window.innerHeight - 290) * 0.75))));
    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, []);
  const [djs] = useDjSettings();
  const vertical = djs.waveOrientation !== "horizontal";
  const activeToolDeck = toolDeck === "left" ? deckLeft : deckRight;
  const loopBeats = [1 / 32, 1 / 16, 1 / 8, 1 / 4, 1 / 2, 1, 2, 4, 8, 16, 32];
  const loopLabels = ["1/32", "1/16", "1/8", "1/4", "1/2", "1", "2", "4", "8", "16", "32"];

  return (
    <div className="fixed inset-0 bg-background text-foreground flex flex-col overflow-hidden select-none">
      <div data-dj-topbar className="flex items-center justify-between h-11 shrink-0 gap-2 border-b border-border px-3">
        <img src={brandLogo} alt="djogwheels PRO" className="h-9 w-28 object-contain" />
        <div className="flex items-center gap-2"><WaveformOptions topVisible={topVisible} onTopVisible={setTopVisible} /><Button variant="ghost" size="icon" onClick={() => setLibraryDeck(deckLeft)} title="Library" aria-label="Open library"><Library /></Button><SettingsPanel mode={mode} setMode={setMode} onAutomix={onAutomix} /><ThemeToggle /></div>
      </div>
      {topVisible && <TopWaveforms decks={[deckLeft, deckRight]} />}
      <div className="flex items-center gap-1 px-1 min-h-0 h-[82px] shrink-0 border-b border-border">
        <MiniDeckHeader deck={deckLeft} side="left" onLibrary={() => setLibraryDeck(deckLeft)} />
        <MiniDeckHeader deck={deckRight} side="right" onLibrary={() => setLibraryDeck(deckRight)} />
      </div>
      <div className="grid grid-cols-4 h-10 shrink-0 border-b border-border bg-secondary">
        {([ ["mixer", <Sliders className="size-5" />, "Mixer overview"], ["decks", <Disc3 className="size-5" />, "Jog wheels"], ["wave", <Activity className="size-5" />, "Waveforms"], ["pads", <Grid3x3 className="size-5" />, "Pads"] ] as const).map(([key, icon, label]) => (
          <button key={key} onClick={() => setMainView(key)} title={label} aria-label={label} aria-pressed={mainView === key} className={`grid place-items-center ${mainView === key ? "text-primary bg-background" : "text-muted-foreground"}`}>{icon}</button>
        ))}
      </div>
      <div key={pair} className="flex-1 min-h-0 flex flex-col relative overflow-hidden bg-background">
         {mainView === "wave" && <div className="absolute right-2 top-2 z-20"><WaveformOptions /></div>}
        {mainView === "decks" && <div className="grid grid-cols-2 h-full items-center justify-items-center overflow-hidden gap-1 px-1">
          <div className="min-w-0"><JogWheel deck={deckLeft} size={jogSize} accent="#ff8a3b" /></div>
          <div className="min-w-0"><JogWheel deck={deckRight} size={jogSize} accent="#3bd2ff" /></div>
        </div>}
        {mainView === "wave" && (vertical ? (
          <div className="flex-1 min-h-0 flex gap-1">
            <div className="flex-1 min-w-0"><Waveform deck={deckLeft} side="left" color="#ff8a3b" /></div>
            <div className="flex-1 min-w-0"><Waveform deck={deckRight} side="right" color="#3bd2ff" /></div>
          </div>
        ) : (<>
        <div className="flex-1 min-h-0 border-b border-[#111]">
          <HorizontalWaveform deck={deckLeft} color="#ff8a3b" index={1} />
        </div>
        <div className="flex-1 min-h-0">
          <HorizontalWaveform deck={deckRight} color="#3bd2ff" index={2} />
        </div>
        </>))}
        {mainView === "pads" && <div className="flex h-full gap-1"><div className="flex-1 min-w-0"><CuePointGrid deck={deckLeft} /></div><div className="flex-1 min-w-0"><CuePointGrid deck={deckRight} /></div></div>}
         {stemsDeck && <div className="absolute inset-2 z-30"><StemsPanel inline deck={stemsDeck} accent="var(--accent-blue)" onClose={() => setStemsDeck(null)} /></div>}
        {mode === "video" && (
          <div className="absolute inset-x-0 top-2 flex justify-center pointer-events-none">
            <div className="pointer-events-auto w-[70%] max-w-[300px]">
              <VideoMixStage deckA={deckLeft} deckB={deckRight} />
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 shrink-0 border-t border-border bg-secondary">
        {[deckLeft, deckRight].map(d => <div key={d.id} className="flex items-center justify-center gap-3 h-9 text-sm font-semibold">{d.id}<PitchMenu deck={d} /><PreCueButton deck={d} /><Button variant="ghost" className="h-7 w-8 p-0" aria-label={`Stems deck ${d.id}`} aria-expanded={stemsDeck === d} onClick={() => setStemsDeck(current => current === d ? null : d)}>S</Button></div>)}
      </div>
      <div className="grid grid-cols-[auto_1fr_auto_1fr_auto] items-center gap-1 h-12 px-2 shrink-0 border-t border-border">
        <SyncButton onClick={() => deckLeft.toggleSync(deckRight)} active={deckLeft.syncLocked} bpm={deckLeft.bpm * deckLeft.rate} accent="#ff8a3b" width={58} height={32} />
        <span className="text-xs tabular-nums text-muted-foreground">{deckLeft.bpm ? deckLeft.bpm.toFixed(1) : "—"} <small>BPM</small></span>
        <Button variant="ghost" onClick={() => { setToolTab("fx"); setSheet("tools"); }} aria-label="Open tools" title="FX, samples, cues, loops and EQ" className="grid size-9 place-items-center rounded-full border border-border bg-secondary"><Sliders className="size-4" /></Button>
        <span className="text-right text-xs tabular-nums text-muted-foreground">{deckRight.bpm ? deckRight.bpm.toFixed(1) : "—"} <small>BPM</small></span>
        <SyncButton onClick={() => deckRight.toggleSync(deckLeft)} active={deckRight.syncLocked} bpm={deckRight.bpm * deckRight.rate} accent="#3bd2ff" width={58} height={32} />
      </div>
      <div className="grid grid-cols-[1fr_1fr] gap-2 px-2 h-10 shrink-0 border-t border-border">
        {[deckLeft, deckRight].map((deck) => <button key={deck.id} onClick={() => deck.triggerCue()} onContextMenu={(e) => { e.preventDefault(); deck.setCue(); }} title="Cue — set while paused, restart while playing" aria-label={`Set or trigger cue deck ${deck.id}`} className="rounded-sm border border-border bg-secondary text-xs font-semibold">{deck.playing ? "CUE ↻" : "SET CUE"}</button>)}
      </div>
      <div className="grid grid-cols-[48px_minmax(0,1fr)_48px] items-center gap-2 px-3 h-[68px] shrink-0 border-t border-border bg-secondary">
        <button aria-label="Play or pause left deck" onClick={() => deckLeft.toggle()} className={`grid size-11 place-items-center rounded-full border border-border ${deckLeft.playing ? "text-primary" : "text-foreground"}`}><Play className="size-5" fill="currentColor" /></button>
        <Crossfader onChange={(v) => mixer.setCrossfade(v)} />
        <button aria-label="Play or pause right deck" onClick={() => deckRight.toggle()} className={`grid size-11 place-items-center rounded-full border border-border ${deckRight.playing ? "text-primary" : "text-foreground"}`}><Play className="size-5" fill="currentColor" /></button>
      </div>

      <BottomSheet open={sheet === "tools"} onClose={() => setSheet(null)} title="Performance tools">
        <div className="flex gap-1 mb-3">
          {(["left", "right"] as const).map((side) => <button key={side} onClick={() => setToolDeck(side)} className={`flex-1 py-2 text-xs border border-border rounded-sm ${toolDeck === side ? "bg-primary text-primary-foreground" : "bg-secondary"}`}>Deck {side === "left" ? deckLeft.id : deckRight.id}</button>)}
        </div>
        <div className="grid grid-cols-6 gap-1 mb-4">
          {(["fx", "samples", "cues", "dna", "loop", "eq"] as const).map((tab) => <button key={tab} onClick={() => setToolTab(tab)} className={`py-2 text-[11px] capitalize rounded-sm ${toolTab === tab ? "bg-primary text-primary-foreground" : "bg-secondary"}`}>{tab === "cues" ? "Hot Cues" : tab === "dna" ? "DNA" : tab}</button>)}
        </div>
        {toolTab === "dna" && <ScratchDnaPanel deck={activeToolDeck} accent="var(--control-blue)" />}
        {toolTab === "loop" && <LoopControls deck={activeToolDeck} />}
        {toolTab === "cues" && <div className="h-[230px]"><CuePointGrid deck={activeToolDeck} /></div>}
        {toolTab === "fx" && <DeckFxPanel key={activeToolDeck.id} deck={activeToolDeck} accent={toolDeck === "left" ? "var(--accent-orange)" : "var(--accent-blue)"} side={toolDeck} compact inline />}
        {toolTab === "samples" && <SamplerPanel mixer={mixer} side={toolDeck} inline />}
        {toolTab === "eq" && <div className="flex justify-center py-3"><DeckEqStrip deck={activeToolDeck} accent={toolDeck === "left" ? "#ff8a3b" : "#3bd2ff"} /></div>}
      </BottomSheet>
      <TrackLibraryOverlay open={libraryDeck !== null} deck={libraryDeck ?? deckLeft} mixer={mixer} onClose={() => setLibraryDeck(null)} />
    </div>
  );
}
