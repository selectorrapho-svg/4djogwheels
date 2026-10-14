import type { BandedPeaks } from "./peaks";

let nextId = 0;
/** Independent workers keep simultaneous deck loads from sharing mutable state. */
export function analyzeWaveform(buffer: AudioBuffer, progress: (value: number) => void): Promise<BandedPeaks> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL("./waveAnalysis.worker.ts", import.meta.url), { type: "module" });
    const id = ++nextId;
    worker.onmessage = (event: MessageEvent<{ id: number; progress?: number; peaks?: BandedPeaks }>) => {
      if (event.data.id !== id) return;
      if (event.data.progress !== undefined) progress(event.data.progress);
      if (event.data.peaks) { worker.terminate(); resolve(event.data.peaks); }
    };
    worker.onerror = () => { worker.terminate(); reject(new Error("Waveform analysis failed")); };
    const channels = Array.from({ length: buffer.numberOfChannels }, (_, channel) => buffer.getChannelData(channel).slice());
    worker.postMessage({ id, channels, sampleRate: buffer.sampleRate }, channels.map(channel => channel.buffer));
  });
}