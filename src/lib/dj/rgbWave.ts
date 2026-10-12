import type { BandedPeaks } from "./engine";
import { BAND_STEM, RGB_BANDS } from "./wavedraw";

// Original six-band spectrum palette, shared with the legacy envelopes.
// Colour blends every active frequency band; waveform height still
// uses the existing combined magnitude, preserving the current geometry.
//
// Speed: the whole track is rendered ONCE into an offscreen strip, then each
// animation frame just blits the visible slice with drawImage (GPU-scaled).

type StemsOn = Record<"bass" | "drums" | "vocals" | "other", boolean | number>;

export interface RgbStrip {
  canvas: HTMLCanvasElement;
  bins: number;
  axis: "y" | "x";
}

const STRIP_AMP = 256; // amplitude resolution (pixels across the strip)
const MAX_BINS = 16000;

const SPECTRUM = RGB_BANDS.map(([band, color, scale]) => ({
  band,
  scale,
  rgb: (color.match(/\d+/g) ?? []).map(Number),
}));

export function spectrumColor(peaks: BandedPeaks, stems: StemsOn, index: number): number[] {
  const color = [0, 0, 0];
  let total = 0;
  for (const entry of SPECTRUM) {
    // Loud bass must not discard mids/highs. Perceptual compression retains
    // quieter bands, unlike the previous winner-takes-all red/yellow mapping.
    const energy = Math.sqrt(Math.max(0, peaks[entry.band][index] * Number(stems[BAND_STEM[entry.band]]))) * entry.scale;
    total += energy;
    for (let channel = 0; channel < 3; channel++) color[channel] += entry.rgb[channel] * energy;
  }
  if (total === 0) return color;
  const brightness = Math.max(...color) / 255;
  return color.map(value => Math.round(value / brightness));
}

export function rgbColumns(peaks: BandedPeaks, stems: StemsOn) {
  const level = (k: keyof BandedPeaks) => k === "overall" ? 1 : Number(stems[BAND_STEM[k as string]]);
  const n = peaks.overall.length;
  const low = new Float32Array(n);
  const mid = new Float32Array(n);
  const high = new Float32Array(n);
  let maxAll = 1e-6;
  for (let i = 0; i < n; i++) {
    // Keep green exclusive to vocals; drums retain red/yellow energy.
    const l = peaks.sub[i] * level("sub") + peaks.bass[i] * level("bass") + peaks.lowMid[i] * level("lowMid");
    const m = peaks.mid[i] * level("mid");
    const h = peaks.presence[i] * level("presence") + peaks.high[i] * level("high");
    low[i] = l;
    mid[i] = m;
    high[i] = h;
    const a = Math.sqrt(l * l + m * m + h * h);
    if (a > maxAll) maxAll = a;
  }
  return { low, mid, high, maxAll };
}

export type WaveStyle = "rgb" | "blocks" | "bars";

const columnCache = new WeakMap<BandedPeaks, { key: string; columns: ReturnType<typeof rgbColumns> }>();
function cachedColumns(peaks: BandedPeaks, stems: StemsOn) {
  const key = JSON.stringify(stems);
  const cached = columnCache.get(peaks);
  if (cached?.key === key) return cached.columns;
  const columns = rgbColumns(peaks, stems);
  columnCache.set(peaks, { key, columns });
  return columns;
}

export const zoomedZigzag = (zoom: number) => zoom > 1.05 || isZigzag();

