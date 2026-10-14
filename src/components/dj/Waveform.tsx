import { WaveAnalysisStatus } from "./WaveAnalysisStatus";
import { useEffect, useRef, useState } from "react";
import { Deck, BandedPeaks } from "@/lib/dj/engine";
import { stemBands, smoothAt, BAND_STEM } from "@/lib/dj/wavedraw";
import { ZoomIn, ZoomOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useDjSettings } from "@/hooks/useDjSettings";
import { useWaveScratch } from "@/lib/dj/useWaveScratch";
import { buildRgbStrip, drawRgbStrip, drawZigzag, zoomedZigzag, stemsKey, stemsOn, type RgbStrip } from "@/lib/dj/rgbWave";

function makeStrip(axis: "x" | "y") {
  const ref = { strip: null as RgbStrip | null, key: "", peaks: null as BandedPeaks | null };
  return (peaks: BandedPeaks, deck: Deck) => {
    const k = stemsKey(deck.stems as never) + ":" + peaks.overall.length;
    if (ref.key !== k || ref.peaks !== peaks || !ref.strip) {
      ref.strip = buildRgbStrip(peaks, stemsOn(deck.stems as never), axis);
      ref.key = k;
      ref.peaks = peaks;
    }
    return ref.strip;
  };
}
const isRgb3 = () => ((globalThis as { __djWaveColor?: string }).__djWaveColor ?? "rgb3") === "rgb3";


interface Props {
  deck: Deck;
  color: string;
  side: "left" | "right";
}

