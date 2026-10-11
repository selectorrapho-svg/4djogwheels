import { useState } from "react";
import { SlidersVertical, LayoutGrid, Play, Pause, Music } from "lucide-react";
import type { Deck, Mixer } from "@/lib/dj/engine";
import { useDeck } from "@/lib/dj/useMixer";
import { Waveform, TrackOverview } from "./Waveform";
import { Crossfader } from "./Crossfader";
import { SettingsPanel } from "./SettingsPanel";
import { TrackLibraryOverlay } from "./TrackLibraryOverlay";
import { DeckFxPanel } from "./DeckFxPanel";
import type { AppMode } from "@/hooks/useAppMode";
import { PitchMenu } from "./PitchMenu";
import { SyncButton } from "./SyncButton";
import { PreCueButton } from "./PreCueButton";
import { HorizontalWaveform } from "./HorizontalWaveform";
import { useDjSettings } from "@/hooks/useDjSettings";
import { StemsPanel } from "./StemsPanel";
import { Button } from "@/components/ui/button";
import { WaveformOptions } from "./WaveformOptions";
import { TopWaveforms } from "./TopWaveforms";

const fmt = (s: number) => {
  const t = Math.max(0, Math.floor(s));
  return `-${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`;
};

/** djay-style 4-deck landscape: header + upright waveform + SYNC/BPM/CUE per deck. */
function DeckColumn({ deck, mixer, num }: { deck: Deck; mixer: Mixer; num: number }) {
  useDeck(deck);
  const [lib, setLib] = useState(false);
  const [stems, setStems] = useState(false);
  const [settings] = useDjSettings();
  return (
    <div data-deck-panel={deck.id} className="flex flex-col min-h-0 min-w-0 border-r border-border last:border-r-0">
      <div className="flex items-center gap-2 px-2 py-1.5 h-[64px] shrink-0 border-b border-border">
        <button
          onClick={() => setLib(true)}
          className="w-11 h-11 rounded-md overflow-hidden bg-secondary grid place-items-center shrink-0"
          aria-label="Load track"
        >
          {deck.coverUrl ? (
            <img src={deck.coverUrl} alt="" className="w-full h-full object-cover" />
          ) : (
            <Music className="w-5 h-5 text-muted-foreground" />
          )}
        </button>
        <div className="min-w-0 flex-1">
          <div className="text-[12px] truncate">{deck.trackName || "Load track"}</div>
          <div className="text-[15px] font-mono tabular-nums leading-tight">
            {fmt(deck.duration - deck.currentTime)}
          </div>
          <div className="h-2 mt-0.5 overflow-hidden">
            <TrackOverview deck={deck} accent="#e5383b" />
          </div>
        </div>
        <DeckFxPanel deck={deck} accent="#f0a02a" side={num <= 2 ? "left" : "right"} compact />
      </div>
      <div className="relative flex-1 min-h-0">
        <span className="absolute left-2 top-1 z-10 text-[13px] text-muted-foreground">{num}</span>
        {settings.waveOrientation === "horizontal" ? <HorizontalWaveform deck={deck} index={num <= 2 ? 1 : 2} color="var(--accent-red)" /> : <Waveform deck={deck} side={num <= 2 ? "left" : "right"} color="var(--accent-red)" />}
        {stems && <StemsPanel deck={deck} accent="var(--accent-blue)" onClose={() => setStems(false)} />}
      </div>
      <div className="flex items-center justify-between gap-1 px-2 h-[44px] shrink-0 border-t border-border">
        <PitchMenu deck={deck} />
        <SyncButton onClick={() => {
          // Sync to the playing deck on the same side first, then any loaded deck.
          const pool = (num <= 2 ? [mixer.decks.A, mixer.decks.B, mixer.decks.C, mixer.decks.D] : [mixer.decks.C, mixer.decks.D, mixer.decks.A, mixer.decks.B]).filter(d => d !== deck && d.bpm > 0);
          const master = pool.find(d => d.playing && !d.syncLocked) ?? pool.find(d => d.playing) ?? pool[0];
          if (deck.syncLocked || master) deck.toggleSync(master ?? deck);
        }} active={deck.syncLocked} width={44} height={26} />
        <PreCueButton deck={deck} size={26} />
        <Button variant="ghost" className="size-7 p-0" aria-label={`Stems deck ${deck.id}`} aria-expanded={stems} onClick={() => setStems(v => !v)}>S</Button>
        <div className="leading-none text-center">
          <div className="text-[9px] text-muted-foreground">BPM</div>
          <div className="text-[14px] tabular-nums">
            {deck.bpm ? (deck.bpm * deck.rate).toFixed(1) : "--"}
          </div>
        </div>
        <button
          onPointerDown={() => deck.cue()}
          className="px-2 h-8 rounded-md border border-border text-[12px] font-bold"
          style={{ color: "#f0a02a" }}
        >
          CUE
        </button>
      </div>
      <TrackLibraryOverlay open={lib} deck={deck} onClose={() => setLib(false)} />
    </div>
  );
}

