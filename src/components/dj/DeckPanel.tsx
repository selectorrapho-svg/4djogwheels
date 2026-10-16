import { Deck } from "@/lib/dj/engine";
import { useDeck, getMixer } from "@/lib/dj/useMixer";
import { JogWheel } from "./JogWheel";
import { DeckSlider } from "./DeckSlider";
import { DeckTools } from "./DeckTools";
import { SyncButton } from "./SyncButton";
import { PreCueButton } from "./PreCueButton";

import { Pause, Play, ChevronLeft, ChevronRight, ChevronDown, Repeat, Check } from "lucide-react";
import { useState } from "react";
import { VideoPreview } from "./VideoPreview";
import { StemsPanel } from "./StemsPanel";
import { Button } from "@/components/ui/button";

const LOOP_LENGTHS = ["1/32", "1/16", "1/8", "1/4", "1/2", "1", "2", "4", "8", "16", "32"];
const LOOP_BEATS = [1 / 32, 1 / 16, 1 / 8, 1 / 4, 1 / 2, 1, 2, 4, 8, 16, 32];
const LOOP_MODES = ["Auto / In-Out", "Manual / Skip", "Auto (1-32)"];

interface Props {
  deck: Deck;
  side: "left" | "right";
  compact?: boolean;
  videoMode?: boolean;
}

