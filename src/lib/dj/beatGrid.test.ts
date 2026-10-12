import { describe, expect, it } from "vitest";
import { snapToBeat } from "./beatGrid";
import { Deck, computeBandedPeaks } from "./engine";

describe("grid-snapped hot cues", () => {
  it("snaps to a corrected 120 BPM grid anchored at 0.125 seconds", () => {
    expect(snapToBeat(1.31, 120, 0.125, 20)).toBe(1.125);
    expect(snapToBeat(1.4, 120, 0.125, 20)).toBe(1.625);
  });
  it("keeps the last marker on the grid near track end", () => {
    expect(snapToBeat(1.9, 120, 0.125, 1.9)).toBe(1.625);
  });
  it("keeps unanalysed and non-quantized cues exactly where selected", () => {
    expect(snapToBeat(1.31, 0, 0, 20)).toBe(1.31);
    const deck = Object.create(Deck.prototype) as Deck;
    Object.assign(deck, { bpm: 120, firstBeat: 0.125, pausedAt: 1.31, playing: false, scratching: false, hotCues: Array(8).fill(null), quantize: false, listeners: new Set(), buffer: { duration: 20 } });
    deck.setHotCue(0);
    expect(deck.hotCues[0]?.time).toBe(1.31);
    deck.setQuantize(true);
    deck.setHotCue(1);
    expect(deck.hotCues[1]?.time).toBe(1.125);
  });
});

describe("full-rate stereo spectrum analysis", () => {
  it("preserves high-frequency content in long bins and opposite-phase stereo", () => {
    const left = Float32Array.from({ length: 48000 }, (_, i) => Math.sin(2 * Math.PI * 10000 * i / 48000));
    const right = left.map(value => -value);
    const buffer = { length: left.length, sampleRate: 48000, numberOfChannels: 2, getChannelData: (channel: number) => channel === 0 ? left : right } as AudioBuffer;
    const peaks = computeBandedPeaks(buffer, 16);
    expect(peaks.overall[8]).toBeGreaterThan(0.9);
    expect(peaks.high[8]).toBeGreaterThan(peaks.sub[8] * 10);
  });
});