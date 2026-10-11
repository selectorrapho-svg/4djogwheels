import { analyzeBeatGrid } from "./mixcn/beatgrid";

// Only mono PCM crosses the worker boundary; the playback buffer stays intact.
self.onmessage = async (event: MessageEvent<{ samples: Float32Array; sampleRate: number }>) => {
  const { samples, sampleRate } = event.data;
  const buffer: AudioBuffer = {
    duration: samples.length / sampleRate, length: samples.length,
    sampleRate, numberOfChannels: 1,
    getChannelData: () => samples as Float32Array<ArrayBuffer>,
    copyFromChannel: (dest, _channel, offset = 0) => dest.set(samples.subarray(offset, offset + dest.length)),
    copyToChannel: (src, _channel, offset = 0) => samples.set(src, offset),
  };
  self.postMessage(await analyzeBeatGrid(buffer));
};