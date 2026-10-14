import { SimpleFilter, SoundTouch } from "soundtouchjs";

self.onmessage = (event: MessageEvent<{ channels: Float32Array[]; stretch: number; pitch: number; reverse: boolean; sampleRate: number }>) => {
  const { channels, stretch, pitch, reverse } = event.data;
  try {
    const left = channels[0];
    const right = channels[1] ?? left;
    if (reverse) { left.reverse(); if (right !== left) right.reverse(); }
    const length = Math.max(1, Math.round(left.length * stretch));
    const output = [new Float32Array(length), new Float32Array(length)];
    if (stretch === 1 && pitch === 0) {
      output[0].set(left); output[1].set(right);
    } else {
      const pipe = new SoundTouch(); pipe.tempo = 1 / stretch; pipe.pitchSemitones = pitch;
      // Pad the tail so SoundTouch can flush its overlap window without truncating audio.
      const source = { extract(target: Float32Array, count: number, position: number) {
        const frames = Math.max(0, Math.min(count, left.length + 16384 - position));
        for (let i = 0; i < frames; i++) { target[i * 2] = left[position + i] ?? 0; target[i * 2 + 1] = right[position + i] ?? 0; }
        return frames;
      } };
      const filter = new SimpleFilter(source, pipe), block = new Float32Array(8192);
      let at = 0;
      while (at < length) {
        const frames = filter.extract(block, Math.min(4096, length - at));
        if (!frames) break;
        for (let i = 0; i < frames; i++) { output[0][at + i] = block[i * 2]; output[1][at + i] = block[i * 2 + 1]; }
        at += frames;
      }
    }
    self.postMessage({ channels: output }, { transfer: output.map(c => c.buffer) });
  } catch (error) { self.postMessage({ error: String(error) }); }
};