import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Download, Save, FolderOpen, X, Plus, Play, Square, Repeat, Trash2, Magnet, Scissors, Copy, ClipboardPaste, SplitSquareHorizontal, ZoomIn, ZoomOut, CopyPlus, RotateCcw, SlidersHorizontal, Link2, Undo2, Redo2, SkipBack, SkipForward, Eraser, MousePointer2, Minus, Activity, Crosshair } from "lucide-react";
import { computeBandedPeaks } from "@/lib/dj/engine";
import { buildRgbStrip } from "@/lib/dj/rgbWave";
import { Button } from "@/components/ui/button";
import type { Mixer } from "@/lib/dj/engine";
import { splitClip, trimClip, clipSource, clipDuration, studioGridStep, studioPitch, studioPlacement, syncClip, studioDuration, studioSchedule, studioWav, type StudioClip } from "@/lib/dj/studio";
import { connectStudioFx, prepareStudioClip } from "@/lib/dj/studioAudio";
import { saveStudioProject, listStudioProjects, loadStudioProject, saveRecording, type StudioProjectInfo } from '@/lib/dj/studioStorage';
import { Input } from '@/components/ui/input';
import { ContextMenu, ContextMenuTrigger, ContextMenuContent, ContextMenuItem, ContextMenuSeparator } from "@/components/ui/context-menu";

const ALL_STEMS = { bass: true, drums: true, vocals: true, other: true };
const LANE_COLORS = ["var(--studio-1)", "var(--studio-2)", "var(--studio-3)", "var(--studio-4)", "var(--studio-5)", "var(--studio-6)"];

function ClipWave({ buffer, width }: { buffer: AudioBuffer; width: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const cv = ref.current; if (!cv) return;
    const w = Math.max(1, Math.round(width)), h = 44;
    cv.width = w; cv.height = h;
    const g = cv.getContext("2d"); if (!g) return;
    g.clearRect(0, 0, w, h);
    // Same full-spectrum RGB renderer as the decks (low red, mid green, high blue).
    const strip = buildRgbStrip(computeBandedPeaks(buffer, Math.min(8000, Math.max(64, w * 2))), ALL_STEMS, "x");
    if (!strip) return;
    // Zigzag contour: each 3px column alternates between its real peak and
    // trough from the raw samples, so zooming in shows sharp jagged edges.
    const data = buffer.getChannelData(0);
    const step = 3, cols = Math.ceil(w / step), per = data.length / cols, mid = h / 2;
    g.beginPath();
    g.moveTo(0, mid);
    const lows: number[] = [];
    for (let i = 0; i < cols; i++) {
      const a = Math.floor(i * per), b = Math.min(data.length, Math.floor((i + 1) * per));
      let mx = 0, mn = 0;
      for (let j = a; j < b; j += Math.max(1, Math.floor((b - a) / 256))) { const v = data[j]; if (v > mx) mx = v; else if (v < mn) mn = v; }
      const x = i * step + step / 2;
      const top = i % 2 ? mx * 0.55 : mx;
      const bot = i % 2 ? mn : mn * 0.55;
      g.lineTo(x, mid - Math.min(1, top) * mid);
      lows.push(x, mid - Math.max(-1, bot) * mid);
    }
    g.lineTo(w, mid);
    for (let k = lows.length - 2; k >= 0; k -= 2) g.lineTo(lows[k], lows[k + 1]);
    g.closePath();
    g.save(); g.clip();
    g.imageSmoothingEnabled = true; g.drawImage(strip.canvas, 0, 0, w, h);
    g.restore();
  }, [buffer, width]);
  return <canvas ref={ref} className="pointer-events-none h-11 w-full" />;
}

/** ACID / Serato Studio-style arrangement: one lane per imported loop or song. */
export function StudioView({ mixer, onClose }: { mixer: Mixer; onClose: () => void }) {
  const ctx = mixer.ctx;
  const [clips, setClips] = useState<StudioClip[]>([]);
  const [bpm, setBpm] = useState(120);
  const [playing, setPlaying] = useState(false);
  const [loop, setLoop] = useState(false);
  const [snap, setSnap] = useState(true);
  const [head, setHead] = useState(0);
  const [busy, setBusy] = useState("");
  const [projectName, setProjectName] = useState('Untitled');
  const [projects, setProjects] = useState<StudioProjectInfo[]>([]);
  const [filesOpen, setFilesOpen] = useState(false);
  const [fileStatus, setFileStatus] = useState('');
  const [PX_PER_BEAT, setPx] = useState(28);
  const [sel, setSel] = useState<number | null>(null);
  const clip = useRef<StudioClip | null>(null);
  const [hasClip, setHasClip] = useState(false);
  const [laneCount, setLaneCount] = useState(1);
  const [editOpen, setEditOpen] = useState(false);
  const [cutTool, setCutTool] = useState(false);
  const [eraseTool, setEraseTool] = useState(false);
  const history = useRef<{ past: StudioClip[][]; future: StudioClip[][] }>({ past: [], future: [] });
  const [, forceHistory] = useState(0);
  const taps = useRef<number[]>([]);
  const [trim, setTrim] = useState<{ id: number; left: number; width: number } | null>(null);
  const timelineRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const generation = useRef(0);
  const zoomRef = useRef(PX_PER_BEAT); zoomRef.current = PX_PER_BEAT;
  const fileRef = useRef<HTMLInputElement>(null);
  const live = useRef<{ nodes: AudioBufferSourceNode[]; effects: AudioNode[]; startedAt: number; from: number; out: GainNode | null }>({ nodes: [], effects: [], startedAt: 0, from: 0, out: null });
  const nextId = useRef(1);
  const beatSec = 60 / bpm;
  const total = Math.max(64, Math.ceil((studioDuration(clips, bpm) / beatSec) / 16) * 16 + 16);
  const gridStep = studioGridStep(PX_PER_BEAT);
  const lanes = Math.max(laneCount, ...clips.map(c => (c.lane ?? 0) + 1));

  const stopAudio = () => {
    generation.current++;
    for (const n of live.current.nodes) { try { n.stop(); } catch { /* already stopped */ } n.disconnect(); }
    live.current.nodes = [];
    live.current.effects.forEach(n => n.disconnect()); live.current.effects = [];
    live.current.out?.disconnect(); live.current.out = null;
  };
  const start = async (from: number) => {
    stopAudio();
    const token = generation.current;
    setBusy("Preparing audio…");
    await ctx.resume();
    let prepared: AudioBuffer[];
    const schedule = studioSchedule(clips, bpm, from);
    try { prepared = await Promise.all(schedule.map(s => prepareStudioClip(s.clip))); }
    catch { if (token === generation.current) { setBusy("Could not process audio"); setPlaying(false); } return; }
    if (token !== generation.current) return;
    setBusy("");
    const out = ctx.createGain(); out.connect(ctx.destination);
    const t0 = ctx.currentTime + 0.03;
    live.current = { nodes: [], effects: [], startedAt: t0, from, out };
    for (const [i, s] of schedule.entries()) {
      const src = ctx.createBufferSource(); src.buffer = prepared[i];
      live.current.effects.push(...connectStudioFx(ctx, src, out, s.clip, t0 + s.delay, clipDuration(s.clip) - s.offset));
      src.start(t0 + s.delay, s.offset);
      live.current.nodes.push(src);
    }
    setPlaying(true);
  };
  const stop = () => { stopAudio(); setPlaying(false); };

  useEffect(() => () => stopAudio(), []);
  // Restart from the current position whenever the arrangement changes mid-play.
  useEffect(() => { if (playing) start(ctx.currentTime - live.current.startedAt + live.current.from); }, [clips, bpm]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    const end = studioDuration(clips, bpm);
    const tick = () => {
      const t = Math.max(0, ctx.currentTime - live.current.startedAt) + live.current.from;
      if (t >= end) { if (loop && end > 0) { start(0); setHead(0); } else { stop(); setHead(0); return; } }
      else setHead(t);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, loop, clips, bpm]); // eslint-disable-line react-hooks/exhaustive-deps

  const importFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    const added: StudioClip[] = [];
    for (const f of Array.from(files)) {
      setBusy(`Importing ${f.name}…`);
      try {
        const buffer = await ctx.decodeAudioData(await f.arrayBuffer());
        added.push({ id: nextId.current++, name: f.name.replace(/\.[^.]+$/, ""), buffer, lane: clips.length ? lanes + added.length : added.length, startBeat: 0, gain: 0.8, mute: false, solo: false });
      } catch { setBusy(`Could not read ${f.name}`); await new Promise(r => setTimeout(r, 1200)); }
    }
    setBusy("");
    setClips(c => [...c, ...added]);
  };
  const update = (id: number, patch: Partial<StudioClip>) => setClips(c => c.map(x => x.id === id ? { ...x, ...patch } : x));
  /** Snapshot the arrangement before a destructive edit so Undo can restore it. */
  const commit = (fn: (cs: StudioClip[]) => StudioClip[]) => {
    history.current.past.push(clips);
    if (history.current.past.length > 100) history.current.past.shift();
    history.current.future = [];
    setClips(fn);
    forceHistory(n => n + 1);
  };
  const undo = () => {
    const prev = history.current.past.pop(); if (!prev) return;
    history.current.future.push(clips); setClips(prev); forceHistory(n => n + 1);
  };
  const redo = () => {
    const next = history.current.future.pop(); if (!next) return;
    history.current.past.push(clips); setClips(next); forceHistory(n => n + 1);
  };
  /** Tap-tempo beat mapper: tap repeatedly in time with the music to set the project BPM. */
  const tapTempo = () => {
    const now = performance.now();
    taps.current = taps.current.filter(t => now - t < 2500);
    taps.current.push(now);
    if (taps.current.length >= 3) {
      const gaps = taps.current.slice(1).map((t, i) => t - taps.current[i]);
      const avg = gaps.reduce((a, b) => a + b, 0) / gaps.length;
      setBpm(Math.round(Math.max(30, Math.min(300, 60000 / avg)) * 10) / 10);
    }
  };

  const selected = clips.find(c => c.id === sel) ?? null;
  const copySel = () => { if (selected) { clip.current = selected; setHasClip(true); } };
  const cutSel = () => { if (!selected) return; copySel(); commit(cs => cs.filter(x => x.id !== selected.id)); setSel(null); };
  const pasteAt = (beat: number, lane: number) => {
    const c = clip.current; if (!c) return;
    const b = studioPlacement(beat, snap, gridStep);
    const id = nextId.current++; setClips(cs => [...cs, { ...c, id, lane, startBeat: b }]); setSel(id);
  };
  const paste = () => pasteAt(head / beatSec, selected?.lane ?? 0);
  const duplicate = () => {
    if (!selected) return; const id = nextId.current++;
    setClips(cs => [...cs, { ...selected, id, startBeat: selected.startBeat + clipDuration(selected) / beatSec }]); setSel(id);
  };
  const split = () => {
    const target = selected ?? clips.find(c => splitClip(c, head, bpm, 0)); if (!target) return;
    const parts = splitClip(target, head, bpm, nextId.current++); if (!parts) return;
    setClips(cs => cs.flatMap(x => x.id === target.id ? parts : [x])); setSel(parts[1].id);
  };
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === "INPUT") return;
      const m = e.ctrlKey || e.metaKey, k = e.key.toLowerCase();
      if (m && k === "c") copySel(); else if (m && k === "x") cutSel(); else if (m && k === "v") paste(); else if (m && k === "d") { e.preventDefault(); duplicate(); }
      else if (m && k === "z" && !e.shiftKey) { e.preventDefault(); undo(); } else if (m && (k === "y" || (k === "z" && e.shiftKey))) { e.preventDefault(); redo(); }
      else if (k === "s" && !m) split(); else if (k === "delete" || k === "backspace") { if (selected) { commit(cs => cs.filter(x => x.id !== selected.id)); setSel(null); } }
    };
    window.addEventListener("keydown", key); return () => window.removeEventListener("keydown", key);
  });

  const dragClip = (e: React.PointerEvent, clip: StudioClip) => {
    if (e.button !== 0 && e.pointerType === "mouse") return;
    setSel(clip.id);
    if (eraseTool) {
      // Eraser tool: tap a clip to remove it from the arrangement.
      commit(cs => cs.filter(x => x.id !== clip.id)); setSel(null);
      return;
    }
    if (cutTool) {
      // Scissors tool: tap anywhere on a clip to split exactly there (snapped to grid when Snap is on).
      const box = (e.currentTarget.parentElement as HTMLElement).getBoundingClientRect();
      const beat = studioPlacement((e.clientX - box.left) / PX_PER_BEAT, snap, gridStep / 4);
      const parts = splitClip(clip, beat * beatSec, bpm, nextId.current++);
      if (parts) { commit(cs => cs.flatMap(x => x.id === clip.id ? parts : [x])); setSel(parts[1].id); }
      return;
    }
    const el = e.currentTarget as HTMLElement; el.setPointerCapture(e.pointerId);
    const x0 = e.clientX, y0 = e.clientY, b0 = clip.startBeat, lane0 = clip.lane ?? 0;
    // Touch long-press opens the same edit menu as right-click (ACID/Serato style).
    let longPress = false;
    const lpTimer = e.pointerType === "mouse" ? 0 : window.setTimeout(() => {
      longPress = true;
      el.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true, clientX: x0, clientY: y0 }));
    }, 480);
    const move = (ev: PointerEvent) => {
      if (Math.hypot(ev.clientX - x0, ev.clientY - y0) < 7) return;
      if (lpTimer) { clearTimeout(lpTimer); if (longPress) return; }
      const b = studioPlacement(b0 + (ev.clientX - x0) / PX_PER_BEAT, snap, gridStep);
      update(clip.id, { startBeat: b, lane: Math.max(0, Math.min(lanes, lane0 + Math.round((ev.clientY - y0) / 64))) });
    };
    const up = () => { if (lpTimer) clearTimeout(lpTimer); el.removeEventListener("pointermove", move); el.removeEventListener("pointerup", up); el.removeEventListener("pointercancel", up); };
    el.addEventListener("pointermove", move); el.addEventListener("pointerup", up); el.addEventListener("pointercancel", up);
  };
  const stretchClip = (e: React.PointerEvent, c: StudioClip) => {
    e.stopPropagation(); e.preventDefault(); setSel(c.id);
    const el = e.currentTarget as HTMLElement; el.setPointerCapture(e.pointerId);
    const x = e.clientX, duration = clipDuration(c);
    const move = (ev: PointerEvent) => {
      let beats = Math.max(0.125, duration / beatSec + (ev.clientX - x) / PX_PER_BEAT);
      if (snap) beats = Math.max(gridStep, Math.round(beats / gridStep) * gridStep);
      update(c.id, { stretch: Math.max(0.125, Math.min(8, beats * beatSec / c.buffer.duration)) });
    };
    const up = () => { el.removeEventListener("pointermove", move); el.removeEventListener("pointerup", up); el.removeEventListener("pointercancel", up); };
    el.addEventListener("pointermove", move); el.addEventListener("pointerup", up); el.addEventListener("pointercancel", up);
  };
  /** Drag a clip edge to trim it shorter or pull hidden audio back out (non-destructive). */
  const trimEdge = (e: React.PointerEvent, c: StudioClip, side: "l" | "r") => {
    e.stopPropagation(); e.preventDefault(); setSel(c.id);
    const el = e.currentTarget as HTMLElement; el.setPointerCapture(e.pointerId);
    const x0 = e.clientX, st = c.stretch ?? 1;
    const { source, s, e: end } = clipSource(c);
    const lenBeats = clipDuration(c) / beatSec;
    let next = c;
    const move = (ev: PointerEvent) => {
      let d = (ev.clientX - x0) / PX_PER_BEAT;
      if (side === "l") {
        let nb = c.startBeat + d; if (snap) nb = Math.round(nb / gridStep) * gridStep;
        d = nb - c.startBeat;
        let sec = d * beatSec / st;
        // Moving the left edge right removes audio; left reveals it (bounded by the source).
        const room = c.reverse ? source.duration - end : s;
        sec = Math.max(-room, Math.min(c.buffer.duration - 0.005, sec));
        if (c.startBeat + sec * st / beatSec < 0) sec = -c.startBeat * beatSec / st;
        next = c.reverse ? trimClip(c, s, end - sec) : trimClip(c, s + sec, end);
        next = { ...next, startBeat: c.startBeat + sec * st / beatSec };
      } else {
        let ne = c.startBeat + lenBeats + d; if (snap) ne = Math.round(ne / gridStep) * gridStep;
        d = ne - c.startBeat - lenBeats;
        let sec = d * beatSec / st;
        const room = c.reverse ? s : source.duration - end;
        sec = Math.max(-(c.buffer.duration - 0.005), Math.min(room, sec));
        next = { ...c, srcStart: c.reverse ? s - sec : s, srcEnd: c.reverse ? end : end + sec };
      }
      const ns = next.srcStart ?? 0, nend = next.srcEnd ?? source.duration;
      setTrim({ id: c.id, left: next.startBeat * PX_PER_BEAT, width: Math.max(4, (nend - ns) * st / beatSec * PX_PER_BEAT) });
    };
    const up = () => {
      el.removeEventListener("pointermove", move); el.removeEventListener("pointerup", up); el.removeEventListener("pointercancel", up);
      setTrim(null);
      if (next !== c) { const t = trimClip(next, next.srcStart ?? 0, next.srcEnd ?? source.duration); update(c.id, { ...t, id: c.id }); }
    };
    el.addEventListener("pointermove", move); el.addEventListener("pointerup", up); el.addEventListener("pointercancel", up);
  };
  const seekRuler = (e: React.PointerEvent<HTMLDivElement>) => {
    const box = e.currentTarget.getBoundingClientRect();
    let beat = Math.max(0, (e.clientX - box.left) / PX_PER_BEAT);
    beat = studioPlacement(beat, snap, gridStep);
    const t = beat * beatSec; setHead(t);
    if (playing) start(t);
  };

  useEffect(() => {
    const el = scrollRef.current; if (!el) return;
    const zoomAt = (next: number, x: number) => {
      next = Math.max(6, Math.min(4096, next));
      const local = x - el.getBoundingClientRect().left - 160;
      const beat = (el.scrollLeft + local) / zoomRef.current;
      zoomRef.current = next; setPx(next);
      requestAnimationFrame(() => { el.scrollLeft = Math.max(0, beat * next - local); });
    };
    const wheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      const dy = e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 100 : 1);
      zoomAt(zoomRef.current * Math.exp(-dy * 0.0015), e.clientX);
    };
    let distance = 0, startZoom = 0;
    const touchStart = (e: TouchEvent) => {
      if (e.touches.length !== 2) return;
      e.preventDefault(); distance = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY); startZoom = zoomRef.current;
    };
    const touchMove = (e: TouchEvent) => {
      if (e.touches.length !== 2 || distance <= 0) return;
      e.preventDefault();
      const d = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
      zoomAt(startZoom * d / distance, (e.touches[0].clientX + e.touches[1].clientX) / 2);
    };
    el.addEventListener("wheel", wheel, { passive: false }); el.addEventListener("touchstart", touchStart, { passive: false }); el.addEventListener("touchmove", touchMove, { passive: false });
    return () => { el.removeEventListener("wheel", wheel); el.removeEventListener("touchstart", touchStart); el.removeEventListener("touchmove", touchMove); };
  }, []);

  const exportMix = async () => {
    const dur = studioDuration(clips, bpm); if (!dur) return;
    setBusy("Rendering mix…");
    const off = new OfflineAudioContext(2, Math.ceil(dur * 44100), 44100);
    try {
    for (const s of studioSchedule(clips, bpm, 0)) {
      const src = off.createBufferSource(); src.buffer = await prepareStudioClip(s.clip);
      connectStudioFx(off, src, off.destination, s.clip, s.delay, clipDuration(s.clip) - s.offset); src.start(s.delay, s.offset);
    }
    const blob = studioWav(await off.startRendering());
    const path = await saveRecording(`${projectName}-mix`, blob);
    setFileStatus(`Saved ${path}`);
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "studio-mix.wav"; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
    setBusy("");
    } catch { setBusy("Could not export audio"); }
  };

  const fmt = (t: number) => `${Math.floor(t / beatSec / 4) + 1}.${(Math.floor(t / beatSec) % 4) + 1}`;
  const saveProject = async () => {
    setBusy('Saving project…'); setFileStatus('');
    try { const info = await saveStudioProject(projectName,bpm,clips); setProjectName(info.name); setFileStatus(`Saved ${info.path}`); }
    catch (e) { setFileStatus(e instanceof Error ? e.message : 'Project could not be saved.'); }
    finally { setBusy(''); }
  };
  const openProjects = async () => {
    setBusy('Reading projects…');
    try { setProjects(await listStudioProjects()); setFilesOpen(true); }
    catch { setFileStatus('Could not read saved projects.'); }
    finally { setBusy(''); }
  };
  const openProject = async (name: string) => {
    stop(); setBusy('Opening project…');
    try { const p = await loadStudioProject(name,ctx); commit(() => p.clips); setBpm(p.bpm); setProjectName(name); nextId.current = Math.max(0,...p.clips.map(c => c.id)) + 1; setHead(0); setSel(null); setFilesOpen(false); setFileStatus(`Opened ${name}`); }
    catch (e) { setFileStatus(e instanceof Error ? e.message : 'Project could not be opened.'); }
    finally { setBusy(''); }
  };

  return <div className="studio-screen fixed inset-0 z-[90] flex flex-col bg-background text-foreground">
    <header className="flex h-14 shrink-0 items-center gap-2 border-b border-border px-2">
      <Button variant="ghost" onClick={() => { stop(); onClose(); }}><ArrowLeft />Mixer</Button>
      <h1 className="text-base font-semibold">Studio</h1>
      <div className="ml-auto flex items-center gap-1">
        <Button variant="ghost" size="icon" className="size-9" aria-label="Save project" title="Save project" disabled={!!busy} onClick={() => void saveProject()}><Save className="size-4" /></Button>
        <Button variant="ghost" size="icon" className="size-9" aria-label="Open saved project" title="Open saved project" disabled={!!busy} onClick={() => void openProjects()}><FolderOpen className="size-4" /></Button>
        <Button variant="ghost" size="icon" className="size-9" aria-label="Export mix as WAV" disabled={!clips.length || !!busy} onClick={() => void exportMix()}><Download className="size-4" /></Button>
        <Button size="sm" onClick={() => fileRef.current?.click()}><Plus />Add audio</Button>
        <input ref={fileRef} type="file" accept="audio/*" multiple hidden onChange={e => { void importFiles(e.target.files); e.target.value = ""; }} />
      </div>
    </header>
    <div className="flex items-center gap-2 border-b border-border px-2 py-1"><Input aria-label="Project name" className="h-8 max-w-48" maxLength={60} value={projectName} onChange={e => setProjectName(e.target.value)} />{fileStatus && <span role="status" className="min-w-0 break-words text-xs text-muted-foreground">{fileStatus}</span>}</div>
    {filesOpen && <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/90 p-3"><section role="dialog" aria-label="Saved projects" className="w-full max-w-sm rounded-lg border border-border bg-popover p-3"><div className="flex items-center justify-between"><h2 className="font-semibold">Saved projects</h2><Button variant="ghost" size="icon" aria-label="Close saved projects" onClick={() => setFilesOpen(false)}><X /></Button></div><div className="max-h-80 overflow-y-auto">{projects.length ? projects.map(p => <Button key={p.path} variant="ghost" className="h-auto w-full justify-between py-3" onClick={() => void openProject(p.name)} disabled={!!busy}><span className="min-w-0 truncate">{p.name}</span><span className="text-xs text-muted-foreground">{p.clips} clips</span></Button>) : <p className="py-5 text-sm text-muted-foreground">No saved projects</p>}</div></section></div>}
    <div className="studio-transport flex shrink-0 flex-wrap items-center gap-1.5 border-b border-border bg-secondary px-2 py-1.5">
      <Button variant="outline" size="icon" className="size-9" aria-label="Go to start" disabled={!clips.length} onClick={() => { setHead(0); if (playing) start(0); }}><SkipBack className="size-4" /></Button>
      <Button variant="outline" size="icon" className="size-9 rounded-full" aria-label={playing ? "Stop" : "Play"} disabled={!clips.length} onClick={() => playing ? stop() : start(head)}>{playing ? <Square className="size-4" fill="currentColor" /> : <Play className="size-4" fill="currentColor" />}</Button>
      <Button variant="outline" size="icon" className="size-9" aria-label="Go to end" disabled={!clips.length} onClick={() => { const end = studioDuration(clips, bpm); setHead(end); if (playing) start(end); }}><SkipForward className="size-4" /></Button>
      <Button variant="outline" size="icon" className="size-9" aria-label="Undo (Ctrl+Z)" disabled={!history.current.past.length} onClick={undo}><Undo2 className="size-4" /></Button>
      <Button variant="outline" size="icon" className="size-9" aria-label="Redo (Ctrl+Y)" disabled={!history.current.future.length} onClick={redo}><Redo2 className="size-4" /></Button>
      <Button variant={loop ? "default" : "outline"} size="icon" className="size-9" aria-label="Loop arrangement" aria-pressed={loop} onClick={() => setLoop(l => !l)}><Repeat className="size-4" /></Button>
      <Button variant={snap ? "default" : "outline"} size="icon" className="size-9" aria-label="Snap to beat" aria-pressed={snap} onClick={() => setSnap(v => !v)}><Magnet className="size-4" /></Button>
      <div className="studio-lcd rounded-md border border-border bg-background px-2 py-0.5 font-mono text-sm tabular-nums">{fmt(head)}</div>
      <label className="flex items-center gap-1 text-[11px] text-muted-foreground">BPM
        <input type="number" min={60} max={200} step={0.1} value={bpm} aria-label="Project tempo" onChange={e => { const v = Number(e.target.value); if (v >= 30 && v <= 300) setBpm(v); }} className="w-16 rounded-md border border-border bg-background px-1.5 py-0.5 font-mono text-sm text-foreground" />
      </label>
      <div className="flex items-center gap-1">
        <Button variant={!cutTool && !eraseTool ? "default" : "outline"} size="icon" className="size-9" aria-label="Selection tool" aria-pressed={!cutTool && !eraseTool} onClick={() => { setCutTool(false); setEraseTool(false); }}><MousePointer2 className="size-4" /></Button>
        <Button variant="outline" size="icon" className="size-9" aria-label="Split at playhead (S)" disabled={!clips.length} onClick={split}><SplitSquareHorizontal className="size-4" /></Button>
        <Button variant={cutTool ? "default" : "outline"} size="icon" className="size-9" aria-label="Scissors tool: tap a clip to split it there" aria-pressed={cutTool} disabled={!clips.length} onClick={() => { setCutTool(v => !v); setEraseTool(false); }}><Scissors className="size-4 -rotate-90" /></Button>
        <Button variant={eraseTool ? "default" : "outline"} size="icon" className="size-9" aria-label="Eraser tool: tap a clip to delete it" aria-pressed={eraseTool} disabled={!clips.length} onClick={() => { setEraseTool(v => !v); setCutTool(false); }}><Eraser className="size-4" /></Button>
        <Button variant="outline" size="icon" className="size-9" aria-label="Tap tempo: tap in time to map the beat" onClick={tapTempo} title="Beat mapper — tap in time with the music"><Activity className="size-4" /></Button>
        <Button variant="outline" size="icon" className="size-9" aria-label="Cut clip" disabled={!selected} onClick={cutSel}><Scissors className="size-4" /></Button>
        <Button variant="outline" size="icon" className="size-9" aria-label="Copy clip" disabled={!selected} onClick={copySel}><Copy className="size-4" /></Button>
        <Button variant="outline" size="icon" className="size-9" aria-label="Paste at playhead" disabled={!hasClip} onClick={paste}><ClipboardPaste className="size-4" /></Button>
        <Button variant="outline" size="icon" className="size-9" aria-label="Duplicate clip" disabled={!selected} onClick={duplicate}><CopyPlus className="size-4" /></Button>
      </div>
      <div className="flex items-center gap-1">
        <Button variant="outline" size="icon" className="size-9" aria-label="Zoom out" onClick={() => setPx(p => Math.max(6, p / 1.5))}><ZoomOut className="size-4" /></Button>
        <Button variant="outline" size="icon" className="size-9" aria-label="Zoom in" onClick={() => setPx(p => Math.min(4096, p * 1.5))}><ZoomIn className="size-4" /></Button>
        <Button variant="outline" size="icon" className="size-9" aria-label="Zoom in centered on the playhead" title="Zoom to playhead" onClick={() => { const el = scrollRef.current; if (!el) return; const next = Math.min(4096, zoomRef.current * 2); zoomRef.current = next; setPx(next); requestAnimationFrame(() => { el.scrollLeft = Math.max(0, (head / beatSec) * next - el.clientWidth / 2); }); }}><Crosshair className="size-4" /></Button>
      </div>
      <Button variant="outline" size="icon" className="size-9" aria-label="Add lane" onClick={() => setLaneCount(lanes + 1)}><Plus className="size-4" /></Button>
      <Button variant="outline" size="icon" className="size-9" aria-label="Track FX and pitch" disabled={!selected} onClick={() => setEditOpen(v => !v)}><SlidersHorizontal className="size-4" /></Button>
      <Button variant="outline" size="icon" className="size-9" aria-label="Sync selected clip to project beats" disabled={!selected} onClick={() => { if (selected) update(selected.id, syncClip(selected, bpm)); }}><Link2 className="size-4" /></Button>
      {busy && <span role="status" className="text-xs text-muted-foreground">{busy}</span>}
    </div>
    {selected && editOpen && <div className="flex flex-wrap items-center gap-3 border-b border-border bg-secondary p-2">
      <span className="max-w-40 truncate text-xs">{selected.name}</span>
      <label className="flex items-center gap-2 text-xs">Pitch
        <Button variant="outline" size="icon" className="size-7" aria-label="Pitch down one semitone" onClick={() => update(selected.id, { pitch: studioPitch((selected.pitch ?? 0) - 1) })}><Minus className="size-3.5" /></Button>
        <input aria-label="Clip pitch semitones" type="range" min={-24} max={24} step={1} value={selected.pitch ?? 0} onChange={e => update(selected.id, { pitch: studioPitch(Number(e.target.value)) })} />
        <Button variant="outline" size="icon" className="size-7" aria-label="Pitch up one semitone" onClick={() => update(selected.id, { pitch: studioPitch((selected.pitch ?? 0) + 1) })}><Plus className="size-3.5" /></Button>
        <output className="w-8 tabular-nums">{selected.pitch ?? 0}</output></label>
      <label className="flex items-center gap-2 text-xs">FX <select aria-label="Track effect" className="rounded border border-border bg-background p-1" value={selected.fx ?? "none"} onChange={e => update(selected.id, { fx: e.target.value as StudioClip["fx"] })}><option value="none">None</option><option value="lowpass">Low pass</option><option value="highpass">High pass</option><option value="echo">Echo</option><option value="drive">Drive</option></select></label>
      <label className="flex items-center gap-2 text-xs">Fade in <input aria-label="Fade in seconds" type="range" min={0} max={8} step={0.1} value={selected.fadeIn ?? 0} onDoubleClick={() => update(selected.id, { fadeIn: 0 })} onChange={e => update(selected.id, { fadeIn: Number(e.target.value) })} className="w-16" /><output className="w-9 tabular-nums">{(selected.fadeIn ?? 0).toFixed(1)}s</output></label>
      <label className="flex items-center gap-2 text-xs">Fade out <input aria-label="Fade out seconds" type="range" min={0} max={8} step={0.1} value={selected.fadeOut ?? 0} onDoubleClick={() => update(selected.id, { fadeOut: 0 })} onChange={e => update(selected.id, { fadeOut: Number(e.target.value) })} className="w-16" /><output className="w-9 tabular-nums">{(selected.fadeOut ?? 0).toFixed(1)}s</output></label>
      <Button variant={selected.reverse ? "default" : "outline"} size="sm" onClick={() => update(selected.id, { reverse: !selected.reverse })}><RotateCcw />Reverse</Button>
      <Button variant="ghost" size="sm" onClick={() => update(selected.id, { stretch: 1, pitch: 0, reverse: false, fx: "none" })}>Reset</Button>
    </div>}
    <div ref={scrollRef} className="flex min-h-0 flex-1 overflow-auto">
      <div className="sticky left-0 z-20 w-40 shrink-0 border-r border-border bg-secondary">
        <div className="h-7 border-b border-border" />
        {Array.from({ length: lanes + 1 }, (_, i) => { const c = clips.find(c => (c.lane ?? 0) === i); return <div key={i} className="flex h-16 flex-col justify-center gap-1 border-b border-border px-2">
          {!c ? <span className="text-xs text-muted-foreground">Track {i + 1}</span> : <>
          <div className="flex items-center gap-1"><span className="size-2.5 shrink-0 rounded-sm" style={{ background: LANE_COLORS[i % LANE_COLORS.length] }} /><span className="min-w-0 flex-1 truncate text-xs font-medium">{c.name}</span>
            <Button variant="ghost" size="icon" aria-label={`Remove ${c.name}`} onClick={() => setClips(cs => cs.filter(x => x.id !== c.id))} className="size-5 text-muted-foreground"><Trash2 className="size-3.5" /></Button></div>
          <div className="flex items-center gap-1">
            <Button variant={c.mute ? "destructive" : "outline"} aria-label={`Mute track ${i + 1}`} aria-pressed={c.mute} onClick={() => setClips(cs => cs.map(x => (x.lane ?? 0) === i ? { ...x, mute: !c.mute } : x))} className="h-5 w-6 p-0 text-[10px]">M</Button>
            <Button variant={c.solo ? "default" : "outline"} aria-label={`Solo track ${i + 1}`} aria-pressed={c.solo} onClick={() => setClips(cs => cs.map(x => (x.lane ?? 0) === i ? { ...x, solo: !c.solo } : x))} className="h-5 w-6 p-0 text-[10px]">S</Button>
            <input type="range" min={0} max={1} step={0.01} value={c.gain} aria-label={`${c.name} volume`} onChange={e => update(c.id, { gain: Number(e.target.value) })} className="h-1 min-w-0 flex-1 accent-primary" />
          </div>
        </>}</div>; })}
      </div>
      <div ref={timelineRef} className="relative shrink-0" style={{ width: total * PX_PER_BEAT }}>
        <div className="studio-ruler sticky top-0 z-10 h-7 cursor-pointer border-b border-border bg-secondary" onPointerDown={seekRuler}>
          {Array.from({ length: total / 4 }, (_, bar) => <span key={bar} className="absolute top-0 h-full border-l border-border pl-1 text-[10px] text-muted-foreground" style={{ left: bar * 4 * PX_PER_BEAT }}>{bar + 1}</span>)}
        </div>
        <div className="studio-grid pointer-events-none absolute inset-x-0 bottom-0 top-7" style={{ backgroundSize: `${PX_PER_BEAT * gridStep}px 100%, ${PX_PER_BEAT * 4}px 100%` }} />
        {Array.from({ length: lanes + 1 }, (_, i) => <ContextMenu key={i}><ContextMenuTrigger asChild><div data-studio-lane={i} className="relative h-16 border-b border-border" onPointerDown={e => { if (e.target === e.currentTarget) seekRuler(e); }} onContextMenu={e => { const box = e.currentTarget.getBoundingClientRect(); setHead(studioPlacement((e.clientX - box.left) / PX_PER_BEAT, snap, gridStep) * beatSec); }}>
        {clips.filter(c => (c.lane ?? 0) === i).map(c => {
          const tp = trim?.id === c.id ? trim : null;
          const w = Math.max(2, tp ? tp.width : (clipDuration(c) / beatSec) * PX_PER_BEAT);
          const color = LANE_COLORS[i % LANE_COLORS.length];
          return <ContextMenu key={c.id}><ContextMenuTrigger asChild>
            <div role="button" tabIndex={0} aria-label={`Move ${c.name}, starts at beat ${c.startBeat + 1}`} onPointerDown={e => dragClip(e, c)}
              onContextMenu={e => { e.stopPropagation(); setSel(c.id); }}
              onKeyDown={e => { if (e.key === "ArrowRight") update(c.id, { startBeat: c.startBeat + 1 }); if (e.key === "ArrowLeft") update(c.id, { startBeat: Math.max(0, c.startBeat - 1) }); }}
              className={`studio-clip absolute top-1.5 h-[52px] cursor-grab touch-none overflow-hidden rounded-md border ${sel === c.id ? "border-foreground ring-2 ring-foreground" : "border-foreground/20"} ${c.mute ? "opacity-40" : ""} ${cutTool || eraseTool ? "cursor-crosshair" : ""}`}
              style={{ left: tp ? tp.left : c.startBeat * PX_PER_BEAT, width: w, background: `color-mix(in oklab, ${color} 35%, var(--background))` }}>
              <span className="absolute left-1 top-0.5 z-10 max-w-full truncate text-[10px] font-semibold text-foreground">{c.name}{c.pitch ? ` · ${c.pitch > 0 ? "+" : ""}${c.pitch}` : ""}{c.reverse ? " · REV" : ""}</span>
              <div className="absolute inset-0" style={c.reverse ? { transform: "scaleX(-1)", opacity: 0.85 } : undefined}><ClipWave buffer={c.buffer} width={Math.min(w, 4000)} /></div>
              <div style={{ pointerEvents: cutTool || w < 24 ? "none" : undefined, visibility: cutTool || w < 24 ? "hidden" : undefined }} aria-label={`Trim start of ${c.name}`} onPointerDown={e => trimEdge(e, c, "l")} className="absolute inset-y-0 left-0 z-20 w-2.5 cursor-ew-resize touch-none border-l-2 border-foreground/50 hover:bg-foreground/20" />
              <div style={{ pointerEvents: cutTool || w < 24 ? "none" : undefined, visibility: cutTool || w < 24 ? "hidden" : undefined }} aria-label={`Trim end of ${c.name}`} onPointerDown={e => trimEdge(e, c, "r")} className="absolute inset-y-0 right-0 z-20 w-2.5 cursor-ew-resize touch-none border-r-2 border-foreground/50 hover:bg-foreground/20" />
              <div role="slider" tabIndex={cutTool ? -1 : 0} style={{ pointerEvents: cutTool || w < 32 ? "none" : undefined, visibility: cutTool || w < 32 ? "hidden" : undefined }} aria-label={`Stretch ${c.name}`} aria-valuemin={0.125} aria-valuemax={8} aria-valuenow={c.stretch ?? 1} onPointerDown={e => stretchClip(e, c)} onKeyDown={e => { if (e.key === "ArrowRight" || e.key === "ArrowLeft") update(c.id, { stretch: Math.max(0.125, Math.min(8, (c.stretch ?? 1) + (e.key === "ArrowRight" ? 0.05 : -0.05))) }); }} className="absolute right-0 top-0 z-30 grid size-4 place-items-center rounded-full border-2 border-foreground/60 bg-background shadow-md"><span className="size-1 rounded-full bg-foreground/70" /></div>
            </div>
            </ContextMenuTrigger><ContextMenuContent className="w-52">
              <ContextMenuItem onSelect={() => { setSel(c.id); const parts = splitClip(c, head, bpm, nextId.current++); if (parts) setClips(cs => cs.flatMap(x => x.id === c.id ? parts : [x])); }}><Scissors className="mr-2 size-4" />Split at playhead</ContextMenuItem>
              <ContextMenuItem onSelect={() => { clip.current = c; setHasClip(true); }}><Copy className="mr-2 size-4" />Copy</ContextMenuItem>
              <ContextMenuItem onSelect={() => { clip.current = c; setHasClip(true); setClips(cs => cs.filter(x => x.id !== c.id)); }}>Cut</ContextMenuItem>
              <ContextMenuSeparator />
              <ContextMenuItem onSelect={() => update(c.id, { pitch: studioPitch((c.pitch ?? 0) + 1) })}>Pitch +1 semitone</ContextMenuItem>
              <ContextMenuItem onSelect={() => update(c.id, { pitch: studioPitch((c.pitch ?? 0) - 1) })}>Pitch −1 semitone</ContextMenuItem>
              <ContextMenuItem onSelect={() => update(c.id, { reverse: !c.reverse })}>Reverse</ContextMenuItem>
              <ContextMenuItem onSelect={() => { setSel(c.id); setEditOpen(true); }}>Track FX / Pitch</ContextMenuItem>
              <ContextMenuItem onSelect={() => update(c.id, syncClip(c, bpm))}>Sync length to project beats</ContextMenuItem>
              <ContextMenuItem onSelect={() => setClips(cs => cs.filter(x => x.id !== c.id))}>Delete</ContextMenuItem>
            </ContextMenuContent></ContextMenu>;
        })}
        </div></ContextMenuTrigger><ContextMenuContent><ContextMenuItem disabled={!hasClip} onSelect={() => pasteAt(head / beatSec, i)}><ClipboardPaste className="mr-2 size-4" />Paste here</ContextMenuItem></ContextMenuContent></ContextMenu>)}
        <div aria-hidden className="pointer-events-none absolute bottom-0 top-0 z-30 w-px bg-primary" style={{ left: (head / beatSec) * PX_PER_BEAT }} />
      </div>
    </div>
  </div>;
}
