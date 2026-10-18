import { computeBandedPeaks, type BandedPeaks } from "./peaks";
import { analyzeWaveform } from "./waveAnalysis";
import { native, isNative } from "./nativeAudio";
import { ScratchPlayer } from "./scratchPlayer";
import { correctedGrid, snapToBeat } from "./beatGrid";
import { crossfaderGains, freeSpinTau, DEFAULT_SCRATCH, type ScratchSettings, type XfCurve } from "./scratchMath";
const scratchCfg = (): ScratchSettings => ({ ...DEFAULT_SCRATCH, ...((globalThis as { __djScratch?: Partial<ScratchSettings> }).__djScratch ?? {}) });
import { analyzeTrackBeats } from "./beatAnalysis";
import { DEFAULT_RECORDING, recordingProfile, type RecordingOptions } from "./recording";
import { separateStems, stemsSupported } from "./stems";
import { isPro } from "./license";
import { syncPitch, playbackPosition, phaseError as phaseCorrection } from "./sync";
import { createKeyLock, lockedPitch } from "./keyLock";
import type { SoundTouchNode } from "@soundtouchjs/audio-worklet";

// Web Audio DJ engine. Four decks with per-deck FX, frequency isolation, EQ,
// crossfader, scratch playback, spectrum waveforms and master recording.

export type FxBase =
  | "echo" | "reverb" | "filter" | "flanger" | "phaser" | "bitcrush"
  | "wahwah" | "lpf" | "hpf" | "delay" | "gate" | "tremolo" | "ringmod" | "chorus"
  | "wahwah4" | "wahflanger" | "roll";

// Preset id — expands 14 base FX chains into 70+ named presets.
export type FxKey = string;

export interface FxPreset {
  key: string;
  label: string;
  base: FxBase;
  params?: Record<string, number>;
  category?: string;
}

export const FX_LIBRARY: FxPreset[] = [
  { key: "echo_out_1_2", label: "Echo Out 1/2", base: "echo", params: { beats: 0.5, fb: 0.72 }, category: "Echo Out" },
  { key: "echo_out_1",   label: "Echo Out 1",   base: "echo", params: { beats: 1, fb: 0.7 }, category: "Echo Out" },
  { key: "echo_out_2",   label: "Echo Out 2",   base: "echo", params: { beats: 2, fb: 0.66 }, category: "Echo Out" },
  { key: "echo_1_2",     label: "Echo 1/2",     base: "echo", params: { beats: 0.5, fb: 0.55 }, category: "Echo" },
  { key: "echo_1",       label: "Echo 1",       base: "echo", params: { beats: 1, fb: 0.5 }, category: "Echo" },
  { key: "gate_1_4",     label: "Gate 1/4",     base: "gate", params: { beats: 0.25 }, category: "Gate" },
  { key: "gate_1_2",     label: "Gate 1/2",     base: "gate", params: { beats: 0.5 }, category: "Gate" },
  { key: "gate_1",       label: "Gate 1",       base: "gate", params: { beats: 1 }, category: "Gate" },
  { key: "double_beat",  label: "Double Beat",  base: "roll", params: { beats: 0.5 }, category: "Roll" },
  { key: "roll_1_4",     label: "Roll 1/4",     base: "roll", params: { beats: 0.25 }, category: "Roll" },
  { key: "roll_1",       label: "Roll 1",       base: "roll", params: { beats: 1 }, category: "Roll" },
  { key: "brake",        label: "Brake",        base: "filter", category: "Transport" },
  { key: "echo_out",     label: "Echo Out",     base: "echo",   params: { time: 0.25, fb: 0.78 }, category: "Echo" },
  { key: "backspin_echo",     label: "Backspin Echo",     base: "echo", params: { time: 0.28, fb: 0.80 }, category: "Echo" },
  { key: "backspin_echo_out", label: "Backspin Echo Out", base: "echo", params: { time: 0.33, fb: 0.90 }, category: "Echo" },
  { key: "wahwah4",         label: "Wah-Wah 4",     base: "wahwah4",   params: { rate: 4, q: 16, depth: 1500 }, category: "Mod" },
  { key: "flanger_strong",  label: "Strong Flanger",base: "flanger",   params: { rate: 0.6, depth: 0.010, fb: 0.88 }, category: "Mod" },
  { key: "wahwah4_flanger", label: "Wah4 + Flanger",base: "wahflanger",params: { rate: 4, q: 16, depth: 1500, frate: 0.6, fdepth: 0.010, fb: 0.88 }, category: "Mod" },
  { key: "echo_1_4",     label: "Echo 1/4",     base: "echo",   params: { time: 0.5,  fb: 0.55 }, category: "Echo" },
  { key: "echo_1_8",     label: "Echo 1/8",     base: "echo",   params: { time: 0.25, fb: 0.55 }, category: "Echo" },
  { key: "echo_1_16",    label: "Echo 1/16",    base: "echo",   params: { time: 0.125,fb: 0.5  }, category: "Echo" },
  { key: "echo_dotted",  label: "Echo Dotted",  base: "echo",   params: { time: 0.375,fb: 0.62 }, category: "Echo" },
  { key: "echo_freeze",  label: "Echo Freeze",  base: "echo",   params: { time: 0.5,  fb: 0.95 }, category: "Echo" },
  { key: "delay_slap",   label: "Slap Delay",   base: "delay",  params: { time: 0.09, fb: 0.15 }, category: "Delay" },
  { key: "delay_short",  label: "Delay Short",  base: "delay",  params: { time: 0.14, fb: 0.35 }, category: "Delay" },
  { key: "delay_long",   label: "Delay Long",   base: "delay",  params: { time: 0.6,  fb: 0.55 }, category: "Delay" },
  { key: "delay_ping",   label: "Ping Pong",    base: "delay",  params: { time: 0.3,  fb: 0.6  }, category: "Delay" },
  { key: "delay_tape",   label: "Tape Delay",   base: "delay",  params: { time: 0.28, fb: 0.7  }, category: "Delay" },
  { key: "reverb_out",   label: "Reverb Out",   base: "reverb", params: { time: 2.4, decay: 2.8 }, category: "Reverb" },
  { key: "reverb_room",  label: "Room",         base: "reverb", params: { time: 0.8, decay: 2.0 }, category: "Reverb" },
  { key: "reverb_hall",  label: "Hall",         base: "reverb", params: { time: 3.5, decay: 2.4 }, category: "Reverb" },
  { key: "reverb_plate", label: "Plate",        base: "reverb", params: { time: 1.6, decay: 3.5 }, category: "Reverb" },
  { key: "reverb_cave",  label: "Cave",         base: "reverb", params: { time: 5.0, decay: 2.0 }, category: "Reverb" },
  { key: "reverb_spring",label: "Spring",       base: "reverb", params: { time: 0.4, decay: 4.5 }, category: "Reverb" },
  { key: "reverb_ambient",label:"Ambient",      base: "reverb", params: { time: 6.0, decay: 1.6 }, category: "Reverb" },
  { key: "filter",       label: "Filter",       base: "filter", category: "Filter" },
  { key: "lpf",          label: "LPF",          base: "lpf",    params: { freq: 600,  q: 6 }, category: "Filter" },
  { key: "lpf_sweep",    label: "LPF Sweep",    base: "lpf",    params: { freq: 300,  q: 12 }, category: "Filter" },
  { key: "lpf_deep",     label: "LPF Deep",     base: "lpf",    params: { freq: 120,  q: 4 }, category: "Filter" },
  { key: "hpf",          label: "HPF",          base: "hpf",    params: { freq: 2000, q: 4 }, category: "Filter" },
  { key: "hpf_air",      label: "HPF Air",      base: "hpf",    params: { freq: 6000, q: 2 }, category: "Filter" },
  { key: "hpf_tight",    label: "HPF Tight",    base: "hpf",    params: { freq: 3500, q: 8 }, category: "Filter" },
  { key: "telephone",    label: "Telephone",    base: "hpf",    params: { freq: 900,  q: 12 }, category: "Filter" },
  { key: "flanger",      label: "Flanger",      base: "flanger",params: { rate: 0.4,  depth: 0.003 }, category: "Mod" },
  { key: "flanger_jet",  label: "Jet Flanger",  base: "flanger",params: { rate: 0.15, depth: 0.006 }, category: "Mod" },
  { key: "flanger_fast", label: "Fast Flanger", base: "flanger",params: { rate: 3.0,  depth: 0.002 }, category: "Mod" },
  { key: "phaser",       label: "Phaser",       base: "phaser", params: { rate: 0.6,  depth: 500 }, category: "Mod" },
  { key: "phaser_deep",  label: "Deep Phaser",  base: "phaser", params: { rate: 0.25, depth: 1200 }, category: "Mod" },
  { key: "phaser_fast",  label: "Fast Phaser",  base: "phaser", params: { rate: 4.0,  depth: 400 }, category: "Mod" },
  { key: "chorus",       label: "Chorus",       base: "chorus", params: { rate: 1.1,  depth: 0.008 }, category: "Mod" },
  { key: "chorus_wide",  label: "Wide Chorus",  base: "chorus", params: { rate: 0.6,  depth: 0.014 }, category: "Mod" },
  { key: "chorus_slow",  label: "Slow Chorus",  base: "chorus", params: { rate: 0.3,  depth: 0.02 }, category: "Mod" },
  { key: "vibrato",      label: "Vibrato",      base: "chorus", params: { rate: 5.5,  depth: 0.004 }, category: "Mod" },
  { key: "wahwah",       label: "Wah-Wah",      base: "wahwah", params: { rate: 2.2 }, category: "Mod" },
  { key: "autowah_slow", label: "Auto Wah Slow",base: "wahwah", params: { rate: 0.6 }, category: "Mod" },
  { key: "autowah_fast", label: "Auto Wah Fast",base: "wahwah", params: { rate: 6.0 }, category: "Mod" },
  { key: "gate",         label: "Gate",         base: "gate",   params: { rate: 8 }, category: "Rhythm" },
  { key: "gate_16",      label: "Gate 1/16",    base: "gate",   params: { rate: 16 }, category: "Rhythm" },
  { key: "gate_32",      label: "Gate 1/32",    base: "gate",   params: { rate: 32 }, category: "Rhythm" },
  { key: "gate_slow",    label: "Slow Gate",    base: "gate",   params: { rate: 3 }, category: "Rhythm" },
  { key: "chop_1_4",     label: "Chop 1/4",     base: "gate",   params: { rate: 4 }, category: "Rhythm" },
  { key: "chop_1_8",     label: "Chop 1/8",     base: "gate",   params: { rate: 8 }, category: "Rhythm" },
  { key: "stutter",      label: "Stutter",      base: "gate",   params: { rate: 24 }, category: "Rhythm" },
  { key: "tremolo",      label: "Tremolo",      base: "tremolo",params: { rate: 6 }, category: "Rhythm" },
  { key: "tremolo_fast", label: "Fast Tremolo", base: "tremolo",params: { rate: 14 }, category: "Rhythm" },
  { key: "tremolo_slow", label: "Slow Tremolo", base: "tremolo",params: { rate: 2 }, category: "Rhythm" },
  { key: "bitcrush",     label: "Bitcrush",     base: "bitcrush",params: { bits: 6 }, category: "Lofi" },
  { key: "bitcrush_hi",  label: "Bitcrush Hi",  base: "bitcrush",params: { bits: 8 }, category: "Lofi" },
  { key: "bitcrush_lo",  label: "Bitcrush Lo",  base: "bitcrush",params: { bits: 3 }, category: "Lofi" },
  { key: "crush_extreme",label: "Crush X",      base: "bitcrush",params: { bits: 2 }, category: "Lofi" },
  { key: "lofi_tape",    label: "Lofi Tape",    base: "bitcrush",params: { bits: 5 }, category: "Lofi" },
  { key: "ringmod",      label: "Ring Mod",     base: "ringmod",params: { freq: 220 }, category: "FX" },
  { key: "ringmod_lo",   label: "Ring Mod Lo",  base: "ringmod",params: { freq: 60  }, category: "FX" },
  { key: "ringmod_hi",   label: "Ring Mod Hi",  base: "ringmod",params: { freq: 880 }, category: "FX" },
  { key: "robot",        label: "Robot",        base: "ringmod",params: { freq: 45  }, category: "FX" },
  { key: "alien",        label: "Alien",        base: "ringmod",params: { freq: 1200 }, category: "FX" },
  { key: "riser",        label: "Riser",        base: "hpf",    params: { freq: 4000, q: 10 }, category: "Transition" },
  { key: "faller",       label: "Faller",       base: "lpf",    params: { freq: 200,  q: 12 }, category: "Transition" },
  { key: "sweep_up",     label: "Sweep Up",     base: "hpf",    params: { freq: 8000, q: 6 }, category: "Transition" },
  { key: "sweep_down",   label: "Sweep Down",   base: "lpf",    params: { freq: 100,  q: 8 }, category: "Transition" },
  { key: "spinback",     label: "Spinback",     base: "reverb", params: { time: 1.2,  decay: 4.0 }, category: "Transition" },
  { key: "air_verb",     label: "Air Verb",     base: "reverb", params: { time: 4.5,  decay: 2.5 }, category: "Transition" },
  { key: "drop_echo",    label: "Drop Echo",    base: "echo",   params: { time: 0.75, fb: 0.85 }, category: "Transition" },
  { key: "beat_repeat",  label: "Beat Repeat",  base: "delay",  params: { time: 0.125,fb: 0.9 }, category: "Transition" },
  { key: "helix",        label: "Helix",        base: "phaser", params: { rate: 1.5,  depth: 900 }, category: "Transition" },
  { key: "vortex",       label: "Vortex",       base: "flanger",params: { rate: 0.8,  depth: 0.005 }, category: "Transition" },
  { key: "hyper_gate",   label: "Hyper Gate",   base: "gate",   params: { rate: 20 }, category: "Transition" },
  { key: "warp",         label: "Warp",         base: "chorus", params: { rate: 0.15, depth: 0.03 }, category: "Ambient" },
  { key: "underwater",   label: "Underwater",   base: "lpf",    params: { freq: 800,  q: 3 }, category: "Ambient" },
  { key: "sky",          label: "Sky",          base: "reverb", params: { time: 8.0,  decay: 1.2 }, category: "Ambient" },
  { key: "ghost",        label: "Ghost",        base: "reverb", params: { time: 5.5,  decay: 4.5 }, category: "Ambient" },
];

