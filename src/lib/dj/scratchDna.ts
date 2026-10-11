import type { Deck } from "./engine";

/** One step of a scratch pattern: platter speed for a beat fraction, fader open or cut. */
export interface DnaStep { beats: number; speed: number; open: boolean }
export interface DnaPattern { id: string; name: string; steps: DnaStep[]; custom?: boolean }

const s = (beats: number, speed: number, open = true): DnaStep => ({ beats, speed, open });

export const PRESET_DNA: DnaPattern[] = [
  { id: "baby", name: "Baby", steps: [s(0.5, 1.6), s(0.5, -1.6)] },
  { id: "forward", name: "Forward", steps: [s(0.5, 1.8), s(0.5, -1.8, false)] },
  { id: "chirp", name: "Chirp", steps: [s(0.25, 1.8), s(0.25, 1.8, false), s(0.25, -1.8), s(0.25, -1.8, false)] },
  { id: "transformer", name: "Transformer", steps: [s(0.125, 1.2), s(0.125, 1.2, false), s(0.125, 1.2), s(0.125, 1.2, false), s(0.125, -1.2), s(0.125, -1.2, false), s(0.125, -1.2), s(0.125, -1.2, false)] },
  { id: "flare", name: "Flare", steps: [s(0.25, 2), s(0.06, 2, false), s(0.19, 2), s(0.25, -2), s(0.06, -2, false), s(0.19, -2)] },
  { id: "stab", name: "Stab", steps: [s(0.15, 3), s(0.85, -0.6, false)] },
  { id: "tear", name: "Tear", steps: [s(0.25, 1.4), s(0.25, 0.7), s(0.5, -1.6)] },
  { id: "crab", name: "Crab", steps: [s(0.25, 1.6), ...Array.from({ length: 6 }, (_, i) => s(0.0833, -1.6, i % 2 === 1)), s(0.25, -1.6)] },
];

const KEY = "dj-scratch-dna-custom";
export function loadCustomDna(): DnaPattern[] {
  try { return JSON.parse(localStorage.getItem(KEY) || "[]") as DnaPattern[]; } catch { return []; }
}
export function saveCustomDna(list: DnaPattern[]) { localStorage.setItem(KEY, JSON.stringify(list)); }

const running = new WeakMap<Deck, () => void>();

/** Perform a pattern on the deck, `bars` beats long, synced to the deck tempo. Returns a stop function. */
export function playDna(deck: Deck, pattern: DnaPattern, beats = 1, repeat = false): () => void {
  running.get(deck)?.();
  if (!deck.buffer || pattern.steps.length === 0) return () => {};
  const beatSec = 60 / ((deck.bpm || 120) * (deck.rate || 1));
  const total = pattern.steps.reduce((a, st) => a + st.beats, 0) || 1;
  const scale = beats / total;
  const g = deck.gain.gain;
  const ctx = deck.gain.context;
  let timer = 0;
  let stopped = false;
  let i = 0;
  deck.scratchStart();
  const step = () => {
    if (stopped) return;
    if (i >= pattern.steps.length) {
      if (!repeat) { stop(); return; }
      i = 0;
    }
    const st = pattern.steps[i++];
    deck.scratch(st.speed);
    g.setTargetAtTime(st.open ? 1 : 0, ctx.currentTime, 0.003);
    timer = window.setTimeout(step, st.beats * scale * beatSec * 1000);
  };
  const stop = () => {
    if (stopped) return;
    stopped = true;
    clearTimeout(timer);
    g.setTargetAtTime(1, ctx.currentTime, 0.004);
    deck.releaseScratch();
    running.delete(deck);
  };
  running.set(deck, stop);
  step();
  return stop;
}
