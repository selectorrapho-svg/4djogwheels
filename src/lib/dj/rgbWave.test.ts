import { describe, expect, it } from "vitest";
import { rgbColumns, spectrumColor, stemsKey, stemsOn } from "./rgbWave";

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
  it("retains green vocals and cyan highs beneath stronger red bass", () => {
    const bass = { ...peaks, sub: new Float32Array([1]), bass: new Float32Array([1]), lowMid: new Float32Array([0]), mid: new Float32Array([0.25]), presence: new Float32Array([0.25]), high: new Float32Array([0.25]) };
    const color = spectrumColor(bass, stemsOn(stems), 0);
    const muted = spectrumColor(bass, stemsOn({ ...stems, vocals: { on: false }, other: { on: false } }), 0);
    expect(color[1]).toBeGreaterThan(muted[1] + 30);
    expect(color[2]).toBeGreaterThan(muted[2] + 30);
  });
  it("renders isolated vocals green and presence cyan", () => {
    const silent = Object.fromEntries(Object.keys(peaks).map(key => [key, new Float32Array([0])])) as typeof peaks;
    const vocal = spectrumColor({ ...silent, mid: new Float32Array([1]) }, stemsOn(stems), 0);
    const cyan = spectrumColor({ ...silent, presence: new Float32Array([1]) }, stemsOn(stems), 0);
    expect(vocal).toEqual([43, 255, 98]);
    expect(cyan).toEqual([0, 255, 244]);
  });
});