// Vertical scrolling stem waveform — smooth interpolated RGB envelopes.
// Future scrolls in from bottom → past drifts to top.
export function Waveform({ deck, side }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const peaksRef = useRef<BandedPeaks | null>(null);
  const rafRef = useRef(0);
  const [zoom, setZoom] = useState(1);
  const [settings] = useDjSettings();
  const effectiveZoom = zoom * settings.waveZoom;

  peaksRef.current = deck.wavePeaks;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const getStrip = makeStrip("y");
    const dpr = Math.min(1.5, window.devicePixelRatio || 1);
    const observer = new ResizeObserver(() => resize());
    const resize = () => {
      const w = canvas.clientWidth * dpr;
      const h = canvas.clientHeight * dpr;
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }
    };

    const draw = () => {
      const W = canvas.width;
      const H = canvas.height;
      ctx.clearRect(0, 0, W, H);
      const centerY = H / 2;
      const secondsVisible = 8 / effectiveZoom;
      const pxPerSec = H / secondsVisible;
      const peaks = peaksRef.current;
      const dur = deck.duration;
      const t = deck.currentTime;

      const cx = W / 2;
      const halfW = W * 0.48;
      const step = Math.max(1, Math.floor(dpr));

      if (peaks && dur > 0) {
        const samples = peaks.overall.length;
        const secsPerBin = dur / samples;

        ctx.globalCompositeOperation = "source-over";
        const strip = isRgb3() ? getStrip(peaks, deck) : null;
        if (strip) {
          for (let lane = 0; lane < settings.waveTracks; lane++) {
            const laneStems = settings.waveTracks === 1 ? stemsOn(deck.stems) : settings.waveTracks === 2 ? { bass: lane === 0 && deck.stems.bass.on, drums: lane === 0 && deck.stems.drums.on, vocals: lane === 1 && deck.stems.vocals.on, other: lane === 1 && deck.stems.other.on } : { bass: lane === 0 && deck.stems.bass.on, drums: lane === 0 && deck.stems.drums.on, vocals: lane === 1 && deck.stems.vocals.on, other: lane === 2 && deck.stems.other.on };
            const laneStrip = settings.waveTracks === 1 ? strip : getLaneStrip(lane, peaks, laneStems);
            if (zoomedZigzag(effectiveZoom)) drawZigzag(ctx, peaks, laneStems, dur, t, pxPerSec, H, centerY, lane * W / settings.waveTracks, W / settings.waveTracks, "y");
            else if (laneStrip) drawRgbStrip(ctx, laneStrip, dur, t, pxPerSec, H, centerY, lane * W / settings.waveTracks, W / settings.waveTracks);
          }
        }
        else for (const [key, col, scale] of stemBands()) {
          if (!deck.stems[BAND_STEM[key as string]].on) continue;
          const arr = peaks[key] as Float32Array;
          ctx.beginPath();
          for (let y = 0; y <= H; y += step) {
            const timeAt = t + (y - centerY) / pxPerSec;
            const v = smoothAt(arr, timeAt / secsPerBin, effectiveZoom > 1) * halfW * scale;
            ctx.lineTo(cx - v, y);
          }
          for (let y = H; y >= 0; y -= step) {
            const timeAt = t + (y - centerY) / pxPerSec;
            const v = smoothAt(arr, timeAt / secsPerBin, effectiveZoom > 1) * halfW * scale;
            ctx.lineTo(cx + v, y);
          }
          ctx.closePath();
          ctx.fillStyle = col;
          ctx.globalAlpha = 0.85;
          ctx.fill();
        }
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = "source-over";

        // dim the already-played half (above the playhead)
        ctx.fillStyle = "rgba(0,0,0,0.45)";
        ctx.fillRect(0, 0, W, centerY);
      }

      // beat grid
      if (deck.bpm && deck.bpm > 40 && dur > 0) {
        const secPerBeat = 60 / deck.bpm;
        const firstBeat = Math.floor((t - secondsVisible / 2) / secPerBeat);
        const lastBeat = Math.ceil((t + secondsVisible / 2) / secPerBeat);
        for (let bi = firstBeat; bi <= lastBeat; bi++) {
          const y = centerY + (bi * secPerBeat - t) * pxPerSec;
          const isDown = bi % 4 === 0;
          ctx.fillStyle = isDown ? "rgba(255,255,255,0.32)" : "rgba(255,255,255,0.09)";
          ctx.fillRect(0, y, W, 1);
          if (isDown) {
            ctx.fillStyle = "rgba(255,255,255,0.55)";
            ctx.font = `${9 * dpr}px ui-sans-serif`;
            ctx.fillText(String(Math.max(1, Math.floor(bi / 4) + 1)), 3, y - 2);
          }
        }
      }

      // loop region highlight
      if (deck.loopActive && deck.loopStart != null && deck.loopEnd != null) {
        const y1 = centerY + (deck.loopStart - t) * pxPerSec;
        const y2 = centerY + (deck.loopEnd - t) * pxPerSec;
        ctx.fillStyle = "rgba(60,220,140,0.14)";
        ctx.fillRect(0, Math.min(y1, y2), W, Math.abs(y2 - y1));
        ctx.fillStyle = "rgba(60,220,140,0.8)";
        ctx.fillRect(0, y1, W, 1);
        ctx.fillRect(0, y2, W, 1);
      }

      // playhead
      ctx.fillStyle = "#ff3b3b";
      ctx.fillRect(0, centerY - 1, W, 2);

      // hot cue triangles
      deck.hotCues.forEach((c, i) => {
        if (!c) return;
        const y = centerY + (c.time - t) * pxPerSec;
        if (y < -10 || y > H + 10) return;
        ctx.fillStyle = ["#ff3b3b", "#ffcf3b", "#3bff8a", "#3bd2ff", "#a83bff", "#ff3bd2", "#ffffff", "#ff7a3b"][i];
        ctx.beginPath();
        if (side === "left") {
          ctx.moveTo(0, y - 7);
          ctx.lineTo(12, y);
          ctx.lineTo(0, y + 7);
        } else {
          ctx.moveTo(W, y - 7);
          ctx.lineTo(W - 12, y);
          ctx.lineTo(W, y + 7);
        }
        ctx.closePath();
        ctx.fill();
      });
    };

    const lanes = new Map<number, { key: string; strip: RgbStrip | null }>();
    const getLaneStrip = (lane: number, peaks: BandedPeaks, on: ReturnType<typeof stemsOn>) => {
      const key = JSON.stringify(on);
      let cached = lanes.get(lane);
      if (!cached || cached.key !== key) { cached = { key, strip: buildRgbStrip(peaks, on, "y") }; lanes.set(lane, cached); }
      return cached.strip;
    };
    resize(); observer.observe(canvas);
    let lastDraw = 0;
    const loop = (now: number) => {
      // idle decks redraw ~10fps to keep phones cool and responsive
      if (now - lastDraw >= (deck.playing || deck.scratchingVideo ? 1000 / 45 : 200)) { draw(); lastDraw = now; }
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => { cancelAnimationFrame(rafRef.current); observer.disconnect(); };
  }, [deck, side, effectiveZoom, settings.waveTracks, settings.waveColor]);

  const scratch = useWaveScratch(deck, "y", () => {
    const h = canvasRef.current?.clientHeight ?? 1;
    return h / (8 / effectiveZoom);
  });

  return (
    <div className={`relative w-full h-full overflow-hidden bg-background ${settings.waveHighContrast ? "wave-high-contrast" : ""}`} style={{ touchAction: "none" }} {...(settings.waveScratch ? scratch : {})}>
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full block" /><WaveAnalysisStatus deck={deck} />

      <div className={`absolute ${side === "left" ? "right-1" : "left-1"} top-1 flex flex-col gap-1`}>
        <Button variant="ghost"
          onPointerDown={event => event.stopPropagation()}
          onClick={() => setZoom((z) => Math.min(4, z * 1.4))}
          className="dj-glass size-6 p-0 rounded-md text-muted-foreground hover:text-foreground"
          title="Zoom in"
        >
          <ZoomIn className="w-3 h-3" />
        </Button>
        <Button variant="ghost"
          onPointerDown={event => event.stopPropagation()}
          onClick={() => setZoom((z) => Math.max(0.25, z / 1.4))}
          className="dj-glass size-6 p-0 rounded-md text-muted-foreground hover:text-foreground"
          title="Zoom out"
        >
          <ZoomOut className="w-3 h-3" />
        </Button>
      </div>
    </div>
  );
}

