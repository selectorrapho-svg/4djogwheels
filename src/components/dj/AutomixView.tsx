import { useState, useSyncExternalStore } from "react";
import { ArrowLeft, ListMusic, Music, Pause, Play, SkipForward, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import type { Mixer } from "@/lib/dj/engine";
import { getAutomix } from "@/lib/dj/automix";
import { deviceLibrary } from "@/lib/dj/deviceLibrary";
import { useDeck, useRaf } from "@/lib/dj/useMixer";
import { HorizontalWaveform } from "./HorizontalWaveform";
import { TrackOverview } from "./Waveform";
import { TrackLibraryOverlay } from "./TrackLibraryOverlay";
import brandLogo from "@/assets/djogwheels-user-logo-cropped.png";

export function AutomixView({ mixer, onClose }: { mixer: Mixer; onClose: () => void }) {
  const controller = getAutomix(mixer);
  const state = useSyncExternalStore(controller.subscribe, controller.snapshot, controller.snapshot);
  const library = useSyncExternalStore(deviceLibrary.subscribe, deviceLibrary.snapshot, deviceLibrary.snapshot);
  const [openLibrary, setOpenLibrary] = useState(false);
  useDeck(state.deck); useRaf(state.deck.playing);
  const remaining = Math.max(0, state.deck.duration - state.deck.currentTime);
  return <div className="automix-screen fixed inset-0 z-[90] flex flex-col overflow-y-auto bg-background text-foreground">
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-border px-3">
      <Button variant="ghost" onClick={onClose}><ArrowLeft />Mixer</Button><img src={brandLogo} alt="djogwheels PRO" className="h-9 w-24 object-contain" /><Button variant="ghost" onClick={() => setOpenLibrary(true)} aria-label="Automix library"><ListMusic /></Button>
    </header>
    <div className="flex items-center justify-between border-b border-border px-4 py-3"><h1 className="text-lg font-semibold">Automix</h1><Switch aria-label="Enable Automix" checked={state.enabled} disabled={state.busy && !state.enabled} onCheckedChange={on => on ? void controller.start() : controller.stop()} /></div>
    <div className="flex items-center gap-4 bg-secondary px-4 py-6 sm:px-12">
      <div className="grid size-24 shrink-0 place-items-center overflow-hidden rounded-md bg-background sm:size-36">{state.deck.coverUrl ? <img src={state.deck.coverUrl} alt="Album artwork" className="size-full object-cover" /> : <Music className="size-10 text-muted-foreground" />}</div>
      <div className="min-w-0 flex-1"><p className="text-sm text-muted-foreground">Deck {state.deck.id}</p><h2 className="break-words text-xl font-semibold sm:text-2xl">{state.deck.trackName || "No track loaded"}</h2><div className="mt-3 h-10"><TrackOverview deck={state.deck} accent="var(--accent-red)" /></div><p className="mt-1 text-right text-sm tabular-nums text-muted-foreground">-{Math.floor(remaining / 60)}:{Math.floor(remaining % 60).toString().padStart(2, "0")}</p></div>
    </div>
    <div className="h-28 shrink-0 border-y border-border"><HorizontalWaveform deck={state.deck} color="var(--control-blue)" index={state.deck.id === "A" ? 1 : 2} /></div>
    <div className="flex flex-wrap items-center justify-center gap-5 bg-secondary px-4 py-5">
      <Button variant="outline" size="icon" className="size-12 rounded-full" aria-label="Open Automix queue" onClick={() => setOpenLibrary(true)}><ListMusic /></Button>
      <Button variant="outline" size="icon" className="size-16 rounded-full" aria-label="Play or pause Automix" disabled={state.busy && !state.enabled} onClick={() => controller.togglePlayback()}>{state.deck.playing ? <Pause /> : <Play fill="currentColor" />}</Button>
      <Button variant="outline" size="icon" className="size-12 rounded-full" aria-label="Next Automix track" disabled={!state.enabled || state.busy || !library.queue.length} onClick={() => controller.skip()}><SkipForward /></Button>
      <div className="text-lg font-semibold tabular-nums"><small className="block text-[10px] text-muted-foreground">BPM</small>{state.deck.bpm ? (state.deck.bpm * state.deck.rate).toFixed(1) : "—"}</div>
    </div>
    <label className="flex items-center justify-between gap-4 border-b border-border px-4 py-3 text-sm">Transition<select aria-label="Automix transition duration" value={state.fadeSeconds} onChange={e => controller.setDuration(Number(e.target.value))} className="rounded-md bg-secondary px-3 py-2">{[2, 4, 8, 16].map(s => <option key={s} value={s}>{s} seconds</option>)}</select></label>
    {state.error && <p role="alert" className="px-4 py-2 text-destructive">{state.error}</p>}
    <div className="flex items-center justify-between px-4 py-3"><h3 className="text-sm font-semibold">Up next · {library.queue.length}</h3><Button variant="ghost" onClick={() => setOpenLibrary(true)}>Add songs</Button></div>
    {library.queue.map((track, i) => <div key={`${track.filename}-${i}`} className="flex items-center gap-3 border-b border-border px-4 py-3"><span className="text-xs tabular-nums text-muted-foreground">{i + 1}</span><span className="min-w-0 flex-1 truncate text-sm">{track.title}</span><Button variant="ghost" size="icon" aria-label={`Remove ${track.title} from queue`} onClick={() => deviceLibrary.removeQueue(track)}><Trash2 /></Button></div>)}
    <TrackLibraryOverlay open={openLibrary} onClose={() => setOpenLibrary(false)} mixer={mixer} deck={state.deck} queueOnly />
  </div>;
}