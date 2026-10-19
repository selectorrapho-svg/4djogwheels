import { useEffect, useRef, useState } from "react";
import { Deck } from "@/lib/dj/engine";
import { useDjSettings } from "@/hooks/useDjSettings";
import { angleToSeconds, releaseVelocity } from "@/lib/dj/scratchMath";

interface Props {
  deck: Deck;
  size: number;
  accent: string;
}

// Bundled locally (not CDN) so the jog skins also work fully offline in the APK.
import jogPioneer from "@/assets/jogs/jog-pioneer.jpeg";
import jogNeonDisc from "@/assets/jogs/jog-neon-disc.webp";
import unloadedJog from "@/assets/jogs/jog-unloaded.png.asset.json";

const JOG_IMAGE: Record<string, string | undefined> = {
  pioneer3d: jogPioneer,
  neonDisc3d: jogNeonDisc,
};
// 3D variants keep the same skin art but add sculpted gloss + depth shading.
const JOG_3D = new Set(["pioneer3d", "neonDisc3d"]);

// Used when a skin image is configured but fails to load (missing/blocked asset).
const JOG_IMAGE_FALLBACK = jogNeonDisc;


// Vinyl-style jog wheel matching the reference (image 1):
// dark platter, thin red position marker, large blue BPM, +/- pitch above,
// elapsed + remaining time below. Rotates ONLY while a track is loaded AND playing.
export function JogWheel({ deck, size, accent }: Props) {
  const [s] = useDjSettings();
  const ref = useRef<HTMLDivElement>(null);
  
  const ringRef = useRef<HTMLDivElement>(null);
  const timeRef = useRef<HTMLSpanElement>(null);
  const bpmRef = useRef<HTMLSpanElement>(null);
  const remainingRef = useRef<HTMLSpanElement>(null);
  const pitchRef = useRef<HTMLSpanElement>(null);
  const last = useRef({ angle: 0, t: 0, scratching: false });
  const vel = useRef(0);
  const rotRef = useRef(0);
  const lastFrame = useRef(0);
  const handDown = useRef(false);

  // Resolve the skin image with a graceful fallback: if the configured asset
  // fails to load, try a known-good skin, then fall back to the flat colour.
  const wanted = JOG_IMAGE[s.jogStyle];
  const [skin, setSkin] = useState<string | undefined>(wanted);
  useEffect(() => {
    setSkin(wanted);
    if (!wanted || typeof window === "undefined") return;
    let cancelled = false;
    const probe = (url: string, onFail: () => void) => {
      const img = new Image();
      img.onload = () => {
        if (!cancelled) setSkin(url);
      };
      img.onerror = () => {
        if (!cancelled) onFail();
      };
      img.src = url;
    };
    probe(wanted, () => {
      if (wanted === JOG_IMAGE_FALLBACK) {
        setSkin(undefined);
        return;
      }
      probe(JOG_IMAGE_FALLBACK, () => setSkin(undefined));
    });
    return () => {
      cancelled = true;
    };
  }, [wanted]);

  // Continuous rotation only when a track is loaded AND playing.
  useEffect(() => {
    let raf = 0;
    const loop = (now: number) => {
      const dt = lastFrame.current ? Math.min(0.05, (now - lastFrame.current) / 1000) : 0;
      lastFrame.current = now;
      const canSpin = (!!deck.buffer || !!deck.videoEl) && (deck.playing || deck.scratchingVideo || deck.isScratching);
      if (handDown.current) {
        // Hand on the platter: the picture follows the finger only.
      } else if (canSpin) {
        rotRef.current = (deck.currentTime * 200) % 360;
      }
      const r = `rotate(${rotRef.current}deg)`;

      if (ringRef.current) ringRef.current.style.transform = r;
      if (timeRef.current && now - lastReadout > 100) {
        lastReadout = now;
        timeRef.current.textContent = fmt(deck.currentTime);
        if (bpmRef.current) bpmRef.current.textContent = deck.bpm ? (deck.bpm * deck.rate).toFixed(1) : "—";
        if (remainingRef.current) remainingRef.current.textContent = fmt(deck.currentTime - deck.duration);
        if (pitchRef.current) pitchRef.current.textContent = `${((deck.rate - 1) * 100).toFixed(1)}%`;
      }
      raf = requestAnimationFrame(loop);
    };
    let lastReadout = 0;
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [deck]);


  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let c = { x: 0, y: 0 };
    const ang = (x: number, y: number) => {
      return Math.atan2(y - c.y, x - c.x);
    };
    let pointerId = -1;
    let radius = 1;
    // Absolute platter model: cumulative hand angle since touch-down maps 1:1
    // to a track position, so the audio is position-locked (no velocity drift).
    let startPos = 0;
    let relTok = 0;
    let cum = 0;
    // Recent (time, angle) pairs: the fling speed at release drives free spin.
    const hist: number[] = [];
    const down = (e: PointerEvent) => {
      if (!deck.buffer || pointerId !== -1) return;
      const box = el.getBoundingClientRect();
      c = { x: box.left + box.width / 2, y: box.top + box.height / 2 };
      radius = box.width / 2;
      e.preventDefault();
      pointerId = e.pointerId;
      el.setPointerCapture(pointerId);
      last.current = { angle: ang(e.clientX, e.clientY), t: e.timeStamp, scratching: true };
      vel.current = 0;
      cum = 0;
      hist.length = 0;
      const cfg = (globalThis as { __djScratch?: { vinylMode?: boolean } }).__djScratch;
      if (cfg?.vinylMode === false && deck.playing) { last.current.scratching = false; return; }
      relTok++;
      startPos = deck.currentTime;
      handDown.current = true;
      deck.scratchStart();
      if (deck.pathScratch) deck.scratchPath(startPos, e.timeStamp);
      else deck.scratchTo(startPos, 0);
      startLoop();
    };
    // Frame-clocked scratch (same model as the waveform): pointer events only
    // accumulate platter angle; one position/velocity update is sent per
    // display frame, so uneven touch-event timing never reaches the audio.
    let raf = 0;
    let lastCum = 0;
    let lastTick = 0;
    let rotStart = 0;
    const sens = () => (globalThis as { __djScratch?: { sensitivity?: number } }).__djScratch?.sensitivity ?? 1;
    const tick = () => {
      raf = requestAnimationFrame(tick);
      const now = performance.now();
      const dt = Math.min(0.05, Math.max(0.004, (now - lastTick) / 1000));
      lastTick = now;
      const dSec = angleToSeconds(cum - lastCum, sens());
      lastCum = cum;
      let v = Math.max(-16, Math.min(16, dSec / dt));
      if (Math.abs(v) < 0.015) v = 0;
      vel.current = v;
      // The audio servo is the only smoothing stage. A second predictive
      // filter here overshoots reversals and scratches beyond the hand.
      if (!deck.pathScratch) deck.scratchTo(startPos + angleToSeconds(cum, sens()), v);
      rotRef.current = (((rotStart + (cum * 180) / Math.PI) % 360) + 360) % 360;
    };
    const startLoop = () => {
      cancelAnimationFrame(raf);
      lastCum = cum;
      lastTick = performance.now();
      rotStart = rotRef.current;
      raf = requestAnimationFrame(tick);
    };
    const stopLoop = () => { cancelAnimationFrame(raf); raf = 0; };
    const accumulate = (x: number, y: number, ts?: number) => {
      // Spindle: no meaningful angle there; hold the record still.
      if (Math.hypot(x - c.x, y - c.y) < radius * 0.12) { last.current.angle = ang(x, y); return; }
      const a = ang(x, y);
      let d = a - last.current.angle;
      if (d > Math.PI) d -= 2 * Math.PI;
      if (d < -Math.PI) d += 2 * Math.PI;
      cum += d;
      last.current.angle = a;
      const now = ts ?? performance.now();
      hist.push(now, cum);
      while (hist.length > 4 && now - hist[0] > 60) hist.splice(0, 2);
      if (ts !== undefined && deck.pathScratch) deck.scratchPath(startPos + angleToSeconds(cum, sens()), ts);
    };
    const move = (e: PointerEvent) => {
      if (e.pointerId !== pointerId) return;
      if (!last.current.scratching) {
        // Jog (non-vinyl) mode: nudge playback like a CDJ outer ring.
        const a = ang(e.clientX, e.clientY);
        let d = a - last.current.angle;
        if (d > Math.PI) d -= 2 * Math.PI;
        if (d < -Math.PI) d += 2 * Math.PI;
        last.current.angle = a;
        deck.seek(Math.max(0, deck.currentTime + d * 0.05));
        return;
      }
      if (!deck.buffer) return;
      // Walk every coalesced sample so fast flicks keep their full travel.
      const evts = e.getCoalescedEvents?.() ?? [];
      if (evts.length) for (const ev of evts) accumulate(ev.clientX, ev.clientY, ev.timeStamp);
      else accumulate(e.clientX, e.clientY, e.timeStamp);
    };
    const up = (e: PointerEvent) => {
      if (e.pointerId !== pointerId) return;
      const was = last.current.scratching;
      if (was) {
        accumulate(e.clientX, e.clientY, e.timeStamp);
        if (!deck.pathScratch) deck.scratchTo(startPos + angleToSeconds(cum, sens()), vel.current);
      }
      last.current.scratching = false;
      pointerId = -1;
      handDown.current = false;
      stopLoop();
      if (!was) return;
      // Let the delayed hand path finish playing before the motor takes over;
      // the worklet coasts at the hand's last speed until then, so one delay
      // window (~30 ms) is enough and there is no stop-start hole on release.
      const fling = releaseVelocity(hist, performance.now(), sens());
      const tok = ++relTok;
      window.setTimeout(() => { if (tok === relTok && pointerId === -1) deck.releaseScratch(fling); }, deck.pathScratch ? 30 : 0);
    };
    el.addEventListener("pointerdown", down);
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerup", up);
    el.addEventListener("pointercancel", up);
    el.addEventListener("lostpointercapture", up);
    return () => {
      el.removeEventListener("pointerdown", down);
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerup", up);
      el.removeEventListener("pointercancel", up);
      el.removeEventListener("lostpointercapture", up);
      relTok++; // cancel any delayed release still pending after unmount
      stopLoop();
      if (last.current.scratching) deck.endScratch();
    };
  }, [deck]);

  const fmt = (sec: number) => {
    if (!isFinite(sec)) return "00:00.0";
    const sign = sec < 0 ? "-" : "";
    const abs = Math.abs(sec);
    const m = Math.floor(abs / 60);
    const s2 = (abs % 60).toFixed(1);
    return `${sign}${m.toString().padStart(2, "0")}:${s2.padStart(4, "0")}`;
  };

  const loaded = !!deck.buffer || !!deck.videoEl;
  const is3d = JOG_3D.has(s.jogStyle);
  const referenceReadout = ["combatDark", "combatLight", "extended"].includes(s.jogStyle);


  return (
    <div data-jog-style={s.jogStyle} className="reference-jog extended-jog" style={{ width: size, maxWidth: "100%" }}>
      <div ref={ref} data-loaded={loaded} role="slider" aria-label={`Scratch deck ${deck.id}`} aria-valuemin={0} aria-valuemax={deck.duration} aria-valuenow={deck.currentTime} className="relative aspect-square w-full touch-none select-none">
        <div ref={ringRef} data-skin={s.jogStyle} className={`jog-skin absolute inset-0 pointer-events-none will-change-transform rounded-full ${is3d ? "jog-depth" : ""}`}>
           {skin ? <img src={skin} alt={`${s.jogStyle} jogwheel`} width={1024} height={1024} loading="lazy" draggable={false} className="size-full rounded-full object-contain" /> : s.jogStyle === "silver" ? <img src={unloadedJog.url} alt="Dark silver jogwheel" draggable={false} className="size-full rounded-full object-contain" /> : <><div className="jog-grooves" /><div className="jog-label" /></>}
          {!skin && s.jogStyle !== "silver" && <div className="platter-index" />}
          {!referenceReadout && loaded && deck.coverUrl && <img src={deck.coverUrl} alt="" draggable={false} className="jog-album-art" onError={e => { e.currentTarget.style.display = "none"; }} />}
        </div>
        <div className="jog-readout pointer-events-none" data-loaded={loaded}>
          {referenceReadout && <span ref={pitchRef} className="jog-readout-pitch">{((deck.rate - 1) * 100).toFixed(1)}%</span>}
          {(referenceReadout || !deck.coverUrl) && <><span ref={bpmRef} className="jog-readout-bpm">{deck.bpm ? (deck.bpm * deck.rate).toFixed(1) : "—"}</span>{!referenceReadout && <span className="jog-readout-label">BPM</span>}</>}
          <span ref={timeRef} className="jog-readout-time">{fmt(deck.currentTime)}</span>
          {referenceReadout && <span ref={remainingRef} className="jog-readout-remaining">{fmt(deck.currentTime - deck.duration)}</span>}
        </div>
      </div>
    </div>
  );
}

