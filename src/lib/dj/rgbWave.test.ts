import { describe, expect, it } from "vitest";
import { rgbColumns, stemsKey, stemsOn } from "./rgbWave";

describe("stem-aware waveform", () => {
  const peaks = { overall: new Float32Array([1]), sub: new Float32Array([0.1]), bass: new Float32Array([0.2]), lowMid: new Float32Array([0.3]), mid: new Float32Array([0.8]), presence: new Float32Array([0.2]), high: new Float32Array([0.1]) };
  const stems = { bass: { on: true }, drums: { on: true }, vocals: { on: true }, other: { on: true } };
  it("removes green vocals without removing the beat", () => {
    const full = rgbColumns(peaks, stemsOn(stems));
    const muted = rgbColumns(peaks, stemsOn({ ...stems, vocals: { on: false } }));
    expect(muted.mid[0]).toBe(0);
    expect(muted.low[0]).toBe(full.low[0]);
    expect(muted.high[0]).toBe(full.high[0]);
  });
  it("tracks stem fader levels and invalidates cached strips", () => {
    const levels = { bass: 1, drums: 1, vocals: 0.5, other: 1 };
    expect(rgbColumns(peaks, stemsOn(stems, levels)).mid[0]).toBeCloseTo(0.4);
    expect(stemsKey(stems, levels)).not.toBe(stemsKey(stems));
  });
});