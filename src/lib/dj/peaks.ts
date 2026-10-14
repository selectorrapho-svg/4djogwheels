const STEM_ORDER = ["drums", "bass", "other", "vocals"] as const;
export interface BandedPeaks {
  sub: Float32Array;
  bass: Float32Array;
  lowMid: Float32Array;
  mid: Float32Array;
  high: Float32Array;
  presence: Float32Array;
  overall: Float32Array;
}

// Six frequency bands from both channels. These are spectral energy envelopes,
// not separated instrumental/vocal source tracks.
const peakCache = new WeakMap<AudioBuffer, Map<number, BandedPeaks>>();
export function computeBandedPeaks(buffer: AudioBuffer, bins: number, progress?: (value: number) => void): BandedPeaks {
  const cached = peakCache.get(buffer)?.get(bins);
  if (cached) return cached;
  if (buffer.numberOfChannels === 8) {
    const peaks: BandedPeaks = { overall: new Float32Array(bins), sub: new Float32Array(bins), bass: new Float32Array(bins), lowMid: new Float32Array(bins), mid: new Float32Array(bins), presence: new Float32Array(bins), high: new Float32Array(bins) };
    // Real separated stereo pairs: drums, bass, harmonic, vocals.
    STEM_ORDER.forEach((stem, pair) => {
      const left = buffer.getChannelData(pair * 2), right = buffer.getChannelData(pair * 2 + 1);
      const band = stem === "drums" ? peaks.lowMid : stem === "bass" ? peaks.bass : stem === "vocals" ? peaks.mid : peaks.high;
      for (let bin = 0; bin < bins; bin++) {
        const start = Math.floor(bin * buffer.length / bins), end = Math.floor((bin + 1) * buffer.length / bins);
        let energy = 0;
        for (let i = start; i < end; i++) energy = Math.max(energy, Math.abs(left[i]), Math.abs(right[i]));
        band[bin] = energy; peaks.overall[bin] += energy;
      }
    });
    const cache = peakCache.get(buffer) ?? new Map<number, BandedPeaks>();
    cache.set(bins, peaks); peakCache.set(buffer, cache); return peaks;
  }
  const data = buffer.getChannelData(0);
  const right = buffer.numberOfChannels > 1 ? buffer.getChannelData(1) : data;
  const sr = buffer.sampleRate;
  const cutoffs = [110, 420, 1800, 5200, 9500];
  const states = [[0, 0, 0, 0, 0], [0, 0, 0, 0, 0]];
  const coefficients = cutoffs.map(c => Math.exp(-2 * Math.PI * c / sr));
  const sub = new Float32Array(bins);
  const bass = new Float32Array(bins);
  const lowMid = new Float32Array(bins);
  const mid = new Float32Array(bins);
  const high = new Float32Array(bins);
  const presence = new Float32Array(bins);
  const overall = new Float32Array(bins);
  for (let i = 0; i < bins; i++) {
    if (i % 160 === 0) progress?.(i / bins);
    let s = 0, b = 0, lm = 0, m = 0, p = 0, h = 0, o = 0;
    const start = Math.floor(i * data.length / bins);
    const end = Math.min(data.length, Math.floor((i + 1) * data.length / bins));
    // Filter at the original sample rate: skipping samples aliases cymbals
    // and vocals into bass. Measure each stereo channel before combining so
    // out-of-phase content cannot disappear from the spectral display.
    const a = coefficients;
    for (let j = start; j < end; j++) {
      for (let channel = 0; channel < 2; channel++) {
      const x = channel === 0 ? data[j] : right[j];
      const lp = states[channel];
      lp[0] = a[0] * lp[0] + (1 - a[0]) * x;
      lp[1] = a[1] * lp[1] + (1 - a[1]) * x;
      lp[2] = a[2] * lp[2] + (1 - a[2]) * x;
      lp[3] = a[3] * lp[3] + (1 - a[3]) * x;
      lp[4] = a[4] * lp[4] + (1 - a[4]) * x;
      const bSub = lp[0];
      const bBass = lp[1] - lp[0];
      const bLowMid = lp[2] - lp[1];
      const bMid = lp[3] - lp[2];
      const bPresence = lp[4] - lp[3];
      const bHigh = x - lp[4];
      const as = Math.abs(bSub);
      const ab = Math.abs(bBass);
      const alm = Math.abs(bLowMid);
      const am = Math.abs(bMid);
      const ah = Math.abs(bHigh);
      const ap = Math.abs(bPresence);
      const ao = Math.abs(x);
      if (as > s) s = as;
      if (ab > b) b = ab;
      if (alm > lm) lm = alm;
      if (am > m) m = am;
      if (ah > h) h = ah;
      if (ap > p) p = ap;
      if (ao > o) o = ao;
      }
    }
    sub[i] = s;
    bass[i] = b;
    lowMid[i] = lm;
    mid[i] = m;
    high[i] = h;
    presence[i] = p;
    overall[i] = o;
  }
  const result = { sub, bass, lowMid, mid, presence, high, overall };
  const cache = peakCache.get(buffer) ?? new Map<number, BandedPeaks>();
  cache.set(bins, result);
  peakCache.set(buffer, cache);
  return result;
}

