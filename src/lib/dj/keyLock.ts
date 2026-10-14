import type { SoundTouchNode } from "@soundtouchjs/audio-worklet";

// Served from public/ — importing the package's hidden .dist path with ?url
// is denied by the dev server.
const processorUrl = "/worklets/soundtouch-processor.js";

const registrations = new WeakMap<AudioContext, Promise<void>>();
/** Source-rate compensation: original pitch when locked, vinyl pitch otherwise. */
export function lockedPitch(rate: number, locked: boolean) { return locked ? 1 : rate; }
export async function createKeyLock(ctx: AudioContext): Promise<SoundTouchNode> {
  const { SoundTouchNode } = await import("@soundtouchjs/audio-worklet");
  let ready = registrations.get(ctx);
  if (!ready) {
    ready = SoundTouchNode.register(ctx, processorUrl);
    registrations.set(ctx, ready);
  }
  await ready;
  return new SoundTouchNode({ context: ctx });
}