import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useSyncExternalStore } from "react";
import { useMixer, useActivePair } from "@/lib/dj/useMixer";
import { TopBar } from "@/components/dj/TopBar";
import { DeckPanel } from "@/components/dj/DeckPanel";
import { CenterColumn } from "@/components/dj/CenterColumn";
import { VideoPreview } from "@/components/dj/VideoPreview";
import { PortraitLayout } from "@/components/dj/PortraitLayout";
import { ThemeToggle } from "@/components/dj/ThemeToggle";
import { SettingsPanel } from "@/components/dj/SettingsPanel";
import { Splash } from "@/components/dj/Splash";
import { usePortrait } from "@/hooks/usePortrait";
import { useTheme } from "@/hooks/useTheme";
import { useAppMode } from "@/hooks/useAppMode";
import { Waveform } from "@/components/dj/Waveform";
import { Crossfader } from "@/components/dj/Crossfader";
import { StudioView } from "@/components/dj/StudioView";
import { AutomixView } from "@/components/dj/AutomixView";
import { getAutomix } from "@/lib/dj/automix";
import { FourDeckLayout } from "@/components/dj/FourDeckLayout";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "mix4deejays — DJ Mixer, Stems, FX & Video" },
      {
        name: "description",
        content: "Pro two-deck offline DJ mixer: scratching, EQ, FX library, free stems, hot cues, sampler, video mixing, sync and recording.",
      },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { property: "og:title", content: "mix4deejays — DJ Mixer" },
      { property: "og:description", content: "Offline DJ app with scratching, stems, FX, and video mixing." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
    links: [{ rel: "manifest", href: "/manifest.webmanifest" }],
  }),
  component: DjApp,
});

function DjApp() {
  const mixer = useMixer();
  const portrait = usePortrait();
  useTheme();
  const [mode, setMode] = useAppMode();
  const [splashDone, setSplashDone] = useState(false);
  const [automixOpen, setAutomixOpen] = useState(false);
  const [studioOpen, setStudioOpen] = useState(false);
  useEffect(() => {
    const open = () => setStudioOpen(true);
    window.addEventListener("dj:studio", open);
    return () => window.removeEventListener("dj:studio", open);
  }, []);
  const changeMode = (next: typeof mode) => { if (mixer) getAutomix(mixer).stop(); setMode(next); };
  const pair = useActivePair(mixer);
  const fourDeck = useSyncExternalStore(
    (l) => (mixer ? mixer.on(l) : () => {}),
    () => mixer?.fourDeck ?? false,
    () => false,
  );

  useEffect(() => {
    if (mixer && splashDone) mixer.resume();
    // Android app: ask for music/video permission right away and fill the library.
    if (splashDone) void import("@/lib/dj/deviceLibrary").then(({ deviceLibrary }) => deviceLibrary.scanNative()).catch(() => {});
  }, [mixer, splashDone]);

  const decks = mixer ? mixer.activeDecks() : null;

  return (
    <>
      {mixer && automixOpen && <AutomixView mixer={mixer} onClose={() => { getAutomix(mixer).stop(); setAutomixOpen(false); }} />}
      {mixer && studioOpen && <StudioView mixer={mixer} onClose={() => setStudioOpen(false)} />}
      {!splashDone && <Splash onDone={() => setSplashDone(true)} />}
      {!mixer || !decks ? (
        <div className="fixed inset-0 bg-background text-foreground flex items-center justify-center">
          <p className="text-sm text-muted-foreground">Loading audio engine…</p>
        </div>
      ) : portrait ? (
        <PortraitLayout mixer={mixer} mode={mode} setMode={changeMode} onAutomix={() => setAutomixOpen(true)} />
      ) : fourDeck ? (
        <FourDeckLayout mixer={mixer} mode={mode} setMode={changeMode} />
      ) : (
        <div className="fixed inset-0 bg-background text-foreground select-none overflow-hidden">
          {mode === "video" ? (
            <div className="absolute inset-0 flex flex-col">
              <div className="relative" data-dj-topbar>
                <TopBar deckA={decks.left} deckB={decks.right} />
                <div className="h-px bg-border" />
                <div className="absolute left-1/2 -translate-x-1/2 top-1 flex items-center gap-1">
                  <SettingsPanel mode={mode} setMode={changeMode} onAutomix={() => setAutomixOpen(true)} />
                  <ThemeToggle />
                </div>
              </div>
              <div className="flex-1 min-h-0 grid grid-rows-[minmax(0,1fr)] grid-cols-[minmax(0,1fr)_minmax(140px,24%)_minmax(0,1fr)] border-b-2 border-border" key={pair}>
                <DeckPanel deck={decks.left} side="left" videoMode={mode === "video"} />
                <CenterColumn deckA={decks.left} deckB={decks.right} mixer={mixer} videoMode={mode === "video"} />
                <DeckPanel deck={decks.right} side="right" videoMode={mode === "video"} />
              </div>
            </div>
          ) : (
            <>
              <div className="absolute inset-0 grid grid-cols-2">
                <div className="relative overflow-hidden border-r border-border">
                  <VideoPreview deck={decks.left} />
                </div>
                <div className="relative overflow-hidden">
                  <VideoPreview deck={decks.right} />
                </div>
              </div>
              <div className="absolute inset-0 bg-background/85" />
              <div className="relative flex flex-col h-full">
                <div className="relative" data-dj-topbar>
                  <TopBar deckA={decks.left} deckB={decks.right} />
                  <div className="h-px bg-border" />
                  <div className="absolute left-1/2 -translate-x-1/2 top-1 flex items-center gap-1">
                    
                    <SettingsPanel mode={mode} setMode={changeMode} onAutomix={() => setAutomixOpen(true)} />
                    <ThemeToggle />
                  </div>
                </div>
                <div className="flex-1 min-h-0 grid grid-rows-[minmax(0,1fr)] grid-cols-[minmax(0,1fr)_minmax(140px,24%)_minmax(0,1fr)] border-b-2 border-border" key={pair}>
                  <DeckPanel deck={decks.left} side="left" />
                  <CenterColumn deckA={decks.left} deckB={decks.right} mixer={mixer} />
                  <DeckPanel deck={decks.right} side="right" />
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </>
  );
}

