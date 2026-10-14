import { WaveAnalysisStatus } from "./WaveAnalysisStatus";
import { useEffect, useRef, useState } from "react";
import { Deck, BandedPeaks } from "@/lib/dj/engine";
import { stemBands, smoothAt, BAND_STEM } from "@/lib/dj/wavedraw";
import { ZoomIn, ZoomOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useDjSettings } from "@/hooks/useDjSettings";
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
import { useWaveScratch } from "@/lib/dj/useWaveScratch";


interface Props {
  deck: Deck;
  color: string;
  index: 1 | 2;
}

// Horizontal scrolling stem waveform — smooth interpolated RGB envelopes.
export function HorizontalWaveform({ deck, color, index }: Props) {
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
    const getStrip = makeStrip("x");
    const dpr = Math.min(1.5, window.devicePixelRatio || 1);
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
      const cy = H / 2;
      const secondsVisible = 8 / effectiveZoom;
      const pxPerSec = W / secondsVisible;
      const peaks = peaksRef.current;
      const dur = deck.duration;
      const t = deck.currentTime;

      if (!peaks || dur === 0) {
        ctx.fillStyle = "rgba(255,255,255,0.06)";
        ctx.fillRect(0, cy - 1, W, 2);
        ctx.fillStyle = "#ff3b3b";
        ctx.fillRect(W / 2 - 1, 0, 2, H);
        return;
      }

      const samples = peaks.overall.length;
      const secsPerBin = dur / samples;
      const step = Math.max(1, Math.floor(dpr));

      ctx.globalCompositeOperation = "source-over";
      const strip = isRgb3() ? getStrip(peaks, deck) : null;
      if (strip) {
        for (let lane = 0; lane < settings.waveTracks; lane++) {
          const on = settings.waveTracks === 1 ? stemsOn(deck.stems) : { bass: lane === 0 && deck.stems.bass.on, drums: lane === 0 && deck.stems.drums.on, vocals: lane === 1 && deck.stems.vocals.on, other: (settings.waveTracks === 2 ? lane === 1 : lane === 2) && deck.stems.other.on };
          const laneStrip = settings.waveTracks === 1 ? strip : getLaneStrip(lane, peaks, on);
          if (zoomedZigzag(effectiveZoom)) drawZigzag(ctx, peaks, on, dur, t, pxPerSec, W, W / 2, lane * H / settings.waveTracks, H / settings.waveTracks, "x");
          else if (laneStrip) drawRgbStrip(ctx, laneStrip, dur, t, pxPerSec, W, W / 2, lane * H / settings.waveTracks, H / settings.waveTracks);
        }
      }
      else for (const [key, col, scale] of stemBands()) {
        if (!deck.stems[BAND_STEM[key as string]].on) continue;
        const arr = peaks[key] as Float32Array;
        // smooth filled envelope (mirrored) — silky at any zoom
        ctx.beginPath();
        ctx.moveTo(0, cy);
        for (let x = 0; x <= W; x += step) {
          const timeAt = t + (x - W / 2) / pxPerSec;
          const v = smoothAt(arr, timeAt / secsPerBin, effectiveZoom > 1) * cy * scale;
          ctx.lineTo(x, cy - v);
        }
        for (let x = W; x >= 0; x -= step) {
          const timeAt = t + (x - W / 2) / pxPerSec;
          const v = smoothAt(arr, timeAt / secsPerBin, effectiveZoom > 1) * cy * scale;
          ctx.lineTo(x, cy + v);
        }
        ctx.closePath();
        ctx.fillStyle = col;
        ctx.globalAlpha = 0.85;
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = "source-over";

      // dim the already-played half
      ctx.fillStyle = "rgba(0,0,0,0.45)";
      ctx.fillRect(0, 0, W / 2, H);

      // beat grid
      if (deck.bpm && deck.bpm > 40) {
        const secPerBeat = 60 / deck.bpm;
        const firstBeat = Math.floor((t - secondsVisible / 2) / secPerBeat);
        const lastBeat = Math.ceil((t + secondsVisible / 2) / secPerBeat);
        for (let bi = firstBeat; bi <= lastBeat; bi++) {
          const bx = W / 2 + (bi * secPerBeat - t) * pxPerSec;
          const isDown = bi % 4 === 0;
          ctx.fillStyle = isDown ? "rgba(255,255,255,0.28)" : "rgba(255,255,255,0.09)";
          ctx.fillRect(bx, isDown ? 0 : H * 0.15, 1, isDown ? H : H * 0.7);
          if (isDown) {
            ctx.fillStyle = "rgba(255,255,255,0.55)";
            ctx.font = `${10 * dpr}px ui-sans-serif`;
            ctx.fillText(String(Math.max(1, Math.floor(bi / 4) + 1)), bx + 3, 11 * dpr);
          }
        }
      }

      // playhead
      ctx.fillStyle = "#ff3b3b";
      ctx.fillRect(W / 2 - 1, 0, 2, H);

      // hot cues
      deck.hotCues.forEach((c, i) => {
        if (!c) return;
        const x = W / 2 + (c.time - t) * pxPerSec;
        if (x < -10 || x > W + 10) return;
        const cuc = ["#ff3b3b", "#ffcf3b", "#3bff8a", "#3bd2ff", "#a83bff", "#ff3bd2", "#ffffff", "#ff7a3b"][i];
        ctx.fillStyle = cuc;
        ctx.beginPath();
        ctx.moveTo(x - 6, 0);
        ctx.lineTo(x + 6, 0);
        ctx.lineTo(x, 8);
        ctx.closePath();
        ctx.fill();
        ctx.fillRect(x - 0.5, 0, 1, H);
      });

      // deck label
      ctx.fillStyle = color;
      ctx.font = `${12 * dpr}px ui-sans-serif`;
      ctx.fillText(String(index), 6, 14 * dpr);
    };

    const lanes = new Map<number, { key: string; strip: RgbStrip | null }>();
    const getLaneStrip = (lane: number, peaks: BandedPeaks, on: ReturnType<typeof stemsOn>) => {
      const key = JSON.stringify(on); let cached = lanes.get(lane);
      if (!cached || cached.key !== key) { cached = { key, strip: buildRgbStrip(peaks, on, "x") }; lanes.set(lane, cached); }
      return cached.strip;
    };
    resize(); const observer = new ResizeObserver(resize); observer.observe(canvas);
    let lastDraw = 0;
    const loop = (now: number) => {
      // idle decks redraw ~10fps to keep phones cool and responsive
      if (now - lastDraw >= (deck.playing || deck.scratchingVideo ? 1000 / 45 : 200)) { draw(); lastDraw = now; }
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => { cancelAnimationFrame(rafRef.current); observer.disconnect(); };
  }, [deck, color, index, effectiveZoom, settings.waveTracks, settings.waveColor]);

  const scratch = useWaveScratch(deck, "x", () => {
    const w = canvasRef.current?.clientWidth ?? 1;
    return w / (8 / effectiveZoom);
  });

  return (
    <div className={`relative w-full h-full bg-background ${settings.waveHighContrast ? "wave-high-contrast" : ""}`} style={{ touchAction: "none" }} {...(settings.waveScratch ? scratch : {})}>
      <canvas ref={canvasRef} className="w-full h-full block" /><WaveAnalysisStatus deck={deck} />

      <div className="absolute right-1 top-1 flex gap-1">
        <Button variant="ghost"
          onPointerDown={event => event.stopPropagation()}
          onClick={() => setZoom((z) => Math.min(4, z * 1.4))}
          className="dj-glass size-6 p-0 rounded-md text-muted-foreground"
        >
          <ZoomIn className="w-3 h-3" />
        </Button>
        <Button variant="ghost"
          onPointerDown={event => event.stopPropagation()}
          onClick={() => setZoom((z) => Math.max(0.25, z / 1.4))}
          className="dj-glass size-6 p-0 rounded-md text-muted-foreground"
        >
          <ZoomOut className="w-3 h-3" />
        </Button>
      </div>
    </div>
  );
}
