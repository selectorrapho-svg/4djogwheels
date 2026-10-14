import { BandedPeaks } from "./engine";

// Frequency-coded RGB: bass red, drums yellow, vocals green, treble blue.
const RGB_BANDS: [keyof BandedPeaks, string, number][] = [
  ["sub", "rgb(240,48,56)", 1.5],
  ["bass", "rgb(255,88,65)", 1.35],
  ["lowMid", "rgb(255,214,40)", 1.2],
  ["mid", "rgb(40,235,90)", 1.12],
  ["presence", "rgb(50,160,255)", 1.0],
  ["high", "rgb(85,100,255)", 0.95],
];

export const WAVE_COLORS: { key: string; label: string; rgb: [number, number, number] | null }[] = [
  { key: "rgb3", label: "Full spectrum RGB (fast)", rgb: null },
  { key: "all", label: "RGB stem bands", rgb: null },
  { key: "red", label: "Red", rgb: [255, 48, 48] },
  { key: "green", label: "Green", rgb: [40, 230, 90] },
  { key: "blue", label: "Blue (original)", rgb: [40, 110, 255] },
  { key: "lightblue", label: "Light blue", rgb: [70, 200, 255] },
  { key: "cyan", label: "Cyan", rgb: [0, 240, 230] },
  { key: "purple", label: "Purple", rgb: [160, 70, 255] },
  { key: "pink", label: "Pink", rgb: [255, 70, 190] },
  { key: "orange", label: "Orange", rgb: [255, 140, 30] },
  { key: "yellow", label: "Yellow", rgb: [255, 225, 40] },
  { key: "lime", label: "Lime", rgb: [170, 255, 40] },
  { key: "white", label: "White", rgb: [235, 235, 235] },
  { key: "gold", label: "Gold", rgb: [230, 180, 60] },
];

// Bands for the colour chosen in Settings (read from a global set by useDjSettings).
export function stemBands(): [keyof BandedPeaks, string, number][] {
  const key = (globalThis as { __djWaveColor?: string }).__djWaveColor ?? "all";
  const c = WAVE_COLORS.find((w) => w.key === key)?.rgb;
  if (!c) return RGB_BANDS;
  return RGB_BANDS.map(([k, , sc], i) => {
    const f = 0.45 + (i / (RGB_BANDS.length - 1)) * 0.55; // low bands darker, highs brighter
    return [k, `rgb(${Math.round(c[0] * f)},${Math.round(c[1] * f)},${Math.round(c[2] * f)})`, sc];
  });
}

// Cubic (Catmull-Rom) sampling of a peak array at a fractional index.
// This is what makes the waveform stay silky when zoomed way in.
export function smoothAt(arr: Float32Array, pos: number, angular = false): number {
  const n = arr.length;
  if (n === 0) return 0;
  if (pos < 0 || pos > n - 1) return 0;
  if (pos === n - 1) return arr[n - 1];
  const i = Math.floor(pos);
  const t = pos - i;
  const p0 = arr[Math.max(0, i - 1)];
  const p1 = arr[i];
  const p2 = arr[Math.min(n - 1, i + 1)];
  const p3 = arr[Math.min(n - 1, i + 2)];
  if (angular) return Math.max(0, p1 + (p2 - p1) * t);
  const v =
    0.5 *
    (2 * p1 +
      (-p0 + p2) * t +
      (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t +
      (-p0 + 3 * p1 - 3 * p2 + p3) * t * t * t);
  return Math.max(0, v);
}

// Small moving-average pass so envelopes read as smooth curves, not spikes.
export function smoothArray(src: Float32Array, radius: number): Float32Array {
  if (radius <= 0) return src;
  const out = new Float32Array(src.length);
  let acc = 0;
  const w = radius * 2 + 1;
  for (let i = 0; i < src.length + radius; i++) {
    if (i < src.length) acc += src[i];
    if (i - w >= 0) acc -= src[i - w];
    const idx = i - radius;
    if (idx >= 0) out[idx] = acc / Math.min(w, src.length);
  }
  return out;
}

// Which stem each visual band belongs to, so removing a stem also removes its
// colour from the waveform (djay-style stem visualisation).
export const BAND_STEM: Record<string, "bass" | "drums" | "vocals" | "other"> = {
  sub: "bass",
  bass: "bass",
  lowMid: "drums",
  mid: "vocals",
  presence: "other",
  high: "other",
};
