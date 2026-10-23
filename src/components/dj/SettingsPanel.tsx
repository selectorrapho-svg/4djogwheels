import { useEffect, useRef, useState } from "react";
import { Settings, X, Music2, Video, Layers, Disc3, Circle, Gamepad2, UserRound, ChevronRight, ArrowLeft, FolderOpen, FileAudio } from "lucide-react";
import { deviceLibrary } from "@/lib/dj/deviceLibrary";
import { blobToWav, type RecordingKind, type VideoQuality } from "@/lib/dj/recording";
import { saveRecording } from '@/lib/dj/studioStorage';
import { getMixer } from "@/lib/dj/useMixer";
import { AppMode } from "@/hooks/useAppMode";
import { WAVE_COLORS } from "@/lib/dj/wavedraw";
import { useDjSettings, JOG_STYLES, VIDEO_FX, VIDEO_TRANSITIONS } from "@/hooks/useDjSettings";
import { useTheme, THEMES } from "@/hooks/useTheme";
import { connectMidi, subscribeMidi, MidiInfo } from "@/lib/dj/midi";
import { Portal } from "./Portal";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { AccountPanel } from "./AccountPanel";
import { isPro, whatsappPayUrl, useLicense } from "@/lib/dj/license";
import settingsArtwork from "@/assets/djogwheels-splash-clean.jpg";
import brandLogo from "@/assets/djogwheels-user-logo-cropped.png";
import {
  notify,
  notificationState,
  requestMicrophone,
  requestNotifications,
  requestWakeLock,
  PermState,
} from "@/lib/dj/permissions";

