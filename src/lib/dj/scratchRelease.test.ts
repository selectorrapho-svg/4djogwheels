import { describe, expect, it } from "vitest";
import { releaseVelocity } from "./scratchMath";

describe("platter release", () => {
  it("uses the last reverse segment after a fast forward chirp", () => {
    expect(releaseVelocity([0, 0, 10, 1, 20, 2, 30, 1.8, 40, 1.6], 40, 1)).toBeLessThan(0);
  });
  it("does not fling after the hand has rested", () => {
    expect(releaseVelocity([0, 0, 10, 1], 100, 1)).toBe(0);
  });
});