export function DeckPanel({ deck, side, compact, videoMode }: Props) {
  useDeck(deck);
  const accent = side === "left" ? "#ff8a3b" : "#3bd2ff";
  const [showVideo, setShowVideo] = useState(true);
  const [stemsOpen, setStemsOpen] = useState(false);
  const [loopIdx, setLoopIdx] = useState(7); // default "4"
  const [loopMenuOpen, setLoopMenuOpen] = useState(false);
  const [loopMode, setLoopMode] = useState(LOOP_MODES[0]);

  return (
    <div data-deck-panel={deck.id} className={`flex gap-2 h-full min-h-0 overflow-hidden ${compact ? "px-1 py-1" : "px-2 py-2"}`}>
      {side === "left" && !compact && <SideStrip deck={deck} accent={accent} side={side} compact={compact} />}

      <div className="relative flex-1 flex flex-col items-center justify-between min-w-0">
        {/* top row */}
        <div className="w-full flex items-center justify-between gap-1 text-[10px] uppercase tracking-widest">
          {/* djay-style loop group: ‹ | ↻ beats | › + mode dropdown */}
          <div className="relative flex items-center gap-0.5">
            <div
              className="flex items-stretch h-7 rounded-lg overflow-hidden"
              style={{ border: "1px solid var(--glass-border)", background: "var(--glass)" }}
            >
              <button
                onClick={() => {
                  const nextIdx = Math.max(0, loopIdx - 1);
                  setLoopIdx(nextIdx);
                  if (deck.loopActive) deck.setLoopBeats(LOOP_BEATS[nextIdx]);
                }}
                className="w-6 grid place-items-center text-muted-foreground"
                aria-label="Halve loop length"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => deck.toggleLoop(LOOP_BEATS[loopIdx])}
                className="px-2 grid place-items-center tabular-nums min-w-[46px] font-semibold text-[11px]"
                style={{
                  borderLeft: "1px solid var(--glass-border)",
                  borderRight: "1px solid var(--glass-border)",
                  color: deck.loopActive ? "#f0a02a" : "var(--foreground)",
                  background: deck.loopActive ? "rgba(240,160,42,0.16)" : "transparent",
                }}
                title={deck.loopActive ? "Loop ON — tap to exit" : "Tap to set loop"}
              >
                <span className="flex items-center gap-1">
                  <Repeat className="w-3 h-3" />
                  {LOOP_LENGTHS[loopIdx]}
                </span>
              </button>
              <button
                onClick={() => {
                  const nextIdx = Math.min(LOOP_LENGTHS.length - 1, loopIdx + 1);
                  setLoopIdx(nextIdx);
                  if (deck.loopActive) deck.setLoopBeats(LOOP_BEATS[nextIdx]);
                }}
                className="w-6 grid place-items-center text-muted-foreground"
                aria-label="Double loop length"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
            {/* loop mode dropdown */}
            <button
              onClick={() => setLoopMenuOpen((o) => !o)}
              className="grid h-7 w-6 place-items-center rounded-lg text-muted-foreground"
              style={{ border: "1px solid var(--glass-border)", background: "var(--glass)" }}
              aria-label="Loop mode"
            >
              <ChevronDown className="w-3.5 h-3.5" />
            </button>
            {loopMenuOpen && (
              <div
                className="absolute left-0 top-8 z-40 min-w-[130px] overflow-hidden rounded-md py-1"
                style={{ border: "1px solid var(--glass-border)", background: "var(--glass)", backdropFilter: "blur(12px)" }}
              >
                {LOOP_MODES.map((m) => (
                  <button
                    key={m}
                    onClick={() => {
                      setLoopMode(m);
                      setLoopMenuOpen(false);
                    }}
                    className="flex w-full items-center justify-between px-3 py-1.5 text-[11px] normal-case tracking-normal text-foreground hover:bg-secondary"
                  >
                    {m}
                    {loopMode === m && <Check className="w-3.5 h-3.5 text-primary" />}
                  </button>
                ))}
              </div>
            )}
          </div>
          <SyncButton
            onClick={() => {
              const m = getMixer();
              if (!m) return;
              const pair = m.activeDecks();
              const other = side === "left" ? pair.right : pair.left;
              deck.toggleSync(other);
            }}
            active={deck.syncLocked}
            bpm={deck.bpm * deck.rate}
            accent={accent}
            width={compact ? 48 : 58}
            height={deck.syncLocked ? 30 : 24}
          />
          <PreCueButton deck={deck} size={24} />
        </div>

        {/* jog — hidden in 4-deck mode so waveforms get the room */}
        {compact ? (
          <div className="flex-1 min-h-0 w-full flex flex-col items-center justify-center gap-1">
            <div className="text-[10px] text-muted-foreground truncate max-w-full px-1">
              {deck.trackName || "No track"}
            </div>
            <div className="text-lg tabular-nums font-light" style={{ color: accent }}>
              {deck.bpm ? (deck.bpm * deck.rate).toFixed(1) : "—"}
            </div>
          </div>
        ) : (
          <div className="flex-1 min-h-0 flex items-center justify-center w-full py-1 relative landscape-jog-slot">
            {videoMode && <Button variant="ghost" size="icon" className="absolute top-1 left-1 z-10 dj-glass rounded-full" aria-label={`${showVideo ? "Hide" : "Show"} video deck ${deck.id}`} aria-expanded={showVideo} onClick={() => setShowVideo(v => !v)}><ChevronDown className={showVideo ? "" : "rotate-180"} /></Button>}
            {videoMode && showVideo ? <div className="deck-video-preview relative w-full h-full overflow-hidden rounded-md bg-background"><VideoPreview deck={deck} />{!deck.videoEl && <span className="absolute inset-0 grid place-items-center text-xs text-muted-foreground">Deck {deck.id} video</span>}</div> : <JogWheel deck={deck} size={244} accent={accent} />}
          </div>
        )}

        {/* transport — stays inside the panel on small landscape screens */}
        <div className="w-full shrink-0 grid grid-cols-4 items-center gap-1 text-[10px] landscape-transport">
          <Button variant="ghost"
            onClick={() => deck.toggle()}
            aria-label={`${deck.playing ? "Pause" : "Play"} deck ${deck.id}`}
            className={`transport-play shrink-0 rounded-full flex items-center justify-center ${compact ? "h-10" : "h-11"} ${deck.playing ? "dj-glass-on transport-playing" : "dj-glass"}`}
            title="Play / Pause"
          >
            {deck.playing ? <Pause className="size-5" fill="currentColor" /> : <Play className="size-5" fill="currentColor" />}
          </Button>
          <Button variant="ghost"
            onClick={() => deck.setCue()}
            className={`shrink-0 rounded-md dj-glass uppercase tracking-widest font-bold ${compact ? "px-1 h-10 text-[10px]" : "px-1 h-11 text-[11px]"}`}
            title="Set cue point at current position"
          >
            Set
          </Button>
          <Button variant="ghost"
            onPointerDown={() => {
              deck.seek(deck.cuePoint);
              deck.play();
            }}
            onPointerUp={() => {
              deck.pause();
              deck.seek(deck.cuePoint);
            }}
            onPointerCancel={() => { deck.pause(); deck.seek(deck.cuePoint); }}
            className={`shrink-0 rounded-md dj-glass flex items-center justify-center ${compact ? "h-10" : "h-11"}`}
            title="Hold to preview from cue"
          >
            <Repeat className="w-4 h-4" style={{ color: accent }} />
          </Button>
          <Button variant="ghost"
            onClick={() => setStemsOpen((o) => !o)}
            className={`shrink-0 rounded-xl flex items-center justify-center font-bold text-sm ${compact ? "h-10" : "h-11"} ${
              stemsOpen ? "dj-glass-on" : "dj-glass"
            }`}
            style={{ color: accent }}
            title="Stems sliders"
             aria-label={`Stems deck ${deck.id}`}
            aria-expanded={stemsOpen}
          >
            S
          </Button>
        </div>
        {stemsOpen && <StemsPanel deck={deck} accent={accent} onClose={() => setStemsOpen(false)} />}


        {/* hot cues live in the per-deck Cues drawer (side strip) */}

      </div>

      {side === "right" && <SideStrip deck={deck} accent={accent} side={side} compact={compact} />}
    </div>

  );
}

function SideStrip({ deck, accent, side, compact }: { deck: Deck; accent: string; side: "left" | "right"; compact?: boolean }) {
  return (
    <div
      className={`flex flex-col items-center min-h-0 overflow-hidden ${compact ? "gap-1" : "gap-2"} ${
        side === "left" ? "order-first" : "order-last"
      }`}
    >
      <div className="text-[9px] uppercase tracking-widest" style={{ color: deck.syncLocked ? accent : "var(--muted-foreground)" }}>{deck.syncLocked ? "Synced" : "BPM"}</div>
      <div className={`${compact ? "text-[11px]" : "text-sm"} font-medium`} style={{ color: accent }}>
        {deck.bpm ? (deck.bpm * deck.rate).toFixed(1) : "—"}
      </div>
      <DeckSlider deck={deck} height={compact ? 70 : 120} />
      <div className="flex flex-col items-center gap-1">
        <DeckTools deck={deck} accent={accent} side={side} />
      </div>



    </div>
  );
}