const FX_PRESET_MAP: Record<string, FxPreset> = Object.fromEntries(FX_LIBRARY.map(p => [p.key, p]));

export type StemKey = "drums" | "bass" | "vocals" | "other";

export interface HotCue {
  index: number;
  time: number;
}

type Listener = () => void;

function openVideo(url: string): Promise<HTMLVideoElement> {
  const v = document.createElement("video");
  // Only blob/remote sources need CORS; local app files fail with it on some Android WebViews.
  if (!url.startsWith("blob:") && !/^https?:\/\/localhost/.test(url) && !url.startsWith("capacitor:")) v.crossOrigin = "anonymous";
  v.preload = "auto";
  v.muted = true;
  v.playsInline = true;
  v.setAttribute("playsinline", "");
  v.src = url;
  return new Promise((res, reject) => {
    const t = setTimeout(() => reject(new Error("This video took too long to open.")), 20000);
    v.onloadedmetadata = () => { clearTimeout(t); res(v); };
    v.onerror = () => { clearTimeout(t); reject(new Error("This video format cannot be played on this device.")); };
  });
}

export class Deck {
  ctx: AudioContext;
  id: DeckId;
  buffer: AudioBuffer | null = null;
  reverseBuffer: AudioBuffer | null = null;
  source: AudioBufferSourceNode | null = null;
  private sourceGain: GainNode | null = null;
  gain: GainNode;
  eqLow: BiquadFilterNode;
  eqMid: BiquadFilterNode;
  eqHigh: BiquadFilterNode;
  filter: BiquadFilterNode;
  stemSplit: GainNode;
  stems: Record<StemKey, { filter: BiquadFilterNode; gain: GainNode; on: boolean }>;
  stemSum: GainNode;
  fxInput: GainNode;
  fxDry: GainNode;
  fxWet: GainNode;
  fxOut: GainNode;
  fxNodes: AudioNode[] = [];
  activeFx: FxKey | null = null;
  fxAmount = 0.5;
  private scratchPlayer: ScratchPlayer | null = null;
  private keyProcessor: SoundTouchNode | null = null;
  keyLock = false;
  keyLockReady = false;
  setKeyLock(on: boolean) {
    if (isNative() || !this.keyProcessor) return;
    this.keyLock = on;
    if (this.source) {
      this.source.disconnect();
      this.source.connect(on ? this.keyProcessor : this.gain);
    }
    this.updateKeyRate(this.rate * (1 + (this.nudge || 0)));
    if (this.videoEl && !this.buffer) this.videoEl.preservesPitch = on;
    this.emit();
  }
  private updateKeyRate(rate: number) {
    if (!this.keyProcessor) return;
    this.keyProcessor.playbackRate.value = rate;
    this.keyProcessor.pitch.value = lockedPitch(rate, this.keyLock);
  }
  private videoSeekQueued = false;
  private videoScrubTarget = 0;
  private scratchRate = 0;
  private lastVideoScrub = 0;
  private scratchPos = 0;
  private scratching = false;
  get scratchingVideo() { return this.scratching; }
  private wasPlayingBeforeScratch = false;
  out: GainNode;
  analyser: AnalyserNode;
  private meterData: Uint8Array<ArrayBuffer>;
  private stereoAnalysers: AnalyserNode[] = [];
  private stereoMeterData: Uint8Array<ArrayBuffer>[] = [];
  playing = false;
  startedAt = 0;
  pausedAt = 0;
  rate = 1;
  pitch = 0;
  volume = 0.85;
  hotCues: (HotCue | null)[] = Array(8).fill(null);
  cuePoint = 0;
  private cueSet = false;
  fxBeatOverrides: Record<string, number> = {};
  private nativePositionBusy = false;
  private lastNativePosition = 0;
  wavePeaks: BandedPeaks | null = null;
  analysisProgress = 0;
  analyzing = false;
  bpm = 0;
  /** Seconds of the first beat (MixCN beat grid) — used for phase sync. */
  firstBeat = 0;
  /** True once AI (Demucs) stems replace the frequency-band stems. */
  realStems = false;
  stemStatus: "bands" | "loading" | "locked" | "unsupported" | "error" | "ready" = "bands";
  private loadToken = 0;
  private gridRevision = 0;
  private stemSplitter: ChannelSplitterNode | null = null;
  private stemMergers: ChannelMergerNode[] = [];
  trackName = "";
  videoEl: HTMLVideoElement | null = null;
  coverUrl: string | null = null;
  loopActive = false;
  loopStart = 0;
  loopEnd = 0;
  loopBeats = 4;
  private loopRaf = 0;
  private listeners = new Set<Listener>();

  constructor(ctx: AudioContext, id: DeckId, masterIn: AudioNode) {
    this.ctx = ctx;
    this.id = id;
    this.gain = ctx.createGain();
    this.eqLow = ctx.createBiquadFilter();
    this.eqLow.type = "lowshelf";
    this.eqLow.frequency.value = 200;
    this.eqMid = ctx.createBiquadFilter();
    this.eqMid.type = "peaking";
    this.eqMid.frequency.value = 1000;
    this.eqMid.Q.value = 0.9;
    this.eqHigh = ctx.createBiquadFilter();
    this.eqHigh.type = "highshelf";
    this.eqHigh.frequency.value = 3500;
    this.filter = ctx.createBiquadFilter();
    this.filter.type = "allpass";

    // Frequency isolation, not source-separated stems. Four complementary
    // regions retain the full mix when every band is enabled.
    this.stemSplit = ctx.createGain();
    this.stemSum = ctx.createGain();
    const makeStem = (type: BiquadFilterType, freq: number, q = 1) => {
      const f = ctx.createBiquadFilter();
      f.type = type;
      f.frequency.value = freq;
      f.Q.value = q;
      const g = ctx.createGain();
      g.gain.value = 1;
      f.connect(g).connect(this.stemSum);
      return { filter: f, gain: g, on: true };
    };
    this.stems = {
      bass: makeStem("lowpass", 180),
      drums: makeStem("bandpass", 480, 0.65),
      vocals: makeStem("bandpass", 1900, 0.65),
      other: makeStem("highpass", 4400),
    };

    // Per-deck FX insert
    this.fxInput = ctx.createGain();
    this.fxDry = ctx.createGain();
    this.fxDry.gain.value = 1;
    this.fxWet = ctx.createGain();
    this.fxWet.gain.value = 0;
    this.fxOut = ctx.createGain();
    this.fxInput.connect(this.fxDry).connect(this.fxOut);
    this.fxWet.connect(this.fxOut);

    this.out = ctx.createGain();
    this.out.gain.value = this.volume;
    // Real scratch engine (AudioWorklet + Hermite interpolation). Feeds the
    // normal deck chain so EQ / stems / FX all apply while scratching.
    if (typeof AudioWorkletNode !== "undefined") {
      this.scratchPlayer = new ScratchPlayer(ctx, this.gain);
    this.scratchPlayer.onPos = (t) => {
      if (this.scratching) this.scratchPos = Math.max(0, Math.min(this.duration, t));
      };
    }

    // Routing: gain -> EQ -> filter -> stemSplit -> [4 stems] -> stemSum -> fxInput -> fxOut -> out -> master
    this.gain.connect(this.eqLow);
    this.eqLow.connect(this.eqMid);
    this.eqMid.connect(this.eqHigh);
    this.eqHigh.connect(this.filter);
    this.filter.connect(this.stemSplit);
    this.stemSplit.connect(this.stems.bass.filter);
    this.stemSplit.connect(this.stems.drums.filter);
    this.stemSplit.connect(this.stems.vocals.filter);
    this.stemSplit.connect(this.stems.other.filter);
    this.stemSum.connect(this.fxInput);
    this.analyser = ctx.createAnalyser();
    this.analyser.fftSize = 256;
    this.analyser.smoothingTimeConstant = 0.72;
    this.meterData = new Uint8Array(this.analyser.frequencyBinCount);
    this.fxOut.connect(this.analyser).connect(this.out);
    const meterSplitter = ctx.createChannelSplitter(2);
    this.fxOut.connect(meterSplitter);
    this.stereoAnalysers = [0, 1].map(channel => {
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      meterSplitter.connect(analyser, channel);
      this.stereoMeterData.push(new Uint8Array(analyser.fftSize));
      return analyser;
    });
    this.out.connect(masterIn);
    // Pre-fader headphone (PFL) tap — the Mixer routes it to the cue output.
    this.cueTap = ctx.createGain();
    this.cueTap.gain.value = 0;
    this.fxOut.connect(this.cueTap);
    if (!isNative()) void createKeyLock(ctx).then(node => {
      this.keyProcessor = node;
      node.connect(this.gain);
      this.keyLockReady = true;
      this.emit();
    }).catch(() => { this.keyLockReady = false; });

    // Loop watcher — seamlessly wraps playback back to loopStart when looping.
    const loopTick = () => {
      if (this.loopActive && this.playing && this.loopEnd > this.loopStart) {
        if (this.currentTime >= this.loopEnd) {
          this.seek(this.loopStart);
        }
      }
      this.loopRaf = (typeof requestAnimationFrame !== "undefined")
        ? requestAnimationFrame(loopTick)
        : 0;
    };
    if (typeof requestAnimationFrame !== "undefined") {
      this.loopRaf = requestAnimationFrame(loopTick);
    }
  }

