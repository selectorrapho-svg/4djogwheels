export function correctedGrid(bpm: number, firstBeat: number) {
  if (!Number.isFinite(bpm) || bpm < 20 || bpm > 400 || !Number.isFinite(firstBeat)) return null;
  return { bpm: Math.round(bpm * 1000) / 1000, firstBeat };
}

export function beatMarkerTime(index: number, bpm: number, firstBeat: number) {
  return firstBeat + index * 60 / bpm;
}