import type { BandedPeaks } from "./engine";
import { BAND_STEM } from "./wavedraw";

// Full-spectrum RGB waveform (algorithm modelled on the classic 3-band RGB
// renderer used by pro DJ software): low → red, mid → green, high → blue.
// Each bin's colour is normalised so the dominant band reaches full
// brightness, and its height is the combined band magnitude.
//
// Speed: the whole track is rendered ONCE into an offscreen strip, then each
// animation frame just blits the visible slice with drawImage (GPU-scaled).

type StemsOn = Record<"bass" | "drums" | "vocals" | "other", boolean>;

export interface RgbStrip {
  canvas: HTMLCanvasElement;
  bins: number;
  axis: "y" | "x";
}

const STRIP_AMP = 256; // amplitude resolution (pixels across the strip)
const MAX_BINS = 16000;

export function rgbColumns(peaks: BandedPeaks, stems: StemsOn) {
  const on = (k: keyof BandedPeaks) => (k === "overall" ? true : stems[BAND_STEM[k as string]]);
  const n = peaks.overall.length;
  const low = new Float32Array(n);
  const mid = new Float32Array(n);
  const high = new Float32Array(n);
  let maxAll = 1e-6;
  for (let i = 0; i < n; i++) {
    const l = (on("sub") ? peaks.sub[i] : 0) + (on("bass") ? peaks.bass[i] : 0);
    const m = (on("lowMid") ? peaks.lowMid[i] : 0) + (on("mid") ? peaks.mid[i] : 0);
    const h = ((on("presence") ? peaks.presence[i] : 0) + (on("high") ? peaks.high[i] : 0)) * 1.6;
    low[i] = l;
    mid[i] = m;
    high[i] = h;
    const a = Math.sqrt(l * l + m * m + h * h);
    if (a > maxAll) maxAll = a;
  }
  return { low, mid, high, maxAll };
}

const columnCache = new WeakMap<BandedPeaks, { key: string; columns: ReturnType<typeof rgbColumns> }>();
function cachedColumns(peaks: BandedPeaks, stems: StemsOn) {
  const key = JSON.stringify(stems);
  const cached = columnCache.get(peaks);
  if (cached?.key === key) return cached.columns;
  const columns = rgbColumns(peaks, stems);
  columnCache.set(peaks, { key, columns });
  return columns;
}

/** Zigzag spikes kick in once zoomed in past the default view. */
export const zoomedZigzag = (zoom: number) => zoom > 1.05;