/** Pre-render the full track. axis "y" = time runs down (vertical decks). */
export function buildRgbStrip(peaks: BandedPeaks, stems: StemsOn, axis: "y" | "x", style: WaveStyle = "rgb"): RgbStrip | null {
  if (typeof document === "undefined") return null;
  const srcN = peaks.overall.length;
  const bins = Math.min(srcN, MAX_BINS);
  const { low, mid, high, maxAll } = cachedColumns(peaks, stems);
  const canvas = document.createElement("canvas");
  canvas.width = axis === "y" ? STRIP_AMP : bins;
  canvas.height = axis === "y" ? bins : STRIP_AMP;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  const img = ctx.createImageData(canvas.width, canvas.height);
  const d = img.data;
  const half = STRIP_AMP / 2;
  // Serato-style band palette for the "blocks" and "bars" styles.
  const BLOCK = { low: [255, 84, 17], mid: [255, 176, 32], high: [40, 220, 235] } as const;
  const BAR = [
    [255, 60, 60],   // sub
    [255, 140, 40],  // bass
    [80, 220, 120],  // lowMid
    [60, 200, 255],  // mid
    [120, 130, 255], // presence
    [220, 220, 255], // high
  ] as const;
  for (let b = 0; b < bins; b++) {
    const i = Math.floor((b * srcN) / bins);
    const l = low[i], m = mid[i], h = high[i];
    if (style === "bars") {
      // Stacked spectrum bars: each frequency band gets an equal slice of the
      // amplitude axis, filled by that band's energy — like a per-column FFT.
      const total = l + m + h + 1e-6;
      const norm = Math.min(1, Math.sqrt(l * l + m * m + h * h) / maxAll);
      const shares = [l * 0.5, l * 0.5, m * 0.55, m * 0.45, h * 0.6, h * 0.4].map((v) => v / total);
      let a = 0;
      for (let band = 0; band < 6; band++) {
        const span = Math.round(shares[band] * norm * half);
        const c = BAR[band];
        for (let k = 0; k < span; k++) {
          for (const sgn of [-1, 1]) {
            const px = half + sgn * (a + k);
            if (px < 0 || px >= STRIP_AMP) continue;
            const p = axis === "y" ? (b * STRIP_AMP + px) * 4 : (px * bins + b) * 4;
            d[p] = c[0]; d[p + 1] = c[1]; d[p + 2] = c[2]; d[p + 3] = 255;
          }
        }
        a += span;
      }
      continue;
    }
    // Use the original project's full six-colour frequency spectrum.
    let [r, g, bl] = spectrumColor(peaks, stems, i);
    if (style === "blocks") {
      // Dominant band picks a fixed pro-DJ colour instead of a blend.
      const c = l >= m && l >= h ? BLOCK.low : m >= h ? BLOCK.mid : BLOCK.high;
      r = c[0]; g = c[1]; bl = c[2];
    }
    const amp = Math.min(1, Math.sqrt(l * l + m * m + h * h) / maxAll);
    const ext = Math.round(amp * half);
    for (let k = -ext; k < ext; k++) {
      const a = half + k;
      // rgb: brighter core, softer edges. blocks: solid hard-edged fill.
      const edge = 1 - Math.abs(k) / (ext + 1);
      const f = style === "blocks" ? 1 : 0.55 + 0.45 * edge;
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
 * visible audio, so the per-frame cost stays tiny.
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
  const step = Math.max(1, binsPerSec / pxPerSec * 2); // bounded visible transients
  const b0 = Math.max(0, t0 * binsPerSec);
  const b1 = Math.min(n - 1, (t0 + timeLen / pxPerSec) * binsPerSec);
  ctx.lineWidth = 1.2;
  let prevA = 0;
  let bi = b0;
  while (bi <= b1) {
    const i = Math.floor(bi);
    const l = low[i], m = mid[i], h = high[i];
    const amp = Math.min(1, Math.sqrt(l * l + m * m + h * h) / maxAll);
    const along = ((bi / binsPerSec) - t0) * pxPerSec;
    const a = amp * half;
    // zigzag: alternate between the previous and current amplitude each bin
    const [r, g, bl] = spectrumColor(peaks, stems, i);
    ctx.strokeStyle = `rgb(${r},${g},${bl})`;
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
  ctx.imageSmoothingEnabled = true;
  if (strip.axis === "y") {
    ctx.drawImage(strip.canvas, 0, s0, STRIP_AMP, s1 - s0, crossStart, d0, crossLen, dLen);
  } else {
    ctx.drawImage(strip.canvas, s0, 0, s1 - s0, STRIP_AMP, d0, crossStart, dLen, crossLen);
  }
}

/** Current waveform style from settings. null = legacy per-band envelopes. */
export function waveStyle(): WaveStyle | null {
  const c = (globalThis as { __djWaveColor?: string }).__djWaveColor ?? "rgb3";
  if (c === "rgb3" || c === "zigzag") return "rgb";
  if (c === "beat") return "blocks";
  if (c === "bars") return "bars";
  return null;
}
export const isZigzag = () => ((globalThis as { __djWaveColor?: string }).__djWaveColor ?? "rgb3") === "zigzag";

export function stemsKey(stems: Record<string, { on: boolean }>, levels?: Record<string, number>) {
  return ["bass", "drums", "vocals", "other"].map((k) => stems[k]?.on ? (levels?.[k] ?? 1).toFixed(2) : "0").join(":");
}
export function stemsOn(stems: Record<string, { on: boolean }>, levels?: Record<string, number>): StemsOn {
  return {
    bass: stems.bass?.on ? levels?.bass ?? 1 : 0,
    drums: stems.drums?.on ? levels?.drums ?? 1 : 0,
    vocals: stems.vocals?.on ? levels?.vocals ?? 1 : 0,
    other: stems.other?.on ? levels?.other ?? 1 : 0,
  };
}