  toggleLoop(beats: number) {
    if (this.loopActive) {
      this.loopActive = false;
      this.emit();
      return;
    }
    if (!this.bpm || !this.buffer) return;
    const secsPerBeat = 60 / this.bpm;
    this.loopBeats = beats;
    this.loopStart = this.currentTime;
    this.loopEnd = this.loopStart + secsPerBeat * beats;
    this.loopActive = true;
    this.emit();
  }

  setLoopBeats(beats: number) {
    this.loopBeats = beats;
    if (this.loopActive && this.bpm) {
      this.loopEnd = this.loopStart + (60 / this.bpm) * beats;
      this.emit();
    }
  }

  setLoopIn() {
    if (!this.buffer && !this.videoEl) return;
    this.loopStart = this.currentTime;
    this.loopEnd = this.loopStart;
    this.loopActive = false;
    this.emit();
  }

  setLoopOut() {
    const end = this.currentTime;
    if (end <= this.loopStart) return;
    this.loopEnd = end;
    this.loopBeats = (end - this.loopStart) * (this.bpm || 120) / 60;
    this.loopActive = true;
    this.emit();
  }

  reloop() {
    if (this.loopEnd <= this.loopStart) return;
    this.loopActive = !this.loopActive;
    if (this.loopActive) this.seek(this.loopStart);
    this.emit();
  }

  toggleStem(key: StemKey) {
    this.setStemLevel(key, this.stems[key].on ? 0 : 1);
  }

  /** Per-stem level 0..1 for the stems sliders panel. */
  stemLevels: Record<StemKey, number> = { drums: 1, bass: 1, vocals: 1, other: 1 };
  setStemLevel(key: StemKey, v: number) {
    const lvl = Math.max(0, Math.min(1, v));
    this.stemLevels[key] = lvl;
    const s = this.stems[key];
    s.on = lvl > 0.01;
    const now = this.ctx.currentTime;
    s.gain.gain.cancelScheduledValues(now);
    s.gain.gain.setValueAtTime(s.gain.gain.value, now);
    s.gain.gain.linearRampToValueAtTime(Math.max(0.0001, lvl), now + 0.03);
    this.emit();
  }




  async loadUrl(url: string, name: string, coverUrl: string | null = null) {
    ++this.loadToken;
    this.pause();
    this.buffer = null;
    this.wavePeaks = null;
    this.trackName = name;
    this.coverUrl = coverUrl;
    this.videoEl?.pause();
    this.videoEl = null;
    if (/\.(mp4|webm|mov|m4v|3gp|mkv)(?:$|\?)/i.test(url) || /video/i.test(url)) {
      await this.loadVideoSrc(url, null);
      return;
    }
    const res = await fetch(url);
    if (!res.ok) throw new Error("Track download failed.");
    const ab = await res.arrayBuffer();
    void native.load(this.id, ab.slice(0));
    this.buffer = await this.ctx.decodeAudioData(ab);
    this.reverseBuffer = null;
    this.pausedAt = 0;
    this.cuePoint = 0;
    this.hotCues = Array(8).fill(null);
    this.bpm = 0;
    this.firstBeat = 0;
    if (this.buffer) void this.scratchPlayer?.prime(this.buffer);
    this.afterLoad();
    this.emit();
  }

  /**
   * Stream a video straight from its URL (phone storage in the Android app).
   * Avoids reading the whole file into memory, which froze large videos.
   * The video element itself is the clock and audible source.
   */
  private async loadVideoSrc(url: string, coverUrl: string | null) {
    ++this.loadToken;
    this.resetStemRouting();
    const v = await openVideo(url);
    if (coverUrl !== null) this.coverUrl = coverUrl;
    this.videoEl = v;
    this.buffer = null;
    this.reverseBuffer = null;
    this.pausedAt = 0;
    this.cuePoint = 0;
    this.hotCues = Array(8).fill(null);
    this.bpm = 0;
    this.firstBeat = 0;
    this.emit();
  }

  /** Background analysis: accurate beat grid, then optional AI stems. */
  private afterLoad() {
    const token = ++this.loadToken;
    const revision = this.gridRevision;
    this.resetStemRouting();
    const buf = this.buffer;
    if (!buf) return;
    this.analyzing = true;
    this.analysisProgress = 0;
    this.emit();
    // Let the decoded track become playable before preparing analysis input.
    setTimeout(() => {
      if (token !== this.loadToken) return;
      void this.analyzeWave(buf, token);
      void analyzeTrackBeats(buf).then((g) => {
        if (token !== this.loadToken || revision !== this.gridRevision || !g?.bpm) return;
        this.bpm = Math.round(g.bpm * 100) / 100;
        this.firstBeat = g.firstBeat;
        this.emit();
      }).catch(() => {});
    }, 0);
    this.stemStatus = !isPro() ? "locked" : !stemsSupported() || buf.numberOfChannels > 2 ? "unsupported" : "loading";
    void separateStems(buf).then((res) => {
      if (token !== this.loadToken) return;
      if (!res) { if (this.stemStatus === "loading") this.stemStatus = "unsupported"; this.emit(); return; }
      this.applyRealStems(res);
    }).catch(() => { if (token === this.loadToken) { this.stemStatus = "error"; this.emit(); } });
  }

  private async analyzeWave(buf: AudioBuffer, token: number) {
    this.analyzing = true;
    try {
      const peaks = await analyzeWaveform(buf, value => {
        if (token !== this.loadToken) return;
        this.analysisProgress = value;
        this.emit();
      });
      if (token !== this.loadToken) return;
      this.wavePeaks = peaks;
      this.analysisProgress = 1;
    } catch {
      // Analysis failure must never stop playback.
    } finally {
      if (token === this.loadToken) { this.analyzing = false; this.emit(); }
    }
  }

  private resetStemRouting() {
    if (!this.realStems) return;
    try { this.stemSplit.disconnect(); } catch { /* noop */ }
    this.stemSplitter?.disconnect();
    this.stemMergers.forEach((m) => m.disconnect());
    this.stemSplitter = null;
    this.stemMergers = [];
    for (const k of STEM_ORDER) {
      this.stemSplit.connect(this.stems[k].filter);
      this.stems[k].filter.connect(this.stems[k].gain);
    }
    this.realStems = false;
  }

  /** Swap in an 8-channel buffer (4 stereo stems) and route each pair to its stem gain. */
  private applyRealStems(res: { stems: Record<StemKey, [Float32Array, Float32Array]>; sampleRate: number }) {
    const first = res.stems.drums[0];
    const multi = this.ctx.createBuffer(8, first.length, res.sampleRate);
    STEM_ORDER.forEach((k, i) => {
      multi.copyToChannel(res.stems[k][0] as Float32Array<ArrayBuffer>, i * 2);
      multi.copyToChannel(res.stems[k][1] as Float32Array<ArrayBuffer>, i * 2 + 1);
    });
    const pos = this.currentTime;
    const wasPlaying = this.playing;
    if (wasPlaying) this.pause();
    // Nodes upstream must carry all 8 channels discretely.
    for (const n of [this.gain, this.eqLow, this.eqMid, this.eqHigh, this.filter, this.stemSplit] as AudioNode[]) {
      n.channelCountMode = "max";
      n.channelInterpretation = "discrete";
    }
    try { this.stemSplit.disconnect(); } catch { /* noop */ }
    const splitter = this.ctx.createChannelSplitter(8);
    this.stemSplit.connect(splitter);
    this.stemMergers = STEM_ORDER.map((k, i) => {
      const m = this.ctx.createChannelMerger(2);
      splitter.connect(m, i * 2, 0);
      splitter.connect(m, i * 2 + 1, 1);
      try { this.stems[k].filter.disconnect(); } catch { /* noop */ }
      m.connect(this.stems[k].gain);
      return m;
    });
    this.stemSplitter = splitter;
    this.buffer = multi;
    this.reverseBuffer = null;
    this.wavePeaks = null;
    void this.analyzeWave(multi, this.loadToken);
    this.realStems = true;
    this.stemStatus = "ready";
    this.pausedAt = pos;
    if (wasPlaying) this.play();
    this.emit();
  }

  on(l: Listener) {
    this.listeners.add(l);
    return () => this.listeners.delete(l);
  }
  private emit() {
    this.listeners.forEach((l) => l());
  }

  async loadFile(file: File, coverUrl: string | null = null) {
    ++this.loadToken;
    this.pause();
    this.buffer = null;
    this.wavePeaks = null;
    if (this.coverUrl?.startsWith("blob:") && this.coverUrl !== coverUrl) URL.revokeObjectURL(this.coverUrl);
    this.coverUrl = coverUrl;
    this.videoEl?.pause();
    const isVideo = file.type.startsWith("video/") || /\.(mp4|webm|mov|m4v)$/i.test(file.name);
    this.trackName = file.name.replace(/\.[^.]+$/, "");
    if (isVideo) {
      if (file.size > 120 * 1024 * 1024) { await this.loadVideoSrc(URL.createObjectURL(file), null); return; }
      const v = await openVideo(URL.createObjectURL(file));
      this.videoEl = v;
      const ab = await file.arrayBuffer();
      try {
        void native.load(this.id, ab.slice(0));
        this.buffer = await this.ctx.decodeAudioData(ab.slice(0));
        this.reverseBuffer = null;
      } catch {
        // Browsers do not decode every video codec through Web Audio. In that
        // case the media element itself is the clock and audible source.
        this.buffer = null;
        this.reverseBuffer = null;
      }
    } else {
      this.videoEl = null;
      const ab = await file.arrayBuffer();
      void native.load(this.id, ab.slice(0));
      this.buffer = await this.ctx.decodeAudioData(ab);
      this.reverseBuffer = null;
    }
    this.pausedAt = 0;
    this.cuePoint = 0;
    this.hotCues = Array(8).fill(null);
    this.bpm = 0;
    this.firstBeat = 0;
    if (this.buffer) void this.scratchPlayer?.prime(this.buffer);
    this.afterLoad();
    this.emit();
  }