/** Pre-render the full track. axis "y" = time runs down (vertical decks). */
export function buildRgbStrip(peaks: BandedPeaks, stems: StemsOn, axis: "y" | "x"): RgbStrip | null {
  if (typeof document === "undefined") return null;
  const srcN = peaks.overall.length;
  const bins = Math.min(srcN, MAX_BINS);
  const { low, mid, high, maxAll } = rgbColumns(peaks, stems);
  const canvas = document.createElement("canvas");
  canvas.width = axis === "y" ? STRIP_AMP : bins;
  canvas.height = axis === "y" ? bins : STRIP_AMP;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  const img = ctx.createImageData(canvas.width, canvas.height);
  const d = img.data;
  const half = STRIP_AMP / 2;
  for (let b = 0; b < bins; b++) {
    const i = Math.floor((b * srcN) / bins);
    const l = low[i], m = mid[i], h = high[i];
    const mx = Math.max(l, m, h, 1e-6);
    const r = (l / mx) * 255, g = (m / mx) * 255, bl = (h / mx) * 255;
    const amp = Math.min(1, Math.sqrt(l * l + m * m + h * h) / maxAll);
    const ext = Math.round(amp * half);
    for (let k = -ext; k < ext; k++) {
      const a = half + k;
      // brighter core, softer edges
      const edge = 1 - Math.abs(k) / (ext + 1);
      const f = 0.55 + 0.45 * edge;
      const p = axis === "y" ? (b * STRIP_AMP + a) * 4 : (a * bins + b) * 4;
      d[p] = r * f;
      d[p + 1] = g * f;
      d[p + 2] = bl * f;
      d[p + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return { canvas, bins, axis };
}

/**
 * Zoomed-in zigzag waveform (Serato/CDJ style): at high zoom each time bin
 * becomes a sharp mirrored triangle, so transients read as crisp spikes.
 * Drawn live from the peaks (no strip) — only used for a few seconds of
 * visible audio, so the per-frame cost stays tiny. Frequency colors use the
 * exact same low/mid/high mix as the strip, so colors never change.
 */
export function drawZigzag(
  ctx: CanvasRenderingContext2D,
  peaks: BandedPeaks,
  stems: StemsOn,
  duration: number,
  t: number,
  pxPerSec: number,
  timeLen: number,
  centerPx: number,
  crossStart: number,
  crossLen: number,
  axis: "y" | "x",
) {
  if (duration <= 0) return;
  const { low, mid, high, maxAll } = cachedColumns(peaks, stems);
  const n = peaks.overall.length;
  const binsPerSec = n / duration;
  const t0 = t - centerPx / pxPerSec;
  const cx = crossStart + crossLen / 2;
  const half = crossLen * 0.48;
  const step = Math.max(1, (binsPerSec / pxPerSec) * 2); // bounded visible transients
  const b0 = Math.max(0, t0 * binsPerSec);
  const b1 = Math.min(n - 1, (t0 + timeLen / pxPerSec) * binsPerSec);
  ctx.lineWidth = 1.2;
  let prevA = 0;
  let bi = b0;
  while (bi <= b1) {
    const i = Math.floor(bi);
    const l = low[i], m = mid[i], h = high[i];
    const amp = Math.min(1, Math.sqrt(l * l + m * m + h * h) / maxAll);
    const along = (bi / binsPerSec - t0) * pxPerSec;
    const a = amp * half;
    // zigzag: alternate between the previous and current amplitude each bin
    const mx = Math.max(l, m, h, 1e-6);
    const r = (l / mx) * 255, g = (m / mx) * 255, bl = (h / mx) * 255;
    ctx.strokeStyle = `rgb(${r | 0},${g | 0},${bl | 0})`;
    ctx.beginPath();
    if (axis === "y") {
      ctx.moveTo(cx - prevA, along);
      ctx.lineTo(cx + a, along + (pxPerSec / binsPerSec) * step * 0.5);
      ctx.lineTo(cx - a, along + (pxPerSec / binsPerSec) * step);
    } else {
      ctx.moveTo(along, cx - prevA);
      ctx.lineTo(along + (pxPerSec / binsPerSec) * step * 0.5, cx + a);
      ctx.lineTo(along + (pxPerSec / binsPerSec) * step, cx - a);
    }
    ctx.stroke();
    prevA = a;
    bi += step;
  }
}

/**
 * Blit the visible window of the strip. `centerPx` is where `t` sits on the
 * time axis, `pxPerSec` the zoom, `crossStart/crossLen` the amplitude span.
 */
export function drawRgbStrip(
  ctx: CanvasRenderingContext2D,
  strip: RgbStrip,
  duration: number,
  t: number,
  pxPerSec: number,
  timeLen: number,
  centerPx: number,
  crossStart: number,
  crossLen: number,
) {
  if (duration <= 0) return;
  const binsPerSec = strip.bins / duration;
  const t0 = t - centerPx / pxPerSec;
  const t1 = t0 + timeLen / pxPerSec;
  const s0 = Math.max(0, t0 * binsPerSec);
  const s1 = Math.min(strip.bins, t1 * binsPerSec);
  if (s1 <= s0) return;
  const d0 = (s0 / binsPerSec - t0) * pxPerSec;
  const dLen = ((s1 - s0) / binsPerSec) * pxPerSec;
  if (strip.axis === "y") {
    ctx.drawImage(strip.canvas, 0, s0, STRIP_AMP, s1 - s0, crossStart, d0, crossLen, dLen);
  } else {
    ctx.drawImage(strip.canvas, s0, 0, s1 - s0, STRIP_AMP, d0, crossStart, dLen, crossLen);
  }
}

export function stemsKey(stems: Record<string, { on: boolean }>) {
  return ["bass", "drums", "vocals", "other"].map((k) => (stems[k]?.on ? 1 : 0)).join("");
}
export function stemsOn(stems: Record<string, { on: boolean }>): StemsOn {
  return {
    bass: !!stems.bass?.on,
    drums: !!stems.drums?.on,
    vocals: !!stems.vocals?.on,
    other: !!stems.other?.on,
  };
}
