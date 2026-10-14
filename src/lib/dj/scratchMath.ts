// Pure scratch / crossfader math shared by the jogwheel, engine and tests.

export type XfCurve = "smooth" | "linear" | "cut" | "scratch";

export interface ScratchSettings {
  /** Audio seconds per platter revolution multiplier (1 = 1.8 s/rev, 33⅓ feel). */
  sensitivity: number;
  /** 0 = frictionless coast after a fling, 1 = stops immediately. */
  friction: number;
  /** Motor start-up time (s) when the platter is released while playing. */
  inertia: number;
  /** Brake time (s) used by brake-on-pause. */
  brake: number;
  /** What happens on release: motor spin-up, instant play, coast with friction, or a backspin fling. */
  release: "motor" | "instant" | "coast" | "spin";
  /** Vinyl mode: touching the platter grabs the record. Off = jog nudges pitch. */
  vinylMode: boolean;
}

export const DEFAULT_SCRATCH: ScratchSettings = {
  sensitivity: 1,
  friction: 0.5,
  inertia: 0.12,
  brake: 0.8,
  release: "motor",
  vinylMode: true,
};

export const SECONDS_PER_REV = 1.8;

/** Platter angle (radians, cumulative) → audio seconds of displacement. */
export function angleToSeconds(angle: number, sensitivity: number) {
  return (angle / (2 * Math.PI)) * SECONDS_PER_REV * Math.max(0.1, sensitivity);
}

/** Release uses only the latest direction, not the earlier half of a chirp. */
export function releaseVelocity(history: number[], now: number, sensitivity: number) {
  if (history.length < 4) return 0;
  const end = history.length - 2;
  if (now - history[end] > 50) return 0;
  let start = end;
  let direction = 0;
  for (let i = end - 2; i >= 0 && history[end] - history[i] <= 30; i -= 2) {
    const delta = history[i + 3] - history[i + 1];
    const sign = Math.sign(delta);
    if (sign && direction && sign !== direction) break;
    if (sign) direction = sign;
    start = i;
  }
  const dt = (history[end] - history[start]) / 1000;
  return dt > 0.002 ? angleToSeconds(history[end + 1] - history[start + 1], sensitivity) / dt : 0;
}

/** Coast time constant (s) for a released fling with given friction. */
export function coastTau(friction: number) {
  const f = Math.min(1, Math.max(0, friction));
  return 0.02 + (1 - f) * 0.6;
}

/** Free-spin slowdown time constant (s) after flinging the platter. */
export function freeSpinTau(friction: number) {
  const f = Math.min(1, Math.max(0, friction));
  return 0.12 + (1 - f) * 2.4;
}

/**
 * Crossfader gains. `lag` = cut-in distance from each edge (0..0.2) for the
 * scratch curve, so a 1 mm move fully opens the channel (chirps/transforms).
 */
export function crossfaderGains(v: number, curve: XfCurve, lag = 0.02, reverse = false): [number, number] {
  let x = Math.min(1, Math.max(0, v));
  if (reverse) x = 1 - x;
  let a: number, b: number;
  if (curve === "linear") {
    a = 1 - x; b = x;
  } else if (curve === "scratch" || curve === "cut") {
    const l = Math.min(0.2, Math.max(0.002, lag));
    a = x >= 1 - l ? 0 : 1;
    b = x <= l ? 0 : 1;
  } else {
    a = Math.cos(x * Math.PI * 0.5);
    b = Math.cos((1 - x) * Math.PI * 0.5);
  }
  return [a, b];
}
