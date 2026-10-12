export function correctedGrid(bpm: number, firstBeat: number) {
  if (!Number.isFinite(bpm) || bpm < 20 || bpm > 400 || !Number.isFinite(firstBeat)) return null;
  return { bpm: Math.round(bpm * 1000) / 1000, firstBeat };
}

export function beatMarkerTime(index: number, bpm: number, firstBeat: number) {
  return firstBeat + index * 60 / bpm;
}

export function snapToBeat(time: number, bpm: number, firstBeat: number, duration: number) {
  if (!correctedGrid(bpm, firstBeat)) return time;
  const beat = 60 / bpm;
  const firstIndex = Math.ceil(-firstBeat / beat);
  const lastIndex = Math.floor((duration - firstBeat) / beat);
  if (lastIndex < firstIndex) return Math.max(0, Math.min(duration, time));
  const index = Math.max(firstIndex, Math.min(lastIndex, Math.round((time - firstBeat) / beat)));
  return beatMarkerTime(index, bpm, firstBeat);
}