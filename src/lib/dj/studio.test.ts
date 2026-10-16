import { describe, it, expect } from 'vitest';
import { studioSchedule, studioDuration, clipDuration, studioPlacement, studioPitch, studioGridStep, syncClip, studioFades, type StudioClip } from './studio';
const clip = (id: number, startBeat = 0): StudioClip => ({ id, startBeat, name: 'audio', buffer: { duration: 4 } as AudioBuffer, gain: 1, mute: false, solo: false });
describe('Studio audio timeline', () => {
  it('schedules clips and seeks against the same beat clock', () => {
    const clips = [clip(1), clip(2, 8)];
    const schedule = studioSchedule(clips, 120, 2);
    expect(schedule[0].offset).toBe(2);
    expect(schedule[1].delay).toBe(2);
    expect(studioDuration(clips, 120)).toBe(8);
  });
  it('excludes muted tracks and honors solo', () => {
    const clips = [clip(1), { ...clip(2), solo: true }, { ...clip(3), mute: true, solo: true }];
    expect(studioSchedule(clips, 120).map(s => s.clip.id)).toEqual([2]);
  });
  it('does not restart clips that have already ended', () => {
    expect(studioSchedule([clip(1)], 120, 4)).toHaveLength(0);
  });
});import { splitClip } from './studio';
describe('Studio split', () => {
  it('refuses to split outside the clip', () => {
    expect(splitClip(clip(1, 8), 1, 120, 9)).toBeNull();
    expect(splitClip(clip(1, 0), 5, 120, 9)).toBeNull();
  });
});
describe('Studio editing rules', () => {
  it('allows exact free placement without rounding to a grid', () => {
    expect(studioPlacement(3.137, false)).toBe(3.137);
    expect(studioPlacement(3.137, true, 0.25)).toBe(3.25);
  });
  it('limits independent pitch to minus and plus 24 semitones', () => {
    expect(studioPitch(-25)).toBe(-24); expect(studioPitch(25)).toBe(24);
  });
  it('uses stretched output time for playback, export and duplication', () => {
    const stretched = { ...clip(1), stretch: 2, pitch: 12 };
    expect(clipDuration(stretched)).toBe(8);
    expect(studioDuration([stretched], 120)).toBe(8);
    expect(studioSchedule([stretched], 120, 7)[0].offset).toBe(7);
  });
  it('syncs clip length to the project beat clock', () => {
    expect(clipDuration(syncClip(clip(1), 120, 4))).toBe(2);
  });
  it('reveals eighth-beat grid divisions at close zoom', () => {
    expect(studioGridStep(28)).toBe(1); expect(studioGridStep(160)).toBe(0.125);
  });
  it("continues subdividing at very close zoom for thin clip edits", () => {
    expect(studioGridStep(640)).toBe(1 / 32);
    expect(studioGridStep(4096)).toBe(1 / 128);
  });
  it('clamps independent fades so they never overlap', () => {
    const faded = { ...clip(1), fadeIn: 3, fadeOut: 3 };
    const env = studioFades(faded, 4, 10);
    expect(env.fadeInEnd).toBe(12);
    expect(env.fadeOutStart).toBe(12);
    expect(env.fadeOutEnd).toBe(14);
    const short = studioFades({ ...clip(1), fadeIn: 9, fadeOut: 0 }, 1, 0);
    expect(short.fadeInEnd).toBe(1);
    expect(short.fadeOutEnd).toBe(1);
  });
});
import { trimClip } from './studio';
class FakeBuf { numberOfChannels = 1; sampleRate = 1000; data: Float32Array; constructor(o: { length: number }) { this.data = new Float32Array(o.length); } get length() { return this.data.length; } get duration() { return this.length / 1000; } getChannelData() { return this.data; } copyToChannel(src: Float32Array) { this.data.set(src); } }
describe('Studio trim and split', () => {
  (globalThis as any).AudioBuffer = FakeBuf;
  const src = new FakeBuf({ length: 4000 }) as unknown as AudioBuffer;
  const base: StudioClip = { id: 1, startBeat: 0, name: 'a', buffer: src, gain: 1, mute: false, solo: false };
  it('split keeps the full source so either half can be expanded back out', () => {
    const parts = splitClip(base, 1, 120, 2);
    expect(parts).not.toBeNull();
    if (!parts) return;
    const [a, b] = parts;
    expect(a.buffer.duration).toBe(1);
    expect(b.srcStart).toBe(1);
    expect(trimClip(b, 0, 4).buffer.duration).toBe(4);
  });
  it('splits very small clips', () => {
    const tiny = trimClip(base, 0, 0.05);
    expect(splitClip(tiny, 0.025, 120, 3)?.[1].buffer.duration).toBeCloseTo(0.025);
  });
});