  get duration() {
    return this.buffer?.duration ?? this.videoEl?.duration ?? 0;
  }

  get currentTime(): number {
    // While scratching the transport source is stopped — report the live
    // scratch position so waveforms / jog wheels track the finger 1:1.
    if (this.scratching) return this.scratchPos;
    if (!this.playing) return this.pausedAt;
    if (!this.buffer && this.videoEl) return this.videoEl.currentTime;
    return playbackPosition(this.pausedAt, this.startedAt, this.ctx.currentTime, this.rate * (1 + (this.nudge || 0)));
  }


  play() {
    if (this.playing || (!this.buffer && !this.videoEl)) return;
    if (!this.buffer && this.videoEl) {
      this.playing = true;
      this.videoEl.muted = false;
      if (Math.abs(this.videoEl.currentTime - this.pausedAt) > 0.08) this.videoEl.currentTime = this.pausedAt;
      this.videoEl.playbackRate = this.rate;
      this.videoEl.play().catch(() => { this.playing = false; this.emit(); });
      this.emit();
      return;
    }
    if (!this.buffer) return;
    this.nudge = 0;
    const src = this.ctx.createBufferSource();
    src.buffer = this.buffer;
    src.playbackRate.value = this.rate;
    this.updateKeyRate(this.rate);
    const fade = this.ctx.createGain();
    fade.gain.setValueAtTime(0, this.ctx.currentTime);
    fade.gain.linearRampToValueAtTime(1, this.ctx.currentTime + 0.003);
    src.connect(fade).connect(this.keyLock && this.keyProcessor ? this.keyProcessor : this.gain);
    this.sourceGain = fade;
    src.start(0, Math.max(0, this.pausedAt));
    src.onended = () => {
      // Auto-rewind: when the source finishes (track end), stop & reset to 0.
      if (this.source === src && this.playing) {
        try { src.disconnect(); } catch {}
        this.source = null;
        this.playing = false;
        this.pausedAt = 0;
        if (this.videoEl) { try { this.videoEl.pause(); this.videoEl.currentTime = 0; } catch {} }
        this.emit();
      }
    };
    this.source = src;
    this.startedAt = this.ctx.currentTime;
    this.playing = true;
    native.play(this.id, this.pausedAt, this.rate);
    if (this.videoEl) {
      if (Math.abs(this.videoEl.currentTime - this.pausedAt) > 0.08) this.videoEl.currentTime = this.pausedAt;
      this.videoEl.playbackRate = this.rate;
      this.videoEl.muted = true;
      this.videoEl.play().catch(() => {});
      this.startVideoSync();
    }
    this.emit();
  }

  pause() {
    if (!this.playing) return;
    this.pausedAt = this.currentTime;
    try {
      this.source?.stop();
    } catch {}
    this.source?.disconnect();
    this.source = null;
    this.playing = false;
    native.pause(this.id);
    if (this.videoEl) this.videoEl.pause();
    this.emit();
  }

  toggle() {
    const brake = (globalThis as { __djBrake?: boolean }).__djBrake;
    if (this.playing && brake && !this.scratching) this.brakeStop();
    else this.playing ? this.pause() : this.play();
  }

  seek(t: number) {
    if (!Number.isFinite(t)) return;
    if (this.scratching) {
      this.wasPlayingBeforeScratch = false;
      this.endScratch();
    }
    const wasPlaying = this.playing;
    if (wasPlaying) this.pause();
    this.pausedAt = Math.max(0, Math.min(this.duration, t));
    if (this.videoEl && !this.videoEl.seeking) this.videoEl.currentTime = this.pausedAt;
    if (wasPlaying) this.play();
    else this.emit();
  }

  setBeatGrid(bpm: number, firstBeat = this.firstBeat) {
    const grid = correctedGrid(bpm, firstBeat);
    if (!grid) return;
    this.gridRevision++;
    this.bpm = grid.bpm;
    this.firstBeat = grid.firstBeat;
    this.emit();
  }

  setCue() {
    this.cuePoint = this.currentTime;
    this.cueSet = true;
    this.emit();
  }

  triggerCue() {
    if (!this.buffer && !this.videoEl) return;
    if (!this.playing && !this.cueSet) { this.setCue(); return; }
    this.seek(this.cuePoint);
    this.play();
  }

  setFxBeats(key: FxKey, beats: number) {
    this.fxBeatOverrides[key] = Math.max(0.0625, Math.min(4, beats));
    if (this.activeFx === key) this.setFx(key, this.fxAmount);
    else this.emit();
  }

  cue() {
    this.seek(this.cuePoint);
  }

  setHotCue(i: number) {
    if (i < 0 || i >= this.hotCues.length || !Number.isInteger(i)) return;
    this.hotCues[i] = { index: i, time: this.quantize ? snapToBeat(this.currentTime, this.bpm, this.firstBeat, this.duration) : this.currentTime };
    this.emit();
  }

  quantize = true;
  setQuantize(on: boolean) { this.quantize = on; this.emit(); }

  clearHotCue(i: number) {
    this.hotCues[i] = null;
    this.emit();
  }

  triggerHotCue(i: number) {
    const c = this.hotCues[i];
    if (c) this.seek(c.time);
  }

  /** Play a hot cue with a temporary pitch offset (%) — video-mode Pitch Cue pads. */
  triggerPitchCue(i: number, pct: number) {
    const c = this.hotCues[i];
    if (!c) return;
    this.setPitchRaw(Math.max(-50, Math.min(50, pct)));
    this.seek(c.time);
    this.play();
    this.emit();
  }

  /** Jump forward (positive) or back (negative) by whole beats on the grid. */
  skipBeats(beats: number) {
    if (!this.buffer && !this.videoEl) return;
    const beat = 60 / (this.bpm || 120);
    const t = this.currentTime;
    const target = this.firstBeat > 0
      ? this.firstBeat + Math.round((t - this.firstBeat) / beat + beats) * beat
      : t + beats * beat;
    this.seek(Math.max(0, Math.min(this.duration, target)));
  }

  setPitch(p: number) {
    if (this.syncLocked) this.unlockSync();
    this.setPitchRaw(p);
    this.emit();
  }

  // Stable tempo lock: align once, then follow only deliberate master tempo changes.
  // Never use visible pitch as a phase-error controller or seek on an 80ms timer.
  syncLocked = false;
  /** Pre-cue: hear this deck in the headphones before the crowd does. */
  cueTap!: GainNode;
  cueOn = false;
  onCueChange: () => void = () => {};
  toggleCue(on = !this.cueOn) {
    this.cueOn = on;
    this.cueTap.gain.setTargetAtTime(on ? 1 : 0, this.ctx.currentTime, 0.01);
    this.onCueChange();
    this.emit();
  }
  /** Invisible phase-correction bias on top of the displayed pitch (never shown). */
  private nudge = 0;
  private setNudge(n: number) {
    if (n === this.nudge || !this.playing || this.scratching || !this.buffer) return;
    this.pausedAt = this.currentTime;
    this.startedAt = this.ctx.currentTime;
    this.nudge = n;
    const r = this.rate * (1 + n);
    if (this.source) this.source.playbackRate.value = r;
    this.updateKeyRate(r);
    native.rate(this.id, r);
  }
  private syncMaster: Deck | null = null;
  private syncTimer: number | null = null;
  private unlockSync() {
    this.setNudge(0);
    this.syncLocked = false;
    this.syncMaster = null;
    if (this.syncTimer != null) clearInterval(this.syncTimer);
    this.syncTimer = null;
    this.emit();
  }
  toggleSync(other: Deck) {
    if (this.syncLocked) {
      this.unlockSync();
      return;
    }
    if (!this.bpm || !other.bpm) return;
    // A follower cannot also be the master of this deck: break reciprocal locks.
    if (other.syncLocked) other.unlockSync();
    this.syncTo(other);
    this.syncLocked = true;
    this.syncMaster = other;
    if (typeof window !== "undefined") this.syncTimer = window.setInterval(() => this.syncTick(), 100);
    this.emit();
  }
  private syncTick() {
    const m = this.syncMaster;
    if (!m || !m.bpm || !this.bpm || this.scratching || m.scratching) return;
    const p = syncPitch(m, this);
    if (Math.abs(p - this.pitch) > 0.001) { this.setPitchRaw(p); this.emit(); }
    // Keep the kicks locked: tiny hidden speed bias pulls the beat back in line
    // (like Serato/rekordbox beat-lock) instead of bouncing the visible pitch.
    if (!this.playing || !m.playing) { this.setNudge(0); return; }
    const err = phaseCorrection(m, this);
    this.setNudge(Math.abs(err) < 0.005 ? 0 : Math.max(-0.06, Math.min(0.06, err * 120 / this.bpm)));
  }
  private setPitchRaw(p: number) {
    // Re-anchor BEFORE changing speed; otherwise all elapsed playback is
    // retroactively multiplied by the new rate, creating fictitious phase drift.
    if (this.playing && !this.scratching && this.buffer) {
      this.pausedAt = this.currentTime;
      this.startedAt = this.ctx.currentTime;
    }
    this.nudge = 0;
    this.pitch = Number.isFinite(p) ? Math.max(-50, Math.min(100, p)) : 0;
    this.rate = 1 + this.pitch / 100;
    if (this.source) this.source.playbackRate.value = this.rate;
    this.updateKeyRate(this.rate);
    if (this.playing && !this.scratching) native.rate(this.id, this.rate);
    if (this.videoEl) this.videoEl.playbackRate = this.rate;
  }

  // Match BPM (and optionally phase) of another deck.
  syncTo(other: Deck) {
    if (!this.bpm || !other.bpm) return;
    this.setPitchRaw(syncPitch(other, this));
    // phase align: snap pausedAt so beats align with other's currentTime
    const beat = 60 / other.bpm;
    if (beat > 0 && this.duration > 0) {
      const myBeat = 60 / this.bpm;
      const target = beatPhase(other.currentTime - other.firstBeat, beat);
      const cur = this.currentTime - this.firstBeat;
      let snapped = Math.floor(cur / myBeat) * myBeat + target * myBeat + this.firstBeat;
      if (snapped - this.currentTime > myBeat / 2) snapped -= myBeat;
      this.seek(Math.max(0, Math.min(this.duration, snapped)));
    }
    this.emit();
  }

  setVolume(v: number) {
    this.volume = v;
    this.out.gain.value = v;
    native.volume(this.id, v);
    this.emit();
  }

