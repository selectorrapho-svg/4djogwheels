import { computeBandedPeaks } from "./peaks";

self.onmessage = (event: MessageEvent<{ id: number; channels: Float32Array[]; sampleRate: number }>) => {
  const { id, channels, sampleRate } = event.data;
  const first = channels[0];
  if (!first) return;
  const buffer = {
    numberOfChannels: channels.length,
    length: first.length,
    sampleRate,
    duration: first.length / sampleRate,
    getChannelData: (channel: number) => channels[channel],
  } as AudioBuffer;
  const peaks = computeBandedPeaks(buffer, 4800, progress => self.postMessage({ id, progress }));
  self.postMessage({ id, peaks }, { transfer: Object.values(peaks).map(array => array.buffer) });
};