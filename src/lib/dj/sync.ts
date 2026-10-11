export interface SyncClock { bpm: number; rate: number; currentTime: number; firstBeat: number }
export function phaseError(master: SyncClock, follower: SyncClock) {
  const phase = (d: SyncClock) => ((d.currentTime - d.firstBeat) * d.bpm / 60 % 1 + 1) % 1;
  const difference = phase(master) - phase(follower);
  return difference - Math.round(difference);
}
export function syncPitch(master: SyncClock, follower: SyncClock) {
  return Math.max(-50, Math.min(100, (master.bpm * master.rate / follower.bpm - 1) * 100));
}
export function playbackPosition(position: number, startedAt: number, now: number, rate: number) {
  return position + (now - startedAt) * rate;
}