// Compact horizontal track-overview waveform for the top bar (RGB stems).
const getOverviewStrip = makeStrip("x");

export function TrackOverview({ deck, accent }: { deck: Deck; accent: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const peaksRef = useRef<BandedPeaks | null>(null);
  const rafRef = useRef(0);

  peaksRef.current = deck.wavePeaks;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const dpr = Math.min(1.5, window.devicePixelRatio || 1);
    const draw = () => {
      const w = canvas.clientWidth * dpr;
      const h = canvas.clientHeight * dpr;
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }
      ctx.clearRect(0, 0, w, h);
      const peaks = peaksRef.current;
      const cy = h / 2;
      if (!peaks) {
        ctx.fillStyle = "rgba(255,255,255,0.05)";
        ctx.fillRect(0, cy - 1, w, 2);
        return;
      }
      const strip = getOverviewStrip(peaks, deck);
      if (strip) ctx.drawImage(strip.canvas, 0, 0, strip.canvas.width, strip.canvas.height, 0, 0, w, h);
      const p = deck.duration ? deck.currentTime / deck.duration : 0;
      ctx.fillStyle = accent;
      ctx.fillRect(p * w - 1, 0, 2, h);
      deck.hotCues.forEach((c, i) => {
        if (!c || !deck.duration) return;
        const cx = (c.time / deck.duration) * w;
        ctx.fillStyle = ["#ff3b3b", "#ffcf3b", "#3bff8a", "#3bd2ff", "#a83bff", "#ff3bd2", "#ffffff", "#ff7a3b"][i];
        ctx.fillRect(cx, 0, 1, h);
      });
    };
    let frame = 0;
    const loop = () => {
      // idle decks redraw ~10fps to keep phones cool and responsive
      if (deck.playing || deck.scratchingVideo || frame++ % 6 === 0) draw();
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, [deck, accent]);

  return <canvas ref={canvasRef} className="w-full h-full block" />;
}
