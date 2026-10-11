import type { BeatGrid } from "./mixcn/types";
import { analyzeBeatGrid } from "./mixcn/beatgrid";

export function analyzeTrackBeats(buffer: AudioBuffer): Promise<BeatGrid | null> {
  if (typeof Worker === "undefined") return analyzeBeatGrid(buffer);
  return new Promise((resolve) => {
    const worker = new Worker(new URL("./beatAnalysis.worker.ts", import.meta.url), { type: "module" });
    const timer = setTimeout(() => { worker.terminate(); resolve(null); }, 60_000);
    const done = (result: BeatGrid | null) => { clearTimeout(timer); worker.terminate(); resolve(result); };
    worker.onmessage = (event: MessageEvent<BeatGrid | null>) => done(event.data);
    worker.onerror = () => done(null);
    const mono = new Float32Array(buffer.length);
    for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
      const data = buffer.getChannelData(channel);
      for (let i = 0; i < mono.length; i++) mono[i] += data[i] / buffer.numberOfChannels;
    }
    worker.postMessage({ samples: mono, sampleRate: buffer.sampleRate }, [mono.buffer]);
  });
}