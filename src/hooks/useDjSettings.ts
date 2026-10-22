import { DEFAULT_SCRATCH, type ScratchSettings, type XfCurve } from "@/lib/dj/scratchMath";
import { useEffect, useState } from "react";
import { DEFAULT_RECORDING, type RecordingOptions } from "@/lib/dj/recording";

export type JogStyle = "silver" | "pioneer3d" | "neonDisc3d" | "combatLight" | "combatDark" | "extended";

export const JOG_STYLES: { key: JogStyle; label: string }[] = [
  { key: "silver", label: "Silver" },
  { key: "neonDisc3d", label: "Neon 3D" },
  { key: "pioneer3d", label: "Pioneer 3D" },
  { key: "combatLight", label: "Combat Light" },
  { key: "combatDark", label: "Combat Dark" },
  { key: "extended", label: "Extended" },
];

export function normalizeJogStyle(value: unknown): JogStyle {
  return JOG_STYLES.find((style) => style.key === value)?.key ?? "silver";
}

export type VideoTransition = "cut" | "fade" | "dip" | "zoom" | "slide" | "flash";
export type VideoFx = "none" | "bw" | "invert" | "sepia" | "strobe" | "blur" | "rgb" | "hue";

export const VIDEO_TRANSITIONS: { key: VideoTransition; label: string }[] = [
  { key: "cut", label: "Cut" },
  { key: "fade", label: "Fade" },
  { key: "dip", label: "Dip to Black" },
  { key: "zoom", label: "Zoom" },
  { key: "slide", label: "Slide" },
  { key: "flash", label: "Flash" },
];

export const VIDEO_FX: { key: VideoFx; label: string }[] = [
  { key: "none", label: "None" },
  { key: "bw", label: "B/W" },
  { key: "invert", label: "Invert" },
  { key: "sepia", label: "Sepia" },
  { key: "strobe", label: "Strobe" },
  { key: "blur", label: "Blur" },
  { key: "rgb", label: "RGB Shift" },
  { key: "hue", label: "Hue Spin" },
];

export interface DjSettings {
  showWatermark: boolean;
  watermarkText: string;
  watermarkLogo: boolean;
  jogStyle: JogStyle;
  keyLock: boolean;
  floatingVideo: boolean;
  videoScale: number;
  videoTransition: VideoTransition;
  videoFx: VideoFx;
  videoFollowCrossfader: boolean;
  waveColor: string;
  waveOrientation: "vertical" | "horizontal";
  /** Waveforms remain dark independently of the app theme. */
  waveBg: "dark";
  brakeOnPause: boolean;
  waveHighContrast: boolean;
  waveScratch: boolean;
  waveSlip: boolean;
  waveZoom: number;
  waveTracks: 1 | 2 | 3;
  visualPreset: string;
  transitionPreset: string;
  fxFavorites: string[];
  recording: RecordingOptions;
  scratch: ScratchSettings;
  xfCurve: XfCurve;
  xfLag: number;
  xfReverse: boolean;
  /** Crossfader spring-back cut mode for scratching. */
  xfCut: boolean;
  /** Stems panel shows stem faders or EQ sliders. */
  stemsEqMode: "stems" | "eq";
}
const KEY = "mixrdjs.settings.v1";
const DEFAULT: DjSettings = {
  showWatermark: true,
  watermarkText: "DjogPro",
  watermarkLogo: true,
  jogStyle: "silver",
  keyLock: false,
  floatingVideo: false,
  videoScale: 1,
  videoTransition: "fade",
  videoFx: "none",
  videoFollowCrossfader: true,
  waveColor: "rgb3",
  // Landscape decks show horizontal scrolling waveforms by default (Serato-style).
  waveOrientation: "horizontal",
  waveBg: "dark",
  brakeOnPause: false,
  waveHighContrast: false,
  waveScratch: true,
  waveSlip: false,
  waveZoom: 1,
  waveTracks: 1,
  visualPreset: "none",
  transitionPreset: "legacy",
  fxFavorites: [],
  recording: DEFAULT_RECORDING,
  scratch: DEFAULT_SCRATCH,
  xfCurve: "smooth",
  xfLag: 0.02,
  xfReverse: false,
  xfCut: false,
  stemsEqMode: "stems",
};

function publish(c: DjSettings) {
  const g = globalThis as { __djScratch?: ScratchSettings; __djXf?: { curve: XfCurve; lag: number; reverse: boolean } };
  g.__djScratch = { ...DEFAULT_SCRATCH, ...c.scratch };
  g.__djXf = { curve: c.xfCurve, lag: c.xfLag, reverse: c.xfReverse };
}
const listeners = new Set<() => void>();
let current: DjSettings = DEFAULT;
if (typeof window !== "undefined") {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const saved = JSON.parse(raw);
      // Restore full-spectrum RGB waveforms: legacy single-colour choices
      // (red, blue, …) painted the whole waveform one colour.
      const waveColor = ["rgb3", "all", "zigzag", "beat", "bars"].includes(saved.waveColor) ? saved.waveColor : "rgb3";
      current = { ...DEFAULT, ...saved, waveBg: "dark", waveColor, jogStyle: normalizeJogStyle(saved.jogStyle), scratch: { ...DEFAULT_SCRATCH, ...saved.scratch } };
    }
  } catch {}
  (globalThis as { __djWaveColor?: string; __djBrake?: boolean }).__djWaveColor = current.waveColor;
  (globalThis as { __djBrake?: boolean }).__djBrake = current.brakeOnPause;
  publish(current);
}


export function useDjSettings(): [DjSettings, (p: Partial<DjSettings>) => void] {
  const [, setT] = useState(0);
  useEffect(() => {
    const fn = () => setT((t) => t + 1);
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  }, []);
  const update = (p: Partial<DjSettings>) => {
    current = { ...current, ...p, waveBg: "dark", jogStyle: normalizeJogStyle(p.jogStyle ?? current.jogStyle) };
    (globalThis as { __djWaveColor?: string; __djBrake?: boolean }).__djWaveColor = current.waveColor;
  (globalThis as { __djBrake?: boolean }).__djBrake = current.brakeOnPause;
    publish(current);
    try {
      localStorage.setItem(KEY, JSON.stringify(current));
    } catch {}
    listeners.forEach((l) => l());
  };

  return [current, update];
}