  getLevel() {
    this.analyser.getByteTimeDomainData(this.meterData);
    let sum = 0;
    for (const sample of this.meterData) {
      const n = (sample - 128) / 128;
      sum += n * n;
    }
    return Math.min(1, Math.sqrt(sum / this.meterData.length) * 3.2);
  }

  getStereoLevels(): [number, number] {
    const levels = this.stereoAnalysers.map((analyser, channel) => {
      const data = this.stereoMeterData[channel];
      analyser.getByteTimeDomainData(data);
      let sum = 0;
      for (const sample of data) sum += ((sample - 128) / 128) ** 2;
      return Math.min(1, Math.sqrt(sum / data.length) * 3.2);
    });
    return [levels[0] ?? 0, levels[1] ?? 0];
  }

  setEq(band: "low" | "mid" | "high", db: number) {
    const node = band === "low" ? this.eqLow : band === "mid" ? this.eqMid : this.eqHigh;
    node.gain.value = db;
    this.emit();
  }

  setFilter(v: number) {
    if (Math.abs(v) < 0.02) {
      this.filter.type = "allpass";
      this.filter.frequency.value = 1000;
      return;
    }
    if (v < 0) {
      this.filter.type = "lowpass";
      this.filter.frequency.value = 20000 * Math.pow(0.01, -v);
    } else {
      this.filter.type = "highpass";
      this.filter.frequency.value = 20 * Math.pow(1000, v);
    }
  }

  // Per-deck FX. `key` is a preset id from FX_LIBRARY.
  // Click-free: the old chain fades out on its own gain while the new one
  // fades in. Insert FX (filters, gates, mod) crossfade dry↔wet so the dry
  // signal never doubles up; send FX (echo/reverb) keep the dry at unity.
  private fxChainOut: GainNode | null = null;
  private fxInsert = false;
  private fxChainIn: AudioNode | null = null;
  setFx(key: FxKey | null, amount = this.fxAmount) {
    const t = this.ctx.currentTime;
    const oldOut = this.fxChainOut;
    const oldNodes = this.fxNodes;
    const oldIn = this.fxChainIn;
    if (oldOut) {
      oldOut.gain.cancelScheduledValues(t);
      oldOut.gain.setTargetAtTime(0, t, 0.012);
      window.setTimeout(() => {
        if (oldIn) { try { this.fxInput.disconnect(oldIn); } catch {} }
        [...oldNodes, oldOut].forEach((n) => {
          try { n.disconnect(); } catch {}
          try { (n as OscillatorNode).stop?.(); } catch {}
        });
      }, 120);
    }
    this.fxNodes = [];
    this.fxChainOut = null;
    this.fxChainIn = null;
    this.activeFx = key;
    this.fxAmount = amount;
    const preset = key ? FX_PRESET_MAP[key] : null;
    if (!preset) {
      this.fxInsert = false;
      this.fxDry.gain.setTargetAtTime(1, t, 0.012);
      this.emit();
      return;
    }
    const params = { ...(preset.params ?? {}) };
    if (this.fxBeatOverrides[key ?? ""] !== undefined) params.beats = this.fxBeatOverrides[key ?? ""];
    const beat = this.bpm > 0 ? 60 / (this.bpm * this.rate) : 0.5;
    if (typeof params.beats === "number") {
      const len = params.beats * beat;
      if (preset.base === "echo" || preset.base === "delay") params.time = Math.min(3.9, len);
      else params.rate = 1 / Math.max(0.01, len);
    }
    const chain = buildFxChain(this.ctx, preset.base, params);
    const chainOut = this.ctx.createGain();
    chainOut.gain.value = 0;
    this.fxInput.connect(chain.first);
    chain.last.connect(chainOut).connect(this.fxWet);
    chainOut.gain.setTargetAtTime(1, t, 0.012);
    this.fxNodes = chain.nodes;
    this.fxChainOut = chainOut;
    this.fxChainIn = chain.first;
    this.fxInsert = !["echo", "delay", "reverb"].includes(preset.base);
    this.applyFxMix();
    this.emit();
  }

  private applyFxMix() {
    const t = this.ctx.currentTime;
    const a = Math.max(0, Math.min(1, this.fxAmount));
    const on = !!this.activeFx;
    const wet = on ? (this.fxInsert ? a : a * 0.85) : 0;
    const dry = on && this.fxInsert ? 1 - a : 1;
    this.fxWet.gain.setTargetAtTime(wet, t, 0.015);
    this.fxDry.gain.setTargetAtTime(dry, t, 0.015);
  }

  setFxAmount(a: number) {
    this.fxAmount = a;
    this.applyFxMix();
    this.emit();
  }

  // Momentary "instant" FX: hold to engage full wet, release lets the tail ring out.
  holdFx(key: FxKey) {
    if (key.startsWith("echo_out")) return this.echoOut(key);
    if (key === "brake") return this.brakeStop();
    if (key === "backspin_echo") return this.backspinEcho(false);
    if (key === "backspin_echo_out") return this.backspinEcho(true);
    this.setFx(key, 1);
  }
  releaseFx(tail = true) {
    const key = this.activeFx;
    if (!key) return;
    const preset = FX_PRESET_MAP[key];
    const isSend = preset && ["echo", "delay", "reverb"].includes(preset.base);
    const t = this.ctx.currentTime;
    // Dry snaps back instantly; send tails ring out like djay.
    this.fxDry.gain.setTargetAtTime(1, t, 0.01);
    this.fxInput.gain.setTargetAtTime(isSend && tail ? 0 : 1, t, 0.01);
    this.fxWet.gain.setTargetAtTime(0, t, isSend && tail ? 0.6 : 0.015);
    window.setTimeout(() => {
      if (this.activeFx === key) this.setFx(null);
      this.fxInput.gain.setTargetAtTime(1, this.ctx.currentTime, 0.01);
    }, isSend && tail ? 2400 : 80);
  }

  // Real echo-out: beat-synced echo, input to the echo is cut after one beat
  // so only the repeats ring out, and the transport stops underneath.
  echoOut(key: FxKey = "echo_out") {
    if (!this.buffer && !this.videoEl) return;
    this.setFx(FX_PRESET_MAP[key] ? key : "echo_out", 1);
    const t = this.ctx.currentTime;
    const beat = this.bpm > 0 ? 60 / this.bpm : 0.5;
    this.fxDry.gain.cancelScheduledValues(t);
    this.fxDry.gain.setTargetAtTime(0, t, 0.02);
    this.fxInput.gain.cancelScheduledValues(t);
    this.fxInput.gain.setValueAtTime(1, t);
    this.fxInput.gain.setTargetAtTime(0, t + beat, 0.02);
    window.setTimeout(() => this.pause(), beat * 1000 + 40);
    window.setTimeout(() => {
      this.fxWet.gain.setTargetAtTime(0, this.ctx.currentTime, 0.6);
    }, 1800);
    window.setTimeout(() => {
      this.setFx(null);
      this.fxInput.gain.setTargetAtTime(1, this.ctx.currentTime, 0.01);
      this.fxDry.gain.setTargetAtTime(1, this.ctx.currentTime, 0.01);
    }, 4200);
  }

