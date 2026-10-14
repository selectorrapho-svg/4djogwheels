import { describe, expect, it } from "vitest";
import { rgbColumns, stemsKey, stemsOn } from "./rgbWave";

// Band → stem map (wavedraw.BAND_STEM): sub/bass→bass, lowMid→drums,
// mid→vocals, presence/high→other.
describe("stem-aware waveform", () => {
  const peaks = { overall: new Float32Array([1]), sub: new Float32Array([0.1]), bass: new Float32Array([0.2]), lowMid: new Float32Array([0.3]), mid: new Float32Array([0.8]), presence: new Float32Array([0.2]), high: new Float32Array([0.1]) };
  const stems = { bass: { on: true }, drums: { on: true }, vocals: { on: true }, other: { on: true } };

  it("muting vocals removes only the vocal band from the mid column", () => {
    const muted = rgbColumns(peaks, stemsOn({ ...stems, vocals: { on: false } }));
    expect(muted.mid[0]).toBeCloseTo(0.3); // drums (lowMid) remain
    const silent = rgbColumns(peaks, stemsOn({ ...stems, vocals: { on: false }, drums: { on: false } }));
    expect(silent.mid[0]).toBe(0);
  });

  it("keeps low and high columns when vocals are muted", () => {
    const full = rgbColumns(peaks, stemsOn(stems));
    const muted = rgbColumns(peaks, stemsOn({ ...stems, vocals: { on: false } }));
    expect(muted.low[0]).toBe(full.low[0]);
    expect(muted.high[0]).toBe(full.high[0]);
  });

  it("boosts the high column so treble stays visible", () => {
    const { high } = rgbColumns(peaks, stemsOn(stems));
    expect(high[0]).toBeCloseTo((0.2 + 0.1) * 1.6);
  });

  it("cache key follows which stems are on", () => {
    expect(stemsKey(stems)).toBe("1111");
    expect(stemsKey({ ...stems, vocals: { on: false } })).toBe("1101");
    expect(stemsOn({})).toEqual({ bass: false, drums: false, vocals: false, other: false });
  });
});
