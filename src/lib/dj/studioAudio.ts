import { clipDuration, studioFades, type StudioClip } from "./studio";

const cache = new WeakMap<AudioBuffer, Map<string, Promise<AudioBuffer>>>();
export function prepareStudioClip(clip: StudioClip): Promise<AudioBuffer> {
  const stretch = clip.stretch ?? 1, pitch = clip.pitch ?? 0, reverse = clip.reverse ?? false;
  if (stretch === 1 && pitch === 0 && !reverse) return Promise.resolve(clip.buffer);
  let entries = cache.get(clip.buffer);
  if (!entries) { entries = new Map(); cache.set(clip.buffer, entries); }
  const key = `${stretch}:${pitch}:${reverse}`, existing = entries.get(key);
  if (existing) return existing;
  const result = new Promise<AudioBuffer>((resolve, reject) => {
    const worker = new Worker(new URL("./studioAudio.worker.ts", import.meta.url), { type: "module" });
    const fail = (reason: string) => { worker.terminate(); entries?.delete(key); reject(new Error(reason)); };
    worker.onerror = () => fail("Audio processing failed");
    worker.onmessage = (event: MessageEvent<{ channels?: Float32Array[]; error?: string }>) => {
      if (!event.data.channels) { fail(event.data.error ?? "Audio processing failed"); return; }
      const channels = event.data.channels;
      const buffer = new AudioBuffer({ numberOfChannels: 2, length: channels[0].length, sampleRate: clip.buffer.sampleRate });
      channels.forEach((channel, index) => buffer.copyToChannel(new Float32Array(channel), index));
      worker.terminate(); resolve(buffer);
    };
    const channels = Array.from({ length: Math.min(2, clip.buffer.numberOfChannels) }, (_, i) => clip.buffer.getChannelData(i).slice());
    worker.postMessage({ channels, stretch, pitch, reverse, sampleRate: clip.buffer.sampleRate }, channels.map(c => c.buffer));
  });
  entries.set(key, result); return result;
}

/** Identical routing for live playback and offline WAV export. */
export function connectStudioFx(ctx: BaseAudioContext, input: AudioNode, output: AudioNode, clip: StudioClip, when = 0, audibleSeconds = clipDuration(clip)): AudioNode[] {
  const gain = ctx.createGain(); gain.gain.value = clip.gain;
  input.connect(gain);
  const nodes: AudioNode[] = [gain];
  // Independent volume fades: ramp the clip's own gain node so the envelope
  // stays identical for live playback, restart-on-edit and offline export.
  const { fadeInStart, fadeInEnd, fadeOutStart, fadeOutEnd } = studioFades(clip, audibleSeconds, when);
  if (fadeInEnd > fadeInStart) {
    gain.gain.setValueAtTime(0, fadeInStart);
    gain.gain.linearRampToValueAtTime(clip.gain, fadeInEnd);
  }
  if (fadeOutEnd > fadeOutStart) {
    gain.gain.setValueAtTime(clip.gain, fadeOutStart);
    gain.gain.linearRampToValueAtTime(0.0001, fadeOutEnd);
  }
  if (clip.fx === "lowpass" || clip.fx === "highpass") {
    const filter = ctx.createBiquadFilter(); filter.type = clip.fx; filter.frequency.value = clip.fx === "lowpass" ? 1800 : 600;
    gain.connect(filter).connect(output); nodes.push(filter);
  } else if (clip.fx === "echo") {
    const delay = ctx.createDelay(1), wet = ctx.createGain(); delay.delayTime.value = 0.25; wet.gain.value = 0.35;
    gain.connect(output); gain.connect(delay).connect(wet).connect(output); nodes.push(delay, wet);
  } else if (clip.fx === "drive") {
    const shape = ctx.createWaveShaper(), curve = new Float32Array(2048);
    for (let i = 0; i < curve.length; i++) curve[i] = Math.tanh((i * 2 / (curve.length - 1) - 1) * 3);
    shape.curve = curve; shape.oversample = "2x";
    gain.connect(shape).connect(output); nodes.push(shape);
  } else gain.connect(output);
  return nodes;
}