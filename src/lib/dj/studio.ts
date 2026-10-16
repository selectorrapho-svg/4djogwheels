export interface StudioClip {
  id: number;
  name: string;
  buffer: AudioBuffer;
  startBeat: number;
  gain: number;
  mute: boolean;
  solo: boolean;
  lane?: number;
  /** Output duration multiplier; pitch is independently rendered before playback. */
  stretch?: number;
  pitch?: number;
  reverse?: boolean;
  fx?: "none" | "lowpass" | "highpass" | "echo" | "drive";
  /** Independent volume fades in seconds (applied to the audible slice). */
  fadeIn?: number;
  fadeOut?: number;
  /** Untrimmed source audio; `buffer` is the [srcStart, srcEnd) slice of it. */
  source?: AudioBuffer;
  srcStart?: number;
  srcEnd?: number;
}

export function clipSource(clip: StudioClip) {
  const source = clip.source ?? clip.buffer;
  return { source, s: clip.srcStart ?? 0, e: clip.srcEnd ?? source.duration };
}

/** Non-destructive trim: re-slice the source so edges can be dragged back out. */
export function trimClip(clip: StudioClip, srcStart: number, srcEnd: number): StudioClip {
  const { source } = clipSource(clip);
  const min = 0.005;
  const s = Math.max(0, Math.min(source.duration - min, srcStart));
  const e = Math.max(s + min, Math.min(source.duration, srcEnd));
  return { ...clip, source, srcStart: s, srcEnd: e, buffer: sliceBuffer(source, s, e) };
}

export function clipDuration(clip: StudioClip) { return clip.buffer.duration * (clip.stretch ?? 1); }
export function studioPitch(value: number) { return Math.max(-24, Math.min(24, Math.round(value))); }
export function studioPlacement(beat: number, snap: boolean, subdivision = 1) {
  return Math.max(0, snap ? Math.round(beat / subdivision) * subdivision : beat);
}
export function studioGridStep(pixelsPerBeat: number) {
  // Reveal finer binary subdivisions while keeping each grid box about 20px wide.
  return Math.min(1, 2 ** Math.ceil(Math.log2(20 / Math.max(1, pixelsPerBeat))));
}
export function syncClip(clip: StudioClip, bpm: number, beats = Math.max(1, Math.round(clipDuration(clip) * bpm / 60))): StudioClip {
  return { ...clip, stretch: Math.max(0.125, Math.min(8, beats * 60 / bpm / clip.buffer.duration)) };
}

/** One timeline in seconds, shared by live playback and offline export. */
export function studioSchedule(clips: StudioClip[], bpm: number, from = 0) {
  const beat = 60 / Math.max(30, Math.min(300, bpm));
  const solo = clips.some(c => c.solo && !c.mute);
  return clips.flatMap(clip => {
    if (clip.mute || (solo && !clip.solo)) return [];
    const start = Math.max(0, clip.startBeat) * beat;
    const offset = Math.max(0, from - start);
    if (offset >= clipDuration(clip)) return [];
    return [{ clip, delay: Math.max(0, start - from), offset }];
  });
}

export function studioDuration(clips: StudioClip[], bpm: number) {
  return clips.reduce((end, c) => Math.max(end, c.startBeat * 60 / bpm + clipDuration(c)), 0);
}

export function studioWav(buffer: AudioBuffer) {
  const channels = Math.min(2, buffer.numberOfChannels);
  const data = new ArrayBuffer(44 + buffer.length * channels * 2);
  const view = new DataView(data);
  const text = (at: number, s: string) => { for (let i = 0; i < s.length; i++) view.setUint8(at + i, s.charCodeAt(i)); };
  text(0, 'RIFF'); view.setUint32(4, data.byteLength - 8, true); text(8, 'WAVE'); text(12, 'fmt ');
  view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, channels, true);
  view.setUint32(24, buffer.sampleRate, true); view.setUint32(28, buffer.sampleRate * channels * 2, true);
  view.setUint16(32, channels * 2, true); view.setUint16(34, 16, true); text(36, 'data'); view.setUint32(40, data.byteLength - 44, true);
  const samples = Array.from({ length: channels }, (_, c) => buffer.getChannelData(c));
  for (let i = 0; i < buffer.length; i++) for (let c = 0; c < channels; c++) {
    const v = Math.max(-1, Math.min(1, samples[c][i]));
    view.setInt16(44 + (i * channels + c) * 2, v * (v < 0 ? 32768 : 32767), true);
  }
  return new Blob([data], { type: 'audio/wav' });
}
/** Copy a [from, to) seconds slice of a buffer into a new buffer (used by split/cut). */
export function sliceBuffer(buffer: AudioBuffer, from: number, to: number): AudioBuffer {
  const sr = buffer.sampleRate;
  const a = Math.max(0, Math.min(buffer.length, Math.round(from * sr)));
  const b = Math.max(a + 1, Math.min(buffer.length, Math.round(to * sr)));
  const out = new AudioBuffer({ length: b - a, numberOfChannels: buffer.numberOfChannels, sampleRate: sr });
  for (let c = 0; c < buffer.numberOfChannels; c++) out.copyToChannel(buffer.getChannelData(c).subarray(a, b), c);
  return out;
}

/**
 * Gain-envelope timing for a clip's audible slice: the fade-in ends after
 * `fadeIn` seconds of audible audio, the fade-out starts `fadeOut` seconds
 * before the slice ends. Both are clamped so they never overlap.
 */
export function studioFades(clip: StudioClip, audibleSeconds: number, when: number) {
  const dur = Math.max(0, audibleSeconds);
  let fadeIn = Math.max(0, clip.fadeIn ?? 0);
  let fadeOut = Math.max(0, clip.fadeOut ?? 0);
  // Overlapping fades share the slice proportionally instead of clamping one away.
  if (fadeIn + fadeOut > dur) {
    const total = fadeIn + fadeOut;
    fadeIn = dur * fadeIn / total;
    fadeOut = dur * fadeOut / total;
  }
  return { fadeInStart: when, fadeInEnd: when + fadeIn, fadeOutStart: when + dur - fadeOut, fadeOutEnd: when + dur };
}

/** Split a clip at an arrangement time (seconds); returns null if the time is outside the clip. */
export function splitClip(clip: StudioClip, atSec: number, bpm: number, newId: number): [StudioClip, StudioClip] | null {
  const beat = 60 / bpm;
  const local = (atSec - clip.startBeat * beat) / (clip.stretch ?? 1);
  if (local < 0.005 || local > clip.buffer.duration - 0.005) return null;
  const { s, e } = clipSource(clip);
  const first = clip.reverse ? trimClip(clip, e - local, e) : trimClip(clip, s, s + local);
  const second = clip.reverse ? trimClip(clip, s, e - local) : trimClip(clip, s + local, e);
  return [first, { ...second, id: newId, name: clip.name.endsWith(" (2)") ? clip.name : `${clip.name} (2)`, startBeat: atSec / beat }];
}
