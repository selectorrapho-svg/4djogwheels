import { describe, expect, it } from "vitest";
import { angleToSeconds, coastTau, crossfaderGains } from "./scratchMath";

describe("scratch math", () => {
  it("one platter revolution = 1.8 s of audio at sensitivity 1", () => {
    expect(angleToSeconds(2 * Math.PI, 1)).toBeCloseTo(1.8);
    expect(angleToSeconds(-2 * Math.PI, 2)).toBeCloseTo(-3.6);
  });
  it("higher friction stops a fling faster", () => {
    expect(coastTau(1)).toBeLessThan(coastTau(0));
  });
  it("scratch curve cuts fully closed at the edge and fully open just past the lag", () => {
    expect(crossfaderGains(0, "scratch", 0.02)).toEqual([1, 0]);
    expect(crossfaderGains(0.03, "scratch", 0.02)).toEqual([1, 1]);
    expect(crossfaderGains(1, "scratch", 0.02)).toEqual([0, 1]);
  });
  it("hamster reverse swaps sides", () => {
    expect(crossfaderGains(0, "scratch", 0.02, true)).toEqual([0, 1]);
  });
});