/**
 * Rane/Mixxx-style silver position needle: its angle shows track progress
 * (full circle = whole track). Drag it around the platter to seek back/forward.
 */
function SeekNeedle({ deck }: { deck: Deck }) {
  const needleRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  useEffect(() => {
    let raf = 0;
    const loop = () => {
      if (needleRef.current && !dragging.current && deck.duration > 0) {
        needleRef.current.style.transform = `rotate(${(deck.currentTime / deck.duration) * 360}deg)`;
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [deck]);

  const toAngle = (e: React.PointerEvent) => {
    const box = (e.currentTarget.parentElement as HTMLElement).getBoundingClientRect();
    const a = Math.atan2(e.clientX - (box.left + box.width / 2), -(e.clientY - (box.top + box.height / 2)));
    return ((a * 180) / Math.PI + 360) % 360;
  };
  const apply = (e: React.PointerEvent) => {
    const deg = toAngle(e);
    if (needleRef.current) needleRef.current.style.transform = `rotate(${deg}deg)`;
    if (deck.duration > 0) deck.seek((deg / 360) * deck.duration);
  };

  return (
    <div ref={needleRef} className="seek-needle" aria-hidden>
      <div
        className="seek-needle-grip"
        onPointerDown={(e) => { e.stopPropagation(); e.preventDefault(); dragging.current = true; e.currentTarget.setPointerCapture(e.pointerId); }}
        onPointerMove={(e) => { if (dragging.current) { e.stopPropagation(); apply(e); } }}
        onPointerUp={(e) => { e.stopPropagation(); dragging.current = false; }}
        onPointerCancel={() => { dragging.current = false; }}
      />
    </div>
  );
}
