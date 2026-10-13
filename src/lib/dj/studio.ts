export interface StudioClip {
  id: number;
  name: string;
  buffer: AudioBuffer;
  startBeat: number;
  gain: number;
  mute: boolean;
  solo: boolean;
}

/** One timeline in seconds, shared by live playback and offline export. */
export function studioSchedule(clips: StudioClip[], bpm: number, from = 0) {
  const beat = 60 / Math.max(30, Math.min(300, bpm));
  const solo = clips.some(c => c.solo && !c.mute);
  return clips.flatMap(clip => {
    if (clip.mute || (solo && !clip.solo)) return [];
    const start = Math.max(0, clip.startBeat) * beat;
    const offset = Math.max(0, from - start);
    if (offset >= clip.buffer.duration) return [];
    return [{ clip, delay: Math.max(0, start - from), offset }];
  });
}

export function studioDuration(clips: StudioClip[], bpm: number) {
  return clips.reduce((end, c) => Math.max(end, c.startBeat * 60 / bpm + c.buffer.duration), 0);
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