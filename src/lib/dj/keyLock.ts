import processorUrl from "@soundtouchjs/audio-worklet/processor?url";
import type { SoundTouchNode } from "@soundtouchjs/audio-worklet";

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