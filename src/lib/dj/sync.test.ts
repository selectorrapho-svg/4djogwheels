import { describe, expect, it, vi, afterEach } from "vitest";
import { syncPitch, playbackPosition, phaseError } from "./sync";
import { Deck } from "./engine";

vi.mock("./nativeAudio", () => ({ isNative: () => false, native: { rate: vi.fn() } }));

function deck(bpm: number) {
  const value = Object.create(Deck.prototype) as Deck;
  Object.assign(value, {
    bpm, firstBeat: 0, rate: 1, pitch: 0, pausedAt: 10, startedAt: 0,
    playing: true, buffer: { duration: 120 }, ctx: { currentTime: 5 },
    listeners: new Set(), source: { playbackRate: { value: 1 } },
    syncLocked: false, syncMaster: null, syncTimer: null, scratching: false,
  });
  value.seek = vi.fn(t => { value.pausedAt = t; value.startedAt = value.ctx.currentTime; });
  return value;
}
afterEach(() => vi.useRealTimers());
describe("stable directed DJ sync", () => {
  it("matches the master's actual pitched BPM", () => {
    expect(syncPitch({ bpm: 120, rate: 1.1, currentTime: 0, firstBeat: 0 }, { bpm: 100, rate: 1, currentTime: 0, firstBeat: 0 })).toBeCloseTo(32);
  });
  it("preserves position when pitch changes during playback", () => {
    const d = deck(120);
    expect(d.currentTime).toBe(15);
    d.setPitch(10);
    expect(d.currentTime).toBe(15);
    Object.assign(d.ctx, { currentTime: 6 });
    expect(d.currentTime).toBeCloseTo(16.1);
    expect(playbackPosition(15, 5, 6, 1.1)).toBeCloseTo(16.1);
  });
  it("does not hunt pitch or repeatedly seek after sync", () => {
    vi.useFakeTimers();
    const master = deck(120), follower = deck(100);
    follower.toggleSync(master);
    expect(follower.pitch).toBeCloseTo(20);
    for (let i = 0; i < 40; i++) {
      Object.assign(master.ctx, { currentTime: 5 + i * 0.25 });
      Object.assign(follower.ctx, { currentTime: 5 + i * 0.25 });
      vi.advanceTimersByTime(250);
      expect(follower.pitch).toBeCloseTo(20);
    }
    expect(follower.seek).toHaveBeenCalledTimes(1);
    follower.toggleSync(master);
  });
  it("breaks reciprocal sync rather than making both decks chase each other", () => {
    vi.useFakeTimers();
    const left = deck(120), right = deck(100);
    right.toggleSync(left); left.toggleSync(right);
    expect(right.syncLocked).toBe(false);
    expect(left.syncLocked).toBe(true);
    left.toggleSync(right);
  });
  it("reports a follower that is behind the master's kick as needing to speed up", () => {
    // master is 0.1 beat into the bar, follower exactly on the beat → follower behind
    const err = phaseError({ bpm: 120, rate: 1, currentTime: 0.05, firstBeat: 0 }, { bpm: 120, rate: 1, currentTime: 0, firstBeat: 0 });
    expect(err).toBeCloseTo(0.1);
  });
  it("pulls phase back with a hidden nudge, never changing the visible pitch", () => {
    vi.useFakeTimers();
    const master = deck(120), follower = deck(120);
    follower.toggleSync(master);
    follower.pausedAt -= 0.05; // drift 0.1 beat behind
    vi.advanceTimersByTime(100);
    expect(follower.pitch).toBeCloseTo(0);
    expect(follower.source!.playbackRate.value).toBeGreaterThan(1);
    follower.toggleSync(master);
  });
});
