export type RecordingKind = "audio" | "video";
export type VideoQuality = "360" | "480" | "720" | "1080";
export interface RecordingOptions {
  kind: RecordingKind;
  videoQuality: VideoQuality;
  audioKbps: 96 | 192 | 320;
  lowStorage: boolean;
  /** Audio file format: compressed WebM or lossless WAV (converted after stopping). */
  format?: "webm" | "wav";
}
export const DEFAULT_RECORDING: RecordingOptions = { kind: "audio", videoQuality: "720", audioKbps: 192, lowStorage: false };
export function recordingProfile(options: RecordingOptions) {
  const height = Number(options.videoQuality);
  return {
    width: Math.round(height * 16 / 9 / 2) * 2,
    height,
    fps: options.lowStorage ? 24 : 30,
    audioBitsPerSecond: (options.lowStorage ? 96 : options.audioKbps) * 1000,
    videoBitsPerSecond: ({ "360": 800_000, "480": 1_200_000, "720": 2_500_000, "1080": 5_000_000 }[options.videoQuality]) * (options.lowStorage ? 0.6 : 1),
  };
}
/** Decode a recorded blob and re-encode it as 16-bit PCM WAV (offline, on device). */
export async function blobToWav(blob: Blob): Promise<Blob> {
  const ctx = new OfflineAudioContext(2, 1, 44100);
  const buf = await ctx.decodeAudioData(await blob.arrayBuffer());
  const ch = Math.min(2, buf.numberOfChannels), n = buf.length, rate = buf.sampleRate;
  const out = new DataView(new ArrayBuffer(44 + n * ch * 2));
  const str = (o: number, t: string) => [...t].forEach((c, i) => out.setUint8(o + i, c.charCodeAt(0)));
  str(0, "RIFF"); out.setUint32(4, 36 + n * ch * 2, true); str(8, "WAVEfmt ");
  out.setUint32(16, 16, true); out.setUint16(20, 1, true); out.setUint16(22, ch, true);
  out.setUint32(24, rate, true); out.setUint32(28, rate * ch * 2, true); out.setUint16(32, ch * 2, true); out.setUint16(34, 16, true);
  str(36, "data"); out.setUint32(40, n * ch * 2, true);
  const data = Array.from({ length: ch }, (_, c) => buf.getChannelData(c));
  let o = 44;
  for (let i = 0; i < n; i++) for (let c = 0; c < ch; c++) { const v = Math.max(-1, Math.min(1, data[c][i])); out.setInt16(o, v < 0 ? v * 0x8000 : v * 0x7fff, true); o += 2; }
  return new Blob([out.buffer], { type: "audio/wav" });
}
