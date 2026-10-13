import { describe, it, expect } from 'vitest';
import { studioSchedule, studioDuration, type StudioClip } from './studio';
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
});