export function SettingsPanel({
  mode,
  setMode,
  onAutomix,
}: {
  mode: AppMode;
  setMode: (m: AppMode) => void;
  onAutomix?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [page, setPage] = useState<"menu" | "account" | "decks" | "appearance" | "playback">("menu");
  const license = useLicense();
  const filesRef = useRef<HTMLInputElement>(null);
  const folderRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState("");
  const [s, setS] = useDjSettings();
  const { theme, setTheme } = useTheme();
  const [recording, setRecording] = useState(false);
  const [cueMode, setCueMode] = useState<"split" | "device">(() => getMixer()?.cueMode ?? "split");
  const [cueDevice, setCueDevice] = useState(() => getMixer()?.cueDeviceId ?? "");
  const [outputs, setOutputs] = useState<MediaDeviceInfo[]>([]);
  const loadOutputs = async () => {
    try { setOutputs((await navigator.mediaDevices.enumerateDevices()).filter(d => d.kind === "audiooutput")); } catch { setOutputs([]); }
  };
  const applyCue = (mode: "split" | "device", id: string) => { setCueMode(mode); setCueDevice(id); getMixer()?.setCueOutput(mode, id); if (mode === "device") void loadOutputs(); };
  const [midi, setMidi] = useState<MidiInfo>({ supported: false, connected: [] });
  useEffect(() => {
    const un = subscribeMidi(setMidi);
    return () => {
      un();
    };
  }, []);
  const [, setTick] = useState(0);
  const [perms, setPerms] = useState<{ notif: PermState; mic: PermState; wake: PermState }>({
    notif: "prompt",
    mic: "prompt",
    wake: "prompt",
  });
  useEffect(() => {
    setPerms((p) => ({ ...p, notif: notificationState() }));
  }, [open]);

  const toggleRecord = async () => {
    const m = getMixer();
    if (!m) return;
    if (recording) {
      let blob = await m.stopRecord();
      setRecording(false);
      if (blob?.size && s.recording.kind === "audio" && s.recording.format === "wav") {
        setStatus("Converting to WAV…");
        try { blob = await blobToWav(blob); setStatus(""); } catch { setStatus("WAV conversion failed — saved as WebM."); }
      }
      if (blob && blob.size) {
        try { setStatus(`Saved ${await saveRecording(`mix-${Date.now()}`,blob)}`); }
        catch { setStatus('Device folder save failed; downloading the recording instead.'); }
        const url = URL.createObjectURL(blob);
        const ext = blob.type.includes("wav") ? "wav" : blob.type.includes("mp4") ? "mp4" : "webm";
        const a = document.createElement("a");
        a.href = url;
        a.download = `mix-${Date.now()}.${ext}`;
        a.click();
        // Free the recording from memory once the download has started.
        setTimeout(() => URL.revokeObjectURL(url), 60_000);
      }
    } else {
      try {
        await m.resume();
        m.startRecord(s.recording);
        setRecording(true);
        setStatus("");
      } catch (error) { setStatus(error instanceof Error ? error.message : "Recording could not start."); }
    }
  };

  return (
    <>
      <Button variant="ghost" size="icon"
        onClick={() => { setPage("menu"); setOpen(true); }}
        className="w-8 h-8 rounded-full flex items-center justify-center dj-glass"
        title="Settings"
      >
        <Settings className="w-4 h-4 text-muted-foreground" />
      </Button>
      {open && (
        <Portal>
        <div
          className="fixed inset-0 z-[280] bg-background flex items-stretch justify-center p-0"
          onClick={() => setOpen(false)}
          style={{ height: "100dvh" }}
        >
          <div
             className="relative isolate settings-sheet w-full max-w-[900px] rounded-none p-3 h-full overflow-y-auto overscroll-contain"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 z-10 -mx-3 mb-3 flex items-center justify-between border-b border-border bg-background/90 px-3 py-2 backdrop-blur">
              <div className="flex items-center gap-2 min-w-0">{page !== "menu" && <Button variant="ghost" size="icon" aria-label="Back to settings" onClick={() => setPage("menu")}><ArrowLeft /></Button>}<img src={brandLogo} alt="djogwheels PRO" className="w-20 h-9 object-contain" /><h2 className="text-sm font-semibold">Settings</h2></div>
              <Button variant="ghost" onClick={() => setOpen(false)} className="shrink-0 text-primary" aria-label="Close settings">
                Done
              </Button>
            </div>

            {page !== "menu" && <div className="sticky top-[53px] z-10 mb-4 grid grid-cols-4 gap-1 border-b border-border bg-background/90 p-1 backdrop-blur" role="tablist" aria-label="Settings categories">
              {([ ["account", "Account"], ["decks", "Decks"], ["appearance", "Appearance"], ["playback", "Audio & video"] ] as const).map(([key, label]) => (
                <Button key={key} role="tab" aria-selected={page === key} variant={page === key ? "default" : "ghost"} onClick={() => setPage(key)} className="h-10 min-w-0 px-1 text-[11px] sm:text-sm">{label}</Button>
              ))}
            </div>}
            <div className="pb-8">
            {page === "menu" && <div className="-mx-3">
              <Button variant="ghost" onClick={() => setPage("account")} className="settings-row h-24 w-full justify-start gap-4 rounded-none px-5 text-base"><span className="settings-avatar grid size-16 shrink-0 place-items-center rounded-full"><UserRound className="size-9" /></span>{license.user?.name ?? "Log in"}<ChevronRight className="ml-auto text-muted-foreground" /></Button>
              <div className="mt-10">
                {onAutomix && <Button variant="ghost" onClick={() => { setOpen(false); onAutomix(); }} className="settings-row h-14 w-full justify-between rounded-none px-5 text-base">Automix<ChevronRight /></Button>}
                <Button variant="ghost" onClick={() => { setOpen(false); window.dispatchEvent(new Event("dj:studio")); }} className="settings-row h-14 w-full justify-between rounded-none px-5 text-base">Studio mode<ChevronRight /></Button>
                {([ ["playback", "Audio & video"], ["decks", "General · decks & controllers"], ["appearance", "Appearance · waveforms"] ] as const).map(([key, label]) => <Button key={key} variant="ghost" onClick={() => setPage(key)} className="settings-row h-14 w-full justify-between rounded-none px-5 text-base">{label}<ChevronRight /></Button>)}
              </div>
            </div>}
            {page === "account" && <>
            <Section title="Subscription">
              {!isPro() ? (
                <div className="relative overflow-hidden rounded-2xl border border-border">
                  <img src={settingsArtwork} alt="" className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-40" />
                  <div className="relative rounded-2xl bg-background/80 p-4 backdrop-blur">
                    <div className="text-sm font-bold uppercase tracking-widest">Go PRO — <span className="text-primary">150 KES / month</span></div>
                    <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                      <li>• Custom logo watermark on video</li>
                      <li>• Record video (360p–1080p) and MP3/WAV audio</li>
                      <li>• Real AI stems separation</li>
                    </ul>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <a href={whatsappPayUrl()} target="_blank" rel="noreferrer"><Button>Pay on WhatsApp</Button></a>
                      <Button variant="outline" onClick={() => setPage("account")}>Account & unlock code</Button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="rounded-2xl border border-primary/60 bg-primary/10 p-4 text-sm font-semibold">PRO active — every feature unlocked.</div>
              )}
            </Section>
            <AccountPanel />
            </>}
            {page === "decks" && <>
            <Section title="Modes & Decks">
              <div className="grid grid-cols-3 landscape:grid-cols-6 gap-2 landscape:gap-3">
                <Tile
                  label="Mix"
                  color="#2f6bff"
                  on={mode === "mix"}
                  icon={<Music2 className="w-5 h-5" />}
                  onClick={() => setMode("mix")}
                />
                <Tile
                  label="Video"
                  color="#d63bd2"
                  on={mode === "video"}
                  icon={<Video className="w-5 h-5" />}
                  onClick={() => setMode("video")}
                />
                <Tile
                  label="4 Decks"
                  color="#12b886"
                  on={!!getMixer()?.fourDeck}
                  icon={<Layers className="w-5 h-5" />}
                  onClick={() => {
                    const m = getMixer();
                    if (m) m.setFourDeck(!m.fourDeck);
                    setTick((t) => t + 1);
                  }}
                />
                <Tile
                  label="A · B"
                  color="#ff8a3b"
                  on={!getMixer()?.fourDeck && getMixer()?.activePair === "AB"}
                  icon={<Disc3 className="w-5 h-5" />}
                  onClick={() => {
                    const m = getMixer();
                    if (!m) return;
                    m.setFourDeck(false);
                    m.setActivePair("AB");
                    setTick((t) => t + 1);
                  }}
                />
                <Tile
                  label="C · D"
                  color="#3bd2ff"
                  on={!getMixer()?.fourDeck && getMixer()?.activePair === "CD"}
                  icon={<Disc3 className="w-5 h-5" />}
                  onClick={() => {
                    const m = getMixer();
                    if (!m) return;
                    m.setFourDeck(false);
                    m.setActivePair("CD");
                    setTick((t) => t + 1);
                  }}
                />
                <Tile
                  label={recording ? "Stop" : isPro() ? "Rec" : "Rec 🔒"}
                  color="#ff3b3b"
                  on={recording}
                  icon={<Circle className="w-5 h-5" fill={recording ? "#ff3b3b" : "transparent"} />}
                   onClick={() => setPage("playback")}
                />
              </div>
            </Section>
            <Section title="DJ Controller (MIDI)">
              <Button variant="outline" onClick={() => { const m = getMixer(); if (m) void connectMidi(m); }} className="w-full flex items-center gap-2 text-xs uppercase">
                <Gamepad2 className="w-4 h-4" />{midi.connected.length ? "Rescan controllers" : "Connect controller"}
              </Button>
              <div className="text-[10px] text-muted-foreground mt-2 leading-relaxed">
                {!midi.supported ? "Web MIDI requires Chrome or Edge on a compatible device." : midi.connected.length ? `Connected: ${midi.connected.join(", ")}` : "No controller detected — connect via USB/OTG and tap rescan."}
              </div>
            </Section>
            </>}

            {page === "appearance" && <>
            <Section title="App Skin / Theme">
              <div className="grid grid-cols-2 gap-2">
                {THEMES.map((t) => (
                  <Pill key={t} on={theme === t} onClick={() => setTheme(t)}>
                    {t}
                  </Pill>
                ))}
              </div>
            </Section>

            <Section title="Jog Wheel Style">
              <select aria-label="Jogwheel style" value={s.jogStyle} onChange={event => setS({ jogStyle: JOG_STYLES.find(style => style.key === event.target.value)?.key ?? "silver" })} className="w-full rounded-md border border-border bg-secondary px-3 py-2 text-sm text-foreground">
                {JOG_STYLES.map(style => <option key={style.key} value={style.key}>{style.label}</option>)}
              </select>
            </Section>

            <Section title="Scratch & crossfader">
              <label className="mb-3 flex items-center justify-between text-xs text-muted-foreground">Crossfader cut (spring-back)<Switch checked={s.xfCut} onCheckedChange={checked => setS({ xfCut: checked })} /></label>
              <label className="mb-3 flex items-center justify-between text-xs text-muted-foreground">Reverse crossfader (hamster)<Switch checked={s.xfReverse} onCheckedChange={checked => setS({ xfReverse: checked })} /></label>
              <label className="mb-3 flex items-center justify-between text-xs text-muted-foreground">Vinyl mode<Switch checked={s.scratch.vinylMode} onCheckedChange={checked => setS({ scratch: { ...s.scratch, vinylMode: checked } })} /></label>
              <label className="mb-3 block text-[10px] uppercase tracking-widest text-muted-foreground">Crossfader curve
                <select value={s.xfCurve} onChange={e => setS({ xfCurve: e.target.value as typeof s.xfCurve })} className="mt-1 w-full rounded-sm border border-border bg-secondary px-2 py-2 text-xs text-foreground">
                  <option value="smooth">Smooth</option><option value="linear">Linear</option><option value="cut">Cut</option><option value="scratch">Scratch</option>
                </select>
              </label>
              <label className="mb-3 block text-[10px] uppercase tracking-widest text-muted-foreground">Release
                <select value={s.scratch.release} onChange={e => setS({ scratch: { ...s.scratch, release: e.target.value as typeof s.scratch.release } })} className="mt-1 w-full rounded-sm border border-border bg-secondary px-2 py-2 text-xs text-foreground">
                  <option value="motor">Motor spin-up</option><option value="instant">Instant play</option><option value="coast">Coast</option>
                </select>
              </label>
              {([["sensitivity", "Sensitivity", 0.25, 3, 0.05], ["friction", "Friction", 0, 1, 0.05], ["inertia", "Spin-up time (s)", 0, 1, 0.02], ["brake", "Brake time (s)", 0.1, 3, 0.05]] as const).map(([k, label, min, max, step]) => (
                <label key={k} className="mb-2 block text-[10px] uppercase tracking-widest text-muted-foreground">{label}: {s.scratch[k].toFixed(2)}
                  <input type="range" min={min} max={max} step={step} value={s.scratch[k]} onChange={e => setS({ scratch: { ...s.scratch, [k]: Number(e.target.value) } })} className="mt-1 w-full" />
                </label>
              ))}
              <label className="mt-2 block text-[10px] uppercase tracking-widest text-muted-foreground">Stems panel sliders
                <select value={s.stemsEqMode} onChange={e => setS({ stemsEqMode: e.target.value as typeof s.stemsEqMode })} className="mt-1 w-full rounded-sm border border-border bg-secondary px-2 py-2 text-xs text-foreground">
                  <option value="stems">Stems</option><option value="eq">EQ</option>
                </select>
              </label>
            </Section>

            <Section title="Waveform">
              <label className="mb-3 flex items-center justify-between text-xs text-muted-foreground">High contrast<Switch checked={s.waveHighContrast} onCheckedChange={checked => setS({ waveHighContrast: checked })} /></label>
              <label className="mb-3 flex items-center justify-between text-xs text-muted-foreground">Waveform scratch<Switch checked={s.waveScratch} onCheckedChange={checked => setS({ waveScratch: checked })} /></label>
              <div className="grid grid-cols-2 gap-2">
                <label className="text-[10px] uppercase tracking-widest text-muted-foreground">Direction
                  <select value={s.waveOrientation} onChange={(e) => setS({ waveOrientation: e.target.value as typeof s.waveOrientation })} className="mt-1 w-full rounded-sm border border-border bg-secondary px-2 py-2 text-xs text-foreground">
                    <option value="vertical">Vertical</option>
                    <option value="horizontal">Horizontal</option>
                  </select>
                </label>
                <label className="text-[10px] uppercase tracking-widest text-muted-foreground">Colour
                  <select value={s.waveColor} onChange={(e) => setS({ waveColor: e.target.value })} className="mt-1 w-full rounded-sm border border-border bg-secondary px-2 py-2 text-xs text-foreground">
                    {WAVE_COLORS.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
                  </select>
                </label>
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {WAVE_COLORS.map((c) => (
                  <button key={c.key} type="button" aria-label={c.label} onClick={() => setS({ waveColor: c.key })}
                    className={`h-6 w-6 rounded-full border-2 ${s.waveColor === c.key ? "border-foreground" : "border-transparent"}`}
                    style={{ background: c.rgb ? `rgb(${c.rgb.join(",")})` : "conic-gradient(red, orange, yellow, lime, cyan, blue, magenta, red)" }} />
                ))}
              </div>
            </Section>
            </>}

            {page === "playback" && <>
            <Section title="Recording">
              <div className="grid grid-cols-2 gap-3">
                <label className="text-xs text-muted-foreground">Record
                  <select aria-label="Recording type" disabled={recording} value={s.recording.kind} onChange={e => setS({ recording: { ...s.recording, kind: e.target.value as RecordingKind } })} className="mt-1 h-10 w-full rounded-md border border-border bg-secondary px-2 text-foreground"><option value="audio">Audio</option><option value="video">Video</option></select>
                </label>
                <label className="text-xs text-muted-foreground">{s.recording.kind === "video" ? "Video quality" : "Audio quality"}
                  {s.recording.kind === "video" ? <select aria-label="Video quality" disabled={recording} value={s.recording.videoQuality} onChange={e => setS({ recording: { ...s.recording, videoQuality: e.target.value as VideoQuality } })} className="mt-1 h-10 w-full rounded-md border border-border bg-secondary px-2 text-foreground">{[360, 480, 720, 1080].map(q => <option key={q} value={q}>{q}p</option>)}</select> : <select aria-label="Audio quality" disabled={recording} value={s.recording.audioKbps} onChange={e => setS({ recording: { ...s.recording, audioKbps: Number(e.target.value) as 96 | 192 | 320 } })} className="mt-1 h-10 w-full rounded-md border border-border bg-secondary px-2 text-foreground">{[96, 192, 320].map(q => <option key={q} value={q}>{q} kbps</option>)}</select>}
                </label>
              </div>
              {s.recording.kind === "audio" && <label className="mt-3 block text-xs text-muted-foreground">File format
                <select aria-label="Recording format" disabled={recording} value={s.recording.format ?? "webm"} onChange={e => setS({ recording: { ...s.recording, format: e.target.value as "webm" | "wav" } })} className="mt-1 h-10 w-full rounded-md border border-border bg-secondary px-2 text-foreground"><option value="webm">WebM (small)</option><option value="wav">WAV (lossless)</option></select>
              </label>}
              <p className="mt-2 text-[11px] text-muted-foreground">Recording works fully offline and saves to your device.</p>
              <label className="my-3 flex items-center justify-between text-xs text-muted-foreground">Low storage<Switch disabled={recording} checked={s.recording.lowStorage} onCheckedChange={checked => setS({ recording: { ...s.recording, lowStorage: checked } })} /></label>
              <Button variant={recording ? "destructive" : "outline"} className="w-full" onClick={isPro() ? toggleRecord : () => setPage("account")}><Circle />{recording ? "Stop & save recording" : isPro() ? "Start recording" : "Recording · unlock PRO"}</Button>
            </Section>
            <Section title="Headphones (pre-cue)">
              <label className="block text-xs text-muted-foreground">Cue output
                <select aria-label="Cue output" value={cueMode} onChange={e => applyCue(e.target.value as "split" | "device", cueDevice)} className="mt-1 h-10 w-full rounded-md border border-border bg-secondary px-2 text-foreground"><option value="split">Split cable · left ear master, right ear cue</option><option value="device">Separate output (USB / Bluetooth)</option></select>
              </label>
              {cueMode === "device" && <label className="mt-2 block text-xs text-muted-foreground">Headphone device
                <select aria-label="Headphone device" value={cueDevice} onFocus={() => void loadOutputs()} onChange={e => applyCue("device", e.target.value)} className="mt-1 h-10 w-full rounded-md border border-border bg-secondary px-2 text-foreground"><option value="">Default output</option>{outputs.filter(d => d.deviceId && d.deviceId !== "default").map(d => <option key={d.deviceId} value={d.deviceId}>{d.label || "Audio output"}</option>)}</select>
              </label>}
              <p className="mt-2 text-[11px] text-muted-foreground">Tap the headphone button on a deck to hear it before the crowd does.</p>
            </Section>
            <Section title="Video">
              <label className="flex items-center justify-between text-xs text-muted-foreground">
                Floating video screens
                <Switch
                  checked={s.floatingVideo}
                  onCheckedChange={checked => setS({ floatingVideo: checked })} />
              </label>
              <label className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                Follow crossfader
                <Switch checked={s.videoFollowCrossfader} onCheckedChange={checked => setS({ videoFollowCrossfader: checked })} />
              </label>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <label className="text-[10px] uppercase tracking-widest text-muted-foreground">Transition
                  <select value={s.videoTransition} onChange={(e) => setS({ videoTransition: e.target.value as typeof s.videoTransition })} className="mt-1 w-full rounded-sm border border-border bg-secondary px-2 py-2 text-xs text-foreground">
                    {VIDEO_TRANSITIONS.map((item) => <option key={item.key} value={item.key}>{item.label}</option>)}
                  </select>
                </label>
                <label className="text-[10px] uppercase tracking-widest text-muted-foreground">Video FX
                  <select value={s.videoFx} onChange={(e) => setS({ videoFx: e.target.value as typeof s.videoFx })} className="mt-1 w-full rounded-sm border border-border bg-secondary px-2 py-2 text-xs text-foreground">
                    {VIDEO_FX.map((item) => <option key={item.key} value={item.key}>{item.label}</option>)}
                  </select>
                </label>
              </div>
              <label className="flex items-center justify-between text-xs text-muted-foreground mt-2">
                Use logo watermark
                <Switch
                  checked={s.watermarkLogo}
                  onCheckedChange={checked => setS({ watermarkLogo: checked })} />
              </label>
            </Section>


            <Section title={isPro() ? "Video Watermark (Pro)" : "Video Watermark (Pro — upgrade to use your own)"}>
              {isPro() ? (<>
              <label className="flex items-center justify-between text-xs text-muted-foreground mb-2">
                Show watermark
                <Switch
                  checked={s.showWatermark}
                  onCheckedChange={checked => setS({ showWatermark: checked })} />
              </label>
              <input
                type="text"
                value={s.watermarkText}
                onChange={(e) => setS({ watermarkText: e.target.value })}
                placeholder="Custom watermark"
                className="w-full rounded-sm border border-border bg-secondary px-2 py-1.5 text-xs"
              />
              </>) : (
                <p className="text-xs text-muted-foreground">Free version uses the DjogPro logo. Unlock PRO to add your own logo.</p>
              )}
            </Section>

            <Section title="Scratch">
              <label className="flex items-center justify-between text-xs text-muted-foreground">
                Key lock (preserve pitch)
                <Switch
                  checked={s.keyLock}
                  onCheckedChange={checked => setS({ keyLock: checked })} />
              </label>
              <label className="flex items-center justify-between text-xs text-muted-foreground mt-2">
                Brake when pausing (turntable stop)
                <Switch
                  checked={s.brakeOnPause}
                  onCheckedChange={checked => setS({ brakeOnPause: checked })} />
              </label>
            </Section>

            <Section title="Permissions & Notifications">
              <input ref={filesRef} type="file" multiple accept="audio/*,video/*" className="hidden" aria-label="Import media files" onChange={async e => { const files = Array.from(e.target.files ?? []); await deviceLibrary.addFiles(files); setStatus(`${files.length} files added to library.`); e.target.value = ""; }} />
              <input ref={folderRef} type="file" multiple {...{ webkitdirectory: "" }} className="hidden" aria-label="Import media folder" onChange={async e => { const files = Array.from(e.target.files ?? []); await deviceLibrary.addFiles(files); setStatus(`${files.length} files selected from folder.`); e.target.value = ""; }} />
              <div className="mb-3 grid grid-cols-2 gap-2"><Button variant="outline" onClick={() => filesRef.current?.click()}><FileAudio />Files</Button><Button variant="outline" onClick={async () => { try { if (!(await deviceLibrary.openDirectory())) folderRef.current?.click(); else setStatus("Folder access granted. Library updated."); } catch (error) { if (!(error instanceof DOMException && error.name === "AbortError")) setStatus("Folder access was not granted."); } }}><FolderOpen />Folders</Button></div>
              <div className="grid grid-cols-2 gap-2">
                <PermButton
                  label={`Notifications${perms.notif === "granted" ? " ✓" : ""}`}
                  onClick={async () => {
                    const r = await requestNotifications();
                    setPerms((p) => ({ ...p, notif: r }));
                    if (r === "granted") notify("DjogPro", "Notifications are on. Mix alerts enabled.");
                  }}
                />
                <PermButton
                  label={`Microphone${perms.mic === "granted" ? " ✓" : ""}`}
                  onClick={async () => {
                    const mic = await requestMicrophone();
                    setPerms((p) => ({ ...p, mic }));
                  }}
                />
                <PermButton
                  label={`Keep screen on${perms.wake === "granted" ? " ✓" : ""}`}
                  onClick={async () => {
                    const wake = await requestWakeLock();
                    setPerms((p) => ({ ...p, wake }));
                  }}
                />
                <PermButton
                  label="Test notification"
                  onClick={() => notify("DjogPro", "This is how mix alerts will look.")}
                />
              </div>
              <div className="mt-2 text-[10px] leading-relaxed text-muted-foreground">
                Music files are read straight from your device — no storage permission needed for the picker.
                Notifications and microphone are asked for only when you tap them.
              </div>
            </Section>
            </>}
            {status && <p role="status" className="mt-3 text-xs text-muted-foreground">{status}</p>}
            </div>

            <div className="text-[10px] text-muted-foreground mt-2">
              <span className="text-foreground font-bold">Djog</span>
              <span className="text-primary font-bold">Pro</span> — offline DJ mixer.
            </div>
          </div>
        </div>
        </Portal>
      )}
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-4">
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-2">{title}</div>
      {children}
    </div>
  );
}
function Pill({
  on,
  onClick,
  children,
}: {
  on: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <Button variant="ghost" onClick={onClick} aria-pressed={on}
      className={`min-h-9 h-auto px-2 py-1.5 rounded-md text-[11px] whitespace-normal ${on ? "dj-glass-on text-primary" : "dj-glass text-muted-foreground"}`}>
      {children}
    </Button>
  );
}

function Tile({
  label,
  color,
  on,
  icon,
  onClick,
}: {
  label: string;
  color: string;
  on: boolean;
  icon: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center justify-center gap-1 py-3 rounded-2xl dj-glass"
      style={{
        background: `${color}${on ? "55" : "22"}`,
        boxShadow: on ? `0 0 14px ${color}88, var(--glass-shadow)` : "var(--glass-shadow)",
        color: on ? color : "var(--foreground)",
      }}
    >
      {icon}
      <span className="text-[10px] font-bold uppercase tracking-widest">{label}</span>
    </button>
  );
}

function PermButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="rounded-xl dj-glass px-2 py-2.5 text-[10px] font-bold uppercase tracking-widest"
    >
      {label}
    </button>
  );
}