  // Turntable brake: platter slows to a stop over `seconds`, then pauses.
  brakeStop(seconds = scratchCfg().brake) {
    if (!this.playing) return;
    if (!this.buffer) { this.pause(); return; }
    this.scratchStart();
    this.wasPlayingBeforeScratch = false;
    const start = performance.now();
    const from = this.rate;
    const step = () => {
      if (!this.scratching) return;
      const k = Math.min(1, (performance.now() - start) / (seconds * 1000));
      const r = from * Math.pow(1 - k, 1.6);
      if (k >= 1 || r < 0.02) { this.scratch(0); this.endScratch(); return; }
      this.scratch(r);
      requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  // Backspin (reverse spin-down) with echo — optionally ending in an echo-out.
  backspinEcho(withOut = false) {
    if (!this.buffer) return;
    this.setFx(withOut ? "backspin_echo_out" : "backspin_echo", 0.85);
    this.scratchStart();
    let rate = -6;
    const step = () => {
      rate *= 0.87;
      if (Math.abs(rate) < 0.15) {
        this.endScratch();
        if (withOut) this.echoOut("echo_out");
        else window.setTimeout(() => this.setFx(null), 1600);
        return;
      }
      this.scratch(rate);
      requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  // Real Web Audio scratching: swap forward/reverse buffer sources so
  // negative rates truly play backwards (playbackRate can't be negative).
  scratchStart() {
    if (this.scratching) { this.releaseToken++; return; }
    if (!this.buffer) return;
    const playhead = this.currentTime;
    this.wasPlayingBeforeScratch = this.playing;
    this.scratchPos = playhead;
    this.scratching = true;
    this.scratchRate = 0;
    if (this.playing) {
      this.pausedAt = this.scratchPos;
      const oldSource = this.source, oldGain = this.sourceGain;
      const now = this.ctx.currentTime;
      oldGain?.gain.cancelScheduledValues(now);
      oldGain?.gain.setValueAtTime(oldGain.gain.value, now);
      oldGain?.gain.linearRampToValueAtTime(0, now + 0.003);
      try { oldSource?.stop(now + 0.003); } catch {}
      window.setTimeout(() => { oldSource?.disconnect(); oldGain?.disconnect(); }, 15);
      this.source = null;
      this.sourceGain = null;
      this.playing = false;
    }
    if (isNative()) native.play(this.id, this.scratchPos, 0);
    else void this.scratchPlayer?.start(this.buffer, this.scratchPos, 0);
    this.emit();
  }

  scratch(rate: number, when?: number) {
    if (!this.buffer) return;
    if (!this.scratching) this.scratchStart();
    // Signed rate straight to the worklet: it smooths per-sample and reads the
    // track with cubic (Hermite) interpolation, so reverse and slow motion are
    // click-free and speed is identical on every device.
    const r = Number.isFinite(rate) ? Math.max(-12, Math.min(12, rate)) : 0;
    // Browser position comes from the audio worklet, not a competing JS clock.
    // Native position is sampled from Oboe asynchronously below.
    this.scratchRate = r;
    if (isNative()) {
      native.rate(this.id, r);
      const now = performance.now();
      if (!this.nativePositionBusy && now - this.lastNativePosition > 30) {
        this.nativePositionBusy = true;
        this.lastNativePosition = now;
        void native.position(this.id).then((pos) => {
          if (this.scratching && pos !== null) this.scratchPos = Math.max(0, Math.min(this.duration, pos));
        }).finally(() => { this.nativePositionBusy = false; });
      }
    }
    else this.scratchPlayer?.setRate(r, when);
    if (!isNative() && !this.scratchPlayer?.available) {
      // No worklet available: silent scrub so the UI still tracks the finger.
      this.scratchPos = Math.max(0, Math.min(this.duration, this.scratchPos + r * 0.016));
    }

    // Keep video locked to the platter like VDJ/Serato: the picture is paused
    // and scrubbed frame-by-frame, only issuing a new seek once the previous
    // frame has decoded (stacking seeks is what made the video hang).
    this.scrubVideo();
  }

  /**
   * Position-controlled scratch: `pos` is the absolute platter position in
   * track seconds, `vel` the hand speed. The worklet servos to it, so audio,
   * waveform and jogwheel stay locked to the finger with no drift.
   */
  scratchTo(pos: number, vel: number) {
    if (!this.buffer) return;
    if (!this.scratching) this.scratchStart();
    const p = Math.max(0, Math.min(this.duration, pos));
    if (!isNative() && this.scratchPlayer?.available) {
      this.releaseToken++;
      this.scratchPlayer.setTarget(p, vel);
      this.scrubVideo();
      return;
    }
    this.releaseToken++;
    this.scratchPos = p;
    this.scratchRate = Number.isFinite(vel) ? Math.max(-16, Math.min(16, vel)) : 0;
    if (isNative()) native.target(this.id, p, this.scratchRate);
    this.scrubVideo();
  }

  /** True while the hand holds the platter or it is still free-spinning. */
  get isScratching() { return this.scratching; }

  /** True when the browser worklet can replay time-stamped hand paths. */
  get pathScratch() { return !isNative() && !!this.scratchPlayer?.available; }

  /** Hand-trajectory scratch: platter position at a pointer event timestamp. */
  scratchPath(pos: number, eventTime: number) {
    if (!this.buffer) return;
    if (!this.scratching) this.scratchStart();
    const p = Math.max(0, Math.min(this.duration, pos));
    this.releaseToken++;
    // In path mode the worklet reports the real (delayed) position; mixing in
    // the immediate hand position would make the feedback jump.
    if (!this.pathScratch) this.scratchPos = p;
    this.scratchPlayer?.pushPoint(p, eventTime);
    this.scrubVideo();
  }

  private releaseToken = 0;
  /** Platter released: motor spin-up, instant play or coast with friction. */
  releaseScratch(handVel = 0) {
    if (!this.scratching) return;
    const cfg = scratchCfg();
    const sp = this.scratchPlayer;
    if (isNative() || !sp?.available) { this.endScratch(); return; }
    const token = ++this.releaseToken;
    const exit = Number.isFinite(handVel) && Math.abs(handVel) > 0.05 ? handVel : sp.liveRate;
    if (this.wasPlayingBeforeScratch) {
      if (cfg.release === "instant") { this.endScratch(); return; }
      // Flung while playing: leave the hand at its speed, then the motor pulls it back.
      const tau = Math.max(0.001, cfg.inertia / 3);
      sp.motor(this.rate, tau, Math.abs(exit) > 0.3 ? exit : undefined);
      window.setTimeout(() => { if (token === this.releaseToken) this.endScratch(); }, cfg.inertia * 1000 + 20);
      return;
    }
    if (Math.abs(exit) < 0.25 && cfg.release !== "spin") { this.endScratch(); return; }
    // Free-spinning platter (CrossDJ / djay style): keeps turning at the
    // fling speed and slows down with the platter friction setting.
    const boost = cfg.release === "spin" ? 1.4 : 1;
    const v = Math.max(-12, Math.min(12, exit * boost));
    const tau = freeSpinTau(cfg.friction);
    sp.motor(0, tau, v);
    const ms = tau * Math.log(Math.max(1.5, Math.abs(v) / 0.02)) * 1000;
    window.setTimeout(() => { if (token === this.releaseToken) this.endScratch(); }, Math.min(12000, ms + 30));
  }

  private scrubVideo() {
    const v = this.videoEl;
    if (!v || !this.scratching) return;
    try {
      if (!v.paused) v.pause();
      this.videoScrubTarget = Math.max(0, Math.min(this.duration - 0.05, this.scratchPos));
      if (v.seeking || this.videoSeekQueued) return;
      if (Math.abs(v.currentTime - this.videoScrubTarget) < 0.034) return;
      this.videoSeekQueued = true;
      v.addEventListener("seeked", () => {
        this.videoSeekQueued = false;
        if (this.scratching && Math.abs(v.currentTime - this.videoScrubTarget) > 0.034) this.scrubVideo();
      }, { once: true });
      v.currentTime = this.videoScrubTarget;
    } catch { this.videoSeekQueued = false; }
  }

  /** Gentle audio→video drift correction during normal playback. */
  private videoSyncTimer: number | null = null;
  private startVideoSync() {
    if (this.videoSyncTimer != null || typeof window === "undefined") return;
    this.videoSyncTimer = window.setInterval(() => {
      const v = this.videoEl;
      if (!v || !this.playing || this.scratching || !this.buffer) {
        if (!this.playing && this.videoSyncTimer != null) { clearInterval(this.videoSyncTimer); this.videoSyncTimer = null; }
        return;
      }
      if (v.seeking) return;
      const drift = this.currentTime - v.currentTime; // + = video behind
      if (Math.abs(drift) > 0.25) {
        v.currentTime = this.currentTime;
        v.playbackRate = this.rate;
      } else if (Math.abs(drift) > 0.05) {
        // Nudge speed instead of seeking — no visible jumps.
        v.playbackRate = Math.max(0.25, this.rate * (1 + Math.max(-0.04, Math.min(0.04, drift * 0.4))));
      } else if (v.playbackRate !== this.rate) {
        v.playbackRate = this.rate;
      }
      if (v.paused) v.play().catch(() => {});
    }, 200);
  }

  endScratch() {
    if (!this.scratching) return;
    this.releaseToken++;
    const livePosition = this.scratchPlayer?.position;
    if (!isNative() && livePosition != null) this.scratchPos = Math.max(0, Math.min(this.duration, livePosition));
    this.scratchPlayer?.stop();
    if (isNative()) native.pause(this.id);
    this.scratchRate = 0;
    this.scratching = false;
    this.pausedAt = Math.max(0, Math.min(this.duration, this.scratchPos));
    if (this.videoEl) {
      this.videoEl.playbackRate = this.rate;
      if (!this.wasPlayingBeforeScratch && !this.videoEl.seeking) this.videoEl.currentTime = this.pausedAt;
    }
    if (this.wasPlayingBeforeScratch) {
      this.play();
    } else {
      this.emit();
    }
  }

}

export type DeckId = "A" | "B" | "C" | "D";
export type DeckPair = "AB" | "CD";

type MixerListener = () => void;

export class Mixer {
  ctx: AudioContext;
  master: GainNode;
  crossA: GainNode;
  crossB: GainNode;
  crossC: GainNode;
  crossD: GainNode;
  sampleBus: GainNode;
  decks: { A: Deck; B: Deck; C: Deck; D: Deck };
  recorder: MediaRecorder | null = null;
  recordChunks: Blob[] = [];
  recordDest: MediaStreamAudioDestinationNode;
  /** Canvas of the video mix stage — set by the UI so recordings include video. */
  videoCanvas: HTMLCanvasElement | null = null;
  recordMime = "audio/webm";
  recordOptions: RecordingOptions = DEFAULT_RECORDING;

  crossfadeCurve: XfCurve = "smooth";
  activePair: DeckPair = "AB";
  fourDeck = false;
  lastCross = 0.5;
  private mixerListeners = new Set<MixerListener>();

  constructor() {
    const Ctx: typeof AudioContext =
      window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    this.ctx = new Ctx();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.9;
    this.crossA = this.ctx.createGain();
    this.crossB = this.ctx.createGain();
    this.crossC = this.ctx.createGain();
    this.crossD = this.ctx.createGain();
    // C/D start fully audible (they're not on the crossfader until pair-switched)
    this.crossC.gain.value = 1;
    this.crossD.gain.value = 1;
    this.sampleBus = this.ctx.createGain();
    this.sampleBus.gain.value = 0.9;
    this.recordDest = this.ctx.createMediaStreamDestination();

    this.crossA.connect(this.master);
    this.crossB.connect(this.master);
    this.crossC.connect(this.master);
    this.crossD.connect(this.master);
    this.sampleBus.connect(this.master);
    // On Android the Oboe engine is the audible output; web graph stays silent.
    if (!isNative()) this.master.connect(this.ctx.destination);
    this.master.connect(this.recordDest);

    this.decks = {
      A: new Deck(this.ctx, "A", this.crossA),
      B: new Deck(this.ctx, "B", this.crossB),
      C: new Deck(this.ctx, "C", this.crossC),
      D: new Deck(this.ctx, "D", this.crossD),
    };
    this.cueBus = this.ctx.createGain();
    for (const d of Object.values(this.decks)) {
      d.cueTap.connect(this.cueBus);
      d.onCueChange = () => this.routeCue();
    }
    this.setCrossfade(0.5);
  }

  on(l: MixerListener) {
    this.mixerListeners.add(l);
    return () => this.mixerListeners.delete(l);
  }
  private emit() {
    this.mixerListeners.forEach((l) => l());
  }

  // ---- Pre-cue / headphones ----
  cueBus!: GainNode;
  /** split = one jack + splitter cable (left ear master, right ear cue); device = second output (USB / Bluetooth). */
  cueMode: "split" | "device" = "split";
  cueDeviceId = "";
  private splitNodes: AudioNode[] = [];
  private cueAudio: HTMLAudioElement | null = null;
  private cueStream: MediaStreamAudioDestinationNode | null = null;
  get cueActive() { return Object.values(this.decks).some(d => d.cueOn); }
  setCueOutput(mode: "split" | "device", deviceId = "") {
    this.cueMode = mode;
    this.cueDeviceId = deviceId;
    this.routeCue();
    this.emit();
  }
  private routeCue() {
    if (isNative()) return;
    for (const n of this.splitNodes) { try { this.master.disconnect(n); } catch {} try { n.disconnect(); } catch {} }
    this.splitNodes = [];
    try { this.cueBus.disconnect(); } catch {}
    try { this.master.disconnect(this.ctx.destination); } catch {}
    if (this.cueAudio) { this.cueAudio.pause(); this.cueAudio.srcObject = null; }
    if (!this.cueActive) { this.master.connect(this.ctx.destination); return; }
    if (this.cueMode === "device") {
      this.master.connect(this.ctx.destination);
      this.cueStream ??= this.ctx.createMediaStreamDestination();
      this.cueBus.connect(this.cueStream);
      this.cueAudio ??= new Audio();
      this.cueAudio.srcObject = this.cueStream.stream;
      const a = this.cueAudio as HTMLAudioElement & { setSinkId?: (id: string) => Promise<void> } as { setSinkId?: (id: string) => Promise<void>; play: () => Promise<void> };
      void ("setSinkId" in a && a.setSinkId && this.cueDeviceId ? a.setSinkId(this.cueDeviceId) : Promise.resolve()).catch(() => {}).then(() => a.play().catch(() => {}));
      return;
    }
    const mono = (src: AudioNode) => {
      const g = this.ctx.createGain();
      g.channelCount = 1; g.channelCountMode = "explicit"; g.channelInterpretation = "speakers";
      src.connect(g);
      return g;
    };
    const merger = this.ctx.createChannelMerger(2);
    const m = mono(this.master), c = mono(this.cueBus);
    m.connect(merger, 0, 0);
    c.connect(merger, 0, 1);
    merger.connect(this.ctx.destination);
    this.splitNodes = [m, c, merger];
  }

  setActivePair(p: DeckPair) {
    if (this.activePair === p) return;
    this.activePair = p;
    this.setCrossfade(this.lastCross);
    this.emit();
  }
  setFourDeck(v: boolean) {
    if (this.fourDeck === v) return;
    this.fourDeck = v;
    this.setCrossfade(this.lastCross);
    this.emit();
  }
  toggleGroupSync(side: "left" | "right") {
    const followers = side === "left" ? [this.decks.A, this.decks.B] : [this.decks.C, this.decks.D];
    const masters = side === "left" ? [this.decks.C, this.decks.D] : [this.decks.A, this.decks.B];
    const master = masters.find(d => d.playing && d.bpm > 0) ?? masters.find(d => d.bpm > 0);
    const unlock = followers.every(d => d.syncLocked);
    if (!unlock && !master) return;
    if (master?.syncLocked && followers.some(d => d.bpm > 0)) master.toggleSync(followers[0]);
    for (const follower of followers) {
      if (unlock) follower.toggleSync(master ?? masters[0]);
      else if (master && follower.bpm > 0) {
        if (follower.syncLocked) follower.toggleSync(master);
        follower.toggleSync(master);
      }
    }
  }
  activeDecks(): { left: Deck; right: Deck } {
    return this.activePair === "AB"
      ? { left: this.decks.A, right: this.decks.B }
      : { left: this.decks.C, right: this.decks.D };
  }

  resume() {
    if (this.ctx.state === "suspended") this.ctx.resume();
  }

  setCrossfade(v: number) {
    this.lastCross = v;
    const xf = (globalThis as { __djXf?: { curve: XfCurve; lag: number; reverse: boolean } }).__djXf;
    const [a, b] = crossfaderGains(v, xf?.curve ?? this.crossfadeCurve, xf?.lag ?? 0.02, xf?.reverse ?? false);
    // ~1 ms ramps: hard cuts for chirps/transforms without clicks.
    const t = this.ctx.currentTime;
    const set = (g: GainNode, x: number) => { g.gain.cancelScheduledValues(t); g.gain.setTargetAtTime(x, t, 0.0012); vals.set(g, x); };
    const vals = new Map<GainNode, number>();
    if (this.fourDeck) {
      set(this.crossA, a); set(this.crossB, a); set(this.crossC, b); set(this.crossD, b);
    } else if (this.activePair === "AB") {
      set(this.crossA, a); set(this.crossB, b); set(this.crossC, 1); set(this.crossD, 1);
    } else {
      set(this.crossC, a); set(this.crossD, b); set(this.crossA, 1); set(this.crossB, 1);
    }
    native.xfade("A", vals.get(this.crossA) ?? 1);
    native.xfade("B", vals.get(this.crossB) ?? 1);
    native.xfade("C", vals.get(this.crossC) ?? 1);
    native.xfade("D", vals.get(this.crossD) ?? 1);
  }

  setCrossfadeCurve(c: XfCurve) {
    this.crossfadeCurve = c;
    this.setCrossfade(this.lastCross);
  }

  setMaster(v: number) {
    this.master.gain.value = v;
  }


  // Sampler: one-shot play from URL
  private sampleCache = new Map<string, AudioBuffer>();
  async playSample(url: string, gain = 1) {
    let buf = this.sampleCache.get(url);
    if (!buf) {
      const res = await fetch(url);
      const ab = await res.arrayBuffer();
      buf = await this.ctx.decodeAudioData(ab);
      this.sampleCache.set(url, buf);
    }
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const g = this.ctx.createGain();
    g.gain.value = gain;
    src.connect(g).connect(this.sampleBus);
    src.start();
  }

  /** Records the master mix. When a video stage canvas is registered, the
   *  recording is a real video file (canvas picture + master audio). */
  startRecord(options: RecordingOptions = DEFAULT_RECORDING) {
    if (this.recorder) return;
    if (typeof MediaRecorder === "undefined") throw new Error("Recording is not supported on this device.");
    if (options.kind === "video" && !this.videoCanvas?.captureStream) throw new Error("Open Video mode before recording video.");
    if (isNative()) throw new Error("Native audio recording is not connected yet. Record with browser audio instead.");
    this.recordOptions = { ...options };
    const profile = recordingProfile(options);
    this.recordChunks = [];
    const audioTracks = this.recordDest.stream.getAudioTracks();
    // 30fps capture; the stage only redraws on new decoded frames, so the
    // encoder is never fed duplicate work.
    const canvasStream =
      options.kind === "video" && this.videoCanvas && typeof this.videoCanvas.captureStream === "function"
        ? this.videoCanvas.captureStream(profile.fps)
        : null;
    this.recordCanvasStream = canvasStream;

    const pick = (list: string[]) => list.find((m) => MediaRecorder.isTypeSupported(m)) ?? "";
    let stream: MediaStream;
    let mime: string;
    if (canvasStream) {
      stream = new MediaStream([...canvasStream.getVideoTracks(), ...audioTracks]);
      // Prefer hardware-friendly codecs (H.264 / VP8). VP9 software encoding
      // on phones starves the main thread and makes the app hang.
      mime = pick([
        "video/mp4;codecs=avc1.42E01E,mp4a.40.2",
        "video/webm;codecs=h264,opus",
        "video/webm;codecs=vp8,opus",
        "video/mp4",
        "video/webm",
      ]);
    } else {
      stream = this.recordDest.stream;
      mime = pick(["audio/webm;codecs=opus", "audio/mp4", "audio/webm"]);
    }
    this.recordMime = mime;
    const opts: MediaRecorderOptions = { audioBitsPerSecond: profile.audioBitsPerSecond };
    if (mime) opts.mimeType = mime;
    if (canvasStream) opts.videoBitsPerSecond = profile.videoBitsPerSecond;
    try { this.recorder = new MediaRecorder(stream, opts); }
    catch (error) { canvasStream?.getTracks().forEach(t => t.stop()); this.recordCanvasStream = null; throw error; }
    this.recorder.ondataavailable = (e) => {
      if (e.data.size) this.recordChunks.push(e.data);
    };
    // Flush small chunks every second so stopping never has to encode/copy
    // the entire mix in one go (that was the post-record freeze).
    this.recorder.start(1000);
    this.emit();
  }

  recordCanvasStream: MediaStream | null = null;

  async stopRecord(): Promise<Blob | null> {
    if (!this.recorder) return null;
    const rec = this.recorder;
    const done = new Promise<Blob>((res) => {
      rec.onstop = () => {
        const blob = new Blob(this.recordChunks, { type: rec.mimeType || this.recordMime });
        this.recordChunks = [];
        this.recordCanvasStream?.getTracks().forEach((t) => t.stop());
        this.recordCanvasStream = null;
        res(blob);
      };
    });
    if (rec.state !== "inactive") rec.stop();
    this.recorder = null;
    this.emit();
    return done;
  }
}

function buildFxChain(
  ctx: AudioContext,
  base: FxBase,
  p: Record<string, number> = {}
): { first: AudioNode; last: AudioNode; nodes: AudioNode[] } {
  const nodes: AudioNode[] = [];
  const num = (k: string, d: number) => (typeof p[k] === "number" ? p[k] : d);
  switch (base) {
    case "echo":
    case "delay": {
      // Studio-grade echo: tape-style damped feedback loop with soft saturation
      // and a touch of stereo width, plus make-up gain so it cuts like hardware.
      const input = ctx.createGain();
      const d = ctx.createDelay(4);
      d.delayTime.value = num("time", base === "echo" ? 0.42 : 0.22);
      const fb = ctx.createGain();
      fb.gain.value = Math.min(0.9, num("fb", 0.55));
      const damp = ctx.createBiquadFilter();
      damp.type = "lowpass";
      damp.frequency.value = 7200;
      damp.Q.value = 0.3;
      const rumble = ctx.createBiquadFilter();
      rumble.type = "highpass";
      rumble.frequency.value = 140;
      const sat = ctx.createWaveShaper();
      sat.curve = makeSaturationCurve(0.3);
      sat.oversample = "4x";
      const out = ctx.createGain();
      out.gain.value = 1;
      input.connect(d);
      d.connect(damp).connect(rumble).connect(sat).connect(fb).connect(d);
      d.connect(out);
      nodes.push(input, d, fb, damp, rumble, sat, out);
      return { first: input, last: out, nodes };
    }
    case "reverb": {
      // Pre-delay + damped convolution tail + make-up gain = lush, non-muddy verb.
      const pre = ctx.createDelay(0.5);
      pre.delayTime.value = 0.018;
      const conv = ctx.createConvolver();
      conv.buffer = makeImpulse(ctx, num("time", 2.4), num("decay", 2.8));
      const damp = ctx.createBiquadFilter();
      damp.type = "lowpass";
      damp.frequency.value = 9000;
      const lowcut = ctx.createBiquadFilter();
      lowcut.type = "highpass";
      lowcut.frequency.value = 180;
      const out = ctx.createGain();
      out.gain.value = 0.9;
      pre.connect(conv).connect(damp).connect(lowcut).connect(out);
      nodes.push(pre, conv, damp, lowcut, out);
      return { first: pre, last: out, nodes };
    }
    case "filter":
    case "lpf": {
      // Two cascaded poles + resonance + drive: a real DJ-mixer style LPF.
      const f = ctx.createBiquadFilter();
      f.type = "lowpass";
      f.frequency.value = num("freq", 600);
      f.Q.value = num("q", 6);
      const f2 = ctx.createBiquadFilter();
      f2.type = "lowpass";
      f2.frequency.value = num("freq", 600);
      f2.Q.value = 0.7;
      const drive = ctx.createWaveShaper();
      drive.curve = makeSaturationCurve(0.25);
      drive.oversample = "2x";
      const out = ctx.createGain();
      out.gain.value = 1;
      f.connect(f2).connect(drive).connect(out);
      nodes.push(f, f2, drive, out);
      return { first: f, last: out, nodes };
    }
    case "hpf": {
      const f = ctx.createBiquadFilter();
      f.type = "highpass";
      f.frequency.value = num("freq", 2000);
      f.Q.value = num("q", 4);
      const f2 = ctx.createBiquadFilter();
      f2.type = "highpass";
      f2.frequency.value = num("freq", 2000);
      f2.Q.value = 0.7;
      const presence = ctx.createBiquadFilter();
      presence.type = "peaking";
      presence.frequency.value = Math.min(9000, num("freq", 2000) * 1.6);
      presence.gain.value = 1.5;
      presence.Q.value = 1;
      const out = ctx.createGain();
      out.gain.value = 1;
      f.connect(f2).connect(presence).connect(out);
      nodes.push(f, f2, presence, out);
      return { first: f, last: out, nodes };
    }
    case "flanger": {
      // Classic flanger: dry+delayed mix, base delay always above LFO depth
      // so the delay time never hits zero (that was the crackle).
      const input = ctx.createGain();
      const depth = Math.min(0.004, num("depth", 0.003));
      const d = ctx.createDelay(0.05);
      d.delayTime.value = depth + 0.0015;
      const lfo = ctx.createOscillator();
      lfo.frequency.value = num("rate", 0.4);
      const lfoGain = ctx.createGain();
      lfoGain.gain.value = depth;
      lfo.connect(lfoGain).connect(d.delayTime);
      lfo.start();
      const fb = ctx.createGain();
      fb.gain.value = Math.min(0.7, num("fb", 0.5));
      const out = ctx.createGain();
      out.gain.value = 0.6;
      input.connect(out);
      input.connect(d);
      d.connect(fb).connect(d);
      d.connect(out);
      nodes.push(input, d, lfo, lfoGain, fb, out);
      return { first: input, last: out, nodes };
    }
    // Aggressive 4-pole resonant wah: cascaded bandpass sweeps driven by one LFO.
    case "wahwah4": {
      const lfo = ctx.createOscillator();
      lfo.frequency.value = num("rate", 4);
      const lfoGain = ctx.createGain();
      lfoGain.gain.value = Math.min(700, num("depth", 1500) * 0.45);
      lfo.connect(lfoGain);
      lfo.start();
      const filters: BiquadFilterNode[] = [];
      for (let i = 0; i < 4; i++) {
        const f = ctx.createBiquadFilter();
        f.type = i === 0 ? "bandpass" : "peaking";
        f.frequency.value = 1100;
        f.Q.value = i === 0 ? Math.min(5, num("q", 16) * 0.3) : 2;
        if (i > 0) f.gain.value = 6;
        lfoGain.connect(f.frequency);
        filters.push(f);
      }
      const boost = ctx.createGain();
      boost.gain.value = 1.4;
      filters[0].connect(filters[1]).connect(filters[2]).connect(filters[3]).connect(boost);
      nodes.push(...filters, lfo, lfoGain, boost);
      return { first: filters[0], last: boost, nodes };
    }
    // Wah-Wah 4 into a strong flanger (single combined chain).
    case "wahflanger": {
      const wah = buildFxChain(ctx, "wahwah4", {
        rate: num("rate", 4),
        q: num("q", 16),
        depth: num("depth", 1500),
      });
      const fl = buildFxChain(ctx, "flanger", {
        rate: num("frate", 0.6),
        depth: num("fdepth", 0.01),
        fb: num("fb", 0.88),
      });
      wah.last.connect(fl.first);
      nodes.push(...wah.nodes, ...fl.nodes);
      return { first: wah.first, last: fl.last, nodes };
    }
    case "phaser": {
      const a1 = ctx.createBiquadFilter(); a1.type = "allpass";
      const a2 = ctx.createBiquadFilter(); a2.type = "allpass";
      const lfo = ctx.createOscillator();
      lfo.frequency.value = num("rate", 0.6);
      const lfoGain = ctx.createGain();
      lfoGain.gain.value = num("depth", 500);
      lfo.connect(lfoGain);
      lfoGain.connect(a1.frequency);
      lfoGain.connect(a2.frequency);
      lfo.start();
      a1.connect(a2);
      nodes.push(a1, a2, lfo, lfoGain);
      return { first: a1, last: a2, nodes };
    }
    case "wahwah": {
      const f = ctx.createBiquadFilter();
      f.type = "bandpass";
      f.frequency.value = 800;
      f.Q.value = 8;
      const lfo = ctx.createOscillator();
      lfo.frequency.value = num("rate", 2.2);
      const g = ctx.createGain();
      g.gain.value = 600;
      lfo.connect(g).connect(f.frequency);
      lfo.start();
      nodes.push(f, lfo, g);
      return { first: f, last: f, nodes };
    }
    case "bitcrush": {
      const ws = ctx.createWaveShaper();
      ws.curve = makeBitcrushCurve(num("bits", 6));
      nodes.push(ws);
      return { first: ws, last: ws, nodes };
    }
    case "gate": {
      // Hard rhythmic gate with click-free edges (square LFO through a
      // one-pole smoother) and make-up gain so chops punch.
      const g = ctx.createGain();
      const lfo = ctx.createOscillator();
      lfo.type = "square";
      lfo.frequency.value = num("rate", 8);
      const lfoGain = ctx.createGain();
      lfoGain.gain.value = 0.5;
      const smooth = ctx.createBiquadFilter();
      smooth.type = "lowpass";
      smooth.frequency.value = Math.min(400, Math.max(60, num("rate", 8) * 20));
      lfo.connect(lfoGain).connect(smooth).connect(g.gain);
      g.gain.value = 0.5;
      lfo.start();
      const out = ctx.createGain();
      out.gain.value = 1;
      g.connect(out);
      nodes.push(g, lfo, lfoGain, smooth, out);
      return { first: g, last: out, nodes };
    }
    case "tremolo": {
      const g = ctx.createGain();
      const lfo = ctx.createOscillator();
      lfo.frequency.value = num("rate", 6);
      const lfoGain = ctx.createGain();
      lfoGain.gain.value = 0.5;
      lfo.connect(lfoGain).connect(g.gain);
      g.gain.value = 0.5;
      lfo.start();
      nodes.push(g, lfo, lfoGain);
      return { first: g, last: g, nodes };
    }
    case "ringmod": {
      const g = ctx.createGain();
      g.gain.value = 0;
      const lfo = ctx.createOscillator();
      lfo.frequency.value = num("freq", 220);
      lfo.connect(g.gain);
      lfo.start();
      nodes.push(g, lfo);
      return { first: g, last: g, nodes };
    }
    case "roll": {
      // Beat roll / double beat: capture one slice and loop it (fb≈1).
      const input = ctx.createGain();
      const capture = ctx.createGain();
      const t0 = ctx.currentTime;
      const len = Math.max(0.03, num("time", 0) || 1 / Math.max(0.1, num("rate", 4)));
      capture.gain.setValueAtTime(1, t0);
      capture.gain.setTargetAtTime(0, t0 + len, 0.004);
      const d = ctx.createDelay(4);
      d.delayTime.value = Math.min(3.9, len);
      const fb = ctx.createGain();
      fb.gain.setValueAtTime(0, t0);
      fb.gain.setValueAtTime(0.995, t0 + len * 0.98);
      const out = ctx.createGain();
      input.connect(capture).connect(d);
      d.connect(fb).connect(d);
      input.connect(out);
      out.gain.setValueAtTime(1, t0);
      // dry passes for the first slice, then only the loop plays
      const loopOut = ctx.createGain();
      d.connect(loopOut);
      out.gain.setTargetAtTime(0, t0 + len, 0.004);
      const sum = ctx.createGain();
      out.connect(sum); loopOut.connect(sum);
      nodes.push(input, capture, d, fb, out, loopOut, sum);
      return { first: input, last: sum, nodes };
    }
    case "chorus": {
      const d = ctx.createDelay();
      d.delayTime.value = 0.025;
      const lfo = ctx.createOscillator();
      lfo.frequency.value = num("rate", 1.1);
      const lfoGain = ctx.createGain();
      lfoGain.gain.value = num("depth", 0.008);
      lfo.connect(lfoGain).connect(d.delayTime);
      lfo.start();
      nodes.push(d, lfo, lfoGain);
      return { first: d, last: d, nodes };
    }
    default: {
      const pass = ctx.createGain();
      nodes.push(pass);
      return { first: pass, last: pass, nodes };
    }
  }
}

function makeReversedBuffer(ctx: AudioContext, buf: AudioBuffer): AudioBuffer {
  const rev = ctx.createBuffer(buf.numberOfChannels, buf.length, buf.sampleRate);
  for (let c = 0; c < buf.numberOfChannels; c++) {
    const src = buf.getChannelData(c);
    const dst = rev.getChannelData(c);
    const n = src.length;
    for (let i = 0; i < n; i++) dst[i] = src[n - 1 - i];
  }
  return rev;
}

function makeImpulse(ctx: AudioContext, duration: number, decay: number) {
  const rate = ctx.sampleRate;
  const length = rate * duration;
  const impulse = ctx.createBuffer(2, length, rate);
  for (let c = 0; c < 2; c++) {
    const d = impulse.getChannelData(c);
    for (let i = 0; i < length; i++) {
      d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, decay);
    }
  }
  return impulse;
}

function makeBitcrushCurve(bits: number) {
  const n = 44100;
  const curve = new Float32Array(n);
  const step = Math.pow(0.5, bits);
  for (let i = 0; i < n; i++) {
    const x = (i / n) * 2 - 1;
    curve[i] = Math.round(x / step) * step;
  }
  return curve;
}

/** Soft analog-style saturation — warms echo tails and filter drive. */
function makeSaturationCurve(drive = 1.5) {
  const n = 8192;
  const curve = new Float32Array(n);
  const k = Math.max(0.1, drive) * 4;
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * 2 - 1;
    curve[i] = Math.tanh(x * k) / Math.tanh(k);
  }
  return curve;
}



const STEM_ORDER: StemKey[] = ["drums", "bass", "other", "vocals"];
function beatPhase(t: number, beat: number) {
  const x = (t % beat) / beat;
  return x < 0 ? x + 1 : x;
}

function estimateBpm(buf: AudioBuffer | null): number {
  if (!buf) return 0;
  const sr = buf.sampleRate;
  const data = buf.getChannelData(0);
  const hop = Math.max(1, Math.round(sr * 0.01));
  const frames = Math.min(Math.floor(data.length / hop), 12000);
  const onset = new Float32Array(frames);
  let previous = 0;
  let mean = 0;
  for (let frame = 0; frame < frames; frame++) {
    let energy = 0;
    const start = frame * hop;
    for (let i = 0; i < hop; i += 4) {
      const x = data[start + i] || 0;
      energy += x * x;
    }
    const flux = Math.max(0, energy - previous);
    previous = energy;
    mean += (flux - mean) * 0.02;
    onset[frame] = Math.max(0, flux - mean * 0.65);
  }
  let bestScore = 0;
  let bestBpm = 0;
  for (let bpm = 70; bpm <= 180; bpm += 0.25) {
    const lag = Math.round(6000 / bpm);
    let score = 0;
    for (let i = lag; i < frames; i++) score += onset[i] * onset[i - lag];
    const harmonicLag = lag * 2;
    if (harmonicLag < frames) {
      for (let i = harmonicLag; i < frames; i += 2) score += onset[i] * onset[i - harmonicLag] * 0.35;
    }
    if (score > bestScore) {
      bestScore = score;
      bestBpm = bpm;
    }
  }
  while (bestBpm && bestBpm < 85) bestBpm *= 2;
  while (bestBpm > 170) bestBpm /= 2;
  return bestBpm ? Math.round(bestBpm * 10) / 10 : 0;
}

export { computeBandedPeaks } from "./peaks";
export type { BandedPeaks } from "./peaks";

export function computeWaveformPeaks(buffer: AudioBuffer, bins: number): Float32Array {
  return computeBandedPeaks(buffer, bins).overall;
}
