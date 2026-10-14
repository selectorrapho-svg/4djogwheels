import trackPlaceholder from "@/assets/track-placeholder.jpg";
import { Deck } from "@/lib/dj/engine";
import { useDeck } from "@/lib/dj/useMixer";
import { TrackOverview } from "./Waveform";
import { Music } from "lucide-react";
import { useState } from "react";
import { TrackLibraryOverlay } from "./TrackLibraryOverlay";
import { WaveformOptions } from "./WaveformOptions";
import { TopWaveforms } from "./TopWaveforms";

function TopTrack({ deck, side }: { deck: Deck; side: "left" | "right" }) {
  useDeck(deck);
  const [open, setOpen] = useState(false);
  const remain = Math.max(0, deck.duration - deck.currentTime);
  const fmt = (s: number) => {
    if (!isFinite(s)) return "0:00";
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };
  const accent = side === "left" ? "#ff8a3b" : "#3bd2ff";

  const cover = (
    <button
      onClick={() => setOpen((o) => !o)}
      className="w-9 h-9 rounded-lg flex-shrink-0 bg-white/6 border border-white/12 backdrop-blur-xl flex items-center justify-center"
      style={{ boxShadow: `0 0 10px ${accent}44, inset 0 1px 0 rgba(255,255,255,0.14)` }}
      title="Load track"
    >
      {true ? <img src={deck.coverUrl ?? trackPlaceholder} alt={`${deck.trackName} album cover`} className="size-full rounded-lg object-cover" /> : <Music className="w-4 h-4" style={{ color: accent }} />}
    </button>
  );

  return (
    <div
      className={`relative flex items-center gap-2 flex-1 min-w-0 px-2 h-full ${
        side === "right" ? "flex-row-reverse" : ""
      }`}
    >
      {cover}
      <div className="flex-1 min-w-0 flex flex-col justify-center">
        <div className={`flex items-center justify-between text-[10px] ${side === "right" ? "flex-row-reverse" : ""}`}>
          <span className="truncate text-foreground font-medium">{deck.trackName || "Tap cover to load"}</span>
          <span className="text-muted-foreground tabular-nums mx-1">-{fmt(remain)}</span>
        </div>
        <div className="h-5 mt-0.5">
          <TrackOverview deck={deck} accent={accent} />
        </div>
      </div>
      <TrackLibraryOverlay open={open} deck={deck} onClose={() => setOpen(false)} />
    </div>
  );
}

export function TopBar({ deckA, deckB }: { deckA: Deck; deckB: Deck }) {
  const [topVisible, setTopVisible] = useState(false);
  return (
    <>
    <div className="relative flex items-center h-11 border-b border-border bg-background/40 backdrop-blur-2xl">
      <TopTrack deck={deckA} side="left" />
      <div className="w-px h-10 bg-border" />
      <TopTrack deck={deckB} side="right" />
      <div className="shrink-0 pr-1"><WaveformOptions topVisible={topVisible} onTopVisible={setTopVisible} /></div>
    </div>
    {topVisible && <TopWaveforms decks={[deckA, deckB]} />}
    </>
  );
}