function PlayRing({ deck }: { deck: Deck }) {
  useDeck(deck);
  return (
    <button
      onClick={() => deck.toggle()}
      className="w-12 h-12 rounded-full grid place-items-center border-2 active:scale-95"
      style={{ borderColor: "#4ade80", boxShadow: deck.playing ? "0 0 14px #4ade8088" : undefined }}
      aria-label={deck.playing ? "Pause" : "Play"}
    >
      {deck.playing ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current ml-0.5" />}
    </button>
  );
}

function GroupSync({ mixer, side }: { mixer: Mixer; side: "left" | "right" }) {
  const group = side === "left" ? [mixer.decks.A, mixer.decks.B] : [mixer.decks.C, mixer.decks.D];
  useDeck(group[0]);
  useDeck(group[1]);
  return <SyncButton onClick={() => mixer.toggleGroupSync(side)} active={group.every(d => d.syncLocked)} width={56} height={28} />;
}

export function FourDeckLayout({
  mixer,
  mode,
  setMode,
}: {
  mixer: Mixer;
  mode: AppMode;
  setMode: (m: AppMode) => void;
}) {
  const [rec, setRec] = useState(false);
  const [topVisible, setTopVisible] = useState(false);
  const order: Deck[] = [mixer.decks.A, mixer.decks.B, mixer.decks.C, mixer.decks.D];
  return (
    <div className="fixed inset-0 bg-background text-foreground select-none overflow-hidden flex flex-col">
      <div data-dj-topbar className="h-11 shrink-0 flex items-center justify-center gap-8 border-b border-border">
        <SettingsPanel mode={mode} setMode={setMode} />
        <WaveformOptions topVisible={topVisible} onTopVisible={setTopVisible} />
        <SlidersVertical className="w-5 h-5 text-muted-foreground hidden" />
        <button
          onClick={async () => {
            if (rec) {
              const blob = await mixer.stopRecord();
              setRec(false);
              if (blob) {
                const a = document.createElement("a");
                a.href = URL.createObjectURL(blob);
                a.download = `djogpro-mix.${blob.type.includes("mp4") ? "mp4" : "webm"}`;
                a.click();
              }
            } else {
              mixer.startRecord();
              setRec(true);
            }
          }}
          className="w-9 h-9 rounded-full border-2 border-foreground grid place-items-center"
          aria-label="Record"
        >
          <span className="w-3.5 h-3.5 rounded-full" style={{ background: rec ? "#ef4444" : "#f0a02a" }} />
        </button>
        <button onClick={() => mixer.setFourDeck(false)} aria-label="Two decks">
          <LayoutGrid className="w-5 h-5" />
        </button>
      </div>
      {topVisible && <div className="grid shrink-0 grid-cols-2"><TopWaveforms decks={order.slice(0, 2)} /><TopWaveforms decks={order.slice(2)} /></div>}
      <div className="flex-1 min-h-0 grid grid-cols-4">
        {order.map((d, i) => (
          <DeckColumn key={d.id} deck={d} mixer={mixer} num={i + 1} />
        ))}
      </div>
      <div className="grid grid-cols-2 shrink-0 border-t border-border py-1"><div className="flex justify-center"><GroupSync mixer={mixer} side="left" /></div><div className="flex justify-center"><GroupSync mixer={mixer} side="right" /></div></div>
      <div className="h-[72px] shrink-0 border-t border-border grid grid-cols-4 items-center">
        <div className="flex justify-around col-span-1"><PlayRing deck={order[0]} /></div>
        <div className="col-span-2 flex items-center gap-4 px-2">
          <PlayRing deck={order[1]} />
          <div className="flex-1 min-w-0"><Crossfader onChange={(v) => mixer.setCrossfade(v)} /></div>
          <PlayRing deck={order[2]} />
        </div>
        <div className="flex justify-around"><PlayRing deck={order[3]} /></div>
      </div>
    </div>
  );
}
