/**
 * Real scratch engine — AudioWorklet + Hermite (cubic) interpolation.
 *
 * Pipeline:  finger movement → velocity → smoothing → interpolation →
 * variable-rate resampling → audio output.
 *
 * Instead of swapping forward/reverse buffer sources (which clicks on every
 * direction change) a single worklet reads the track at an arbitrary signed
 * rate. Negative rates play backwards sample-accurately, and the 4-point
 * Hermite interpolator removes the zipper noise you get from integer sample
 * jumps. Rate changes are smoothed per-sample inside the worklet, so playback
 * speed is identical no matter how fast the pointer events arrive.
 */

const PROCESSOR = `
class ScratchProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.ch = [];
    this.pos = 0;
    this.rate = 0;
    this.target = 0;
    this.on = false;
    this.frame = 0;
    // 'rate' = follow a signed speed (motor / brake / backspin)
    // 'pos'  = position servo: follow the platter's absolute position so the
    //          audio can never drift away from the hand (no velocity integration).
    this.mode = 'rate';
    this.tPos = 0; this.tVel = 0; this.age = 0;
    this.motorTau = 0.0009;
    this.port.onmessage = (e) => {
      const d = e.data;
      if (d.type === 'buffer') {
        this.ch = d.channels.map((c) => new Float32Array(c));
      } else if (d.type === 'start') {
        this.pos = d.pos * sampleRate;
        this.rate = d.rate || 0;
        this.target = this.rate;
        this.tPos = this.pos; this.tVel = 0; this.age = 0;
        this.mode = 'pos';
        this.on = true;
      } else if (d.type === 'rate') {
        this.target = Number.isFinite(d.rate) ? d.rate : 0;
        this.mode = 'rate'; this.motorTau = 0.0009;
      } else if (d.type === 'target') {
        // Absolute platter position (seconds) + hand velocity (sec/sec).
        this.tPos = d.pos * sampleRate;
        this.tVel = Number.isFinite(d.vel) ? Math.max(-24, Math.min(24, d.vel)) : 0;
        this.age = 0;
        this.mode = 'pos';
      } else if (d.type === 'motor') {
        // Release: spin up/down to a speed with a turntable-style time constant.
        this.target = Number.isFinite(d.rate) ? d.rate : 0;
        this.motorTau = Math.max(0.0005, d.tau || 0.0009);
        this.mode = 'rate';
      } else if (d.type === 'pos') {
        this.pos = d.pos * sampleRate;
      } else if (d.type === 'stop') {
        this.on = false;
        this.rate = 0;
        this.target = 0;
        this.port.postMessage({ type: 'pos', pos: this.pos / sampleRate, final: true });
      }
    };
  }

  lagrange6(c, i, f) {
    const n = c.length;
    const at = (k) => c[Math.max(0, Math.min(n - 1, k))] || 0;
    const y0 = at(i - 2), y1 = at(i - 1), y2 = at(i), y3 = at(i + 1), y4 = at(i + 2), y5 = at(i + 3);
    return -(f*(f-3)*(f-2)*(f-1)*(f+1))*y0/120
      +(f*(f-3)*(f-2)*(f-1)*(f+2))*y1/24
      -((f-3)*(f-2)*(f-1)*(f+1)*(f+2))*y2/12
      +(f*(f-3)*(f-2)*(f+1)*(f+2))*y3/12
      -(f*(f-3)*(f-1)*(f+1)*(f+2))*y4/24
      +(f*(f-2)*(f-1)*(f+1)*(f+2))*y5/120;
  }

  hermite(c, i, f) {
    const n = c.length;
    const p0 = c[i - 1 < 0 ? 0 : i - 1] || 0;
    const p1 = c[i < n ? i : n - 1] || 0;
    const p2 = c[i + 1 < n ? i + 1 : n - 1] || 0;
    const p3 = c[i + 2 < n ? i + 2 : n - 1] || 0;
    const c1 = 0.5 * (p2 - p0);
    const c2 = p0 - 2.5 * p1 + 2 * p2 - 0.5 * p3;
    const c3 = 0.5 * (p3 - p0) + 1.5 * (p1 - p2);
    return ((c3 * f + c2) * f + c1) * f + p1;
  }

  process(_inputs, outputs) {
    const out = outputs[0];
    const len = out[0].length;
    if (!this.on || this.ch.length === 0) {
      for (let c = 0; c < out.length; c++) out[c].fill(0);
      return true;
    }
    const n = this.ch[0].length;
    const jump = Math.abs(this.target - this.rate);
    const reversing = this.target * this.rate < 0;
    const tau = this.motorTau > 0.0011 ? this.motorTau : reversing ? 0.002 : jump > 2 ? 0.0012 : 0.0009;
    const k = 1 - Math.exp(-1 / (tau * sampleRate));
    // Position servo constants (allocation-free, computed once per block).
    const servo = 1 / (0.0045 * sampleRate);      // close position error in ~4.5 ms
    const kSm = 1 - Math.exp(-1 / (0.0012 * sampleRate)); // 1.2 ms anti-zipper
    // Extrapolate the hand for well over one display frame (60 Hz = 16.7 ms).
    // The old 9 ms cut-out dropped the platter to zero velocity mid-frame,
    // which gated the audio on every frame and sounded like cuts, not vinyl.
    const maxAge = 0.04 * sampleRate;             // extrapolate hand motion ≤40 ms
    const vDecay = Math.exp(-1 / (0.09 * sampleRate)); // gentle coast after that
    for (let s = 0; s < len; s++) {
      if (this.mode === 'pos') {
        if (this.age < maxAge) {
          const goal = this.tPos + this.tVel * this.age;
          let desired = this.tVel + (goal - this.pos) * servo;
          if (desired > 24) desired = 24; else if (desired < -24) desired = -24;
          this.rate += (desired - this.rate) * kSm;
        } else {
          // No fresh hand data: coast down smoothly instead of hard-stopping.
          this.rate *= vDecay;
          if (Math.abs(this.rate) < 0.001) this.rate = 0;
        }
        this.age++;
      } else {
        this.rate += (this.target - this.rate) * k;
        if (Math.abs(this.target - this.rate) < 0.0001) this.rate = this.target;
      }
      const i = Math.floor(this.pos);
      const f = this.pos - i;
      // A stationary platter must be silent: repeatedly outputting the same
      // sample creates a DC/buzzy tone on some Bluetooth and phone outputs.
      const slow = Math.min(1, Math.abs(this.rate) * 8);
      for (let c = 0; c < out.length; c++) {
        const src = this.ch[c < this.ch.length ? c : this.ch.length - 1];
        const value = i >= 2 && i + 3 < src.length ? this.lagrange6(src, i, f) : this.hermite(src, i, f);
        out[c][s] = Math.max(-1.08, Math.min(1.08, value)) * slow;
      }
      this.pos += this.rate;
      if (this.pos < 0) { this.pos = 0; this.rate = 0; this.target = 0; this.tVel = 0; if (this.tPos < 0) this.tPos = 0; }
      if (this.pos > n - 2) { this.pos = n - 2; this.rate = 0; this.target = 0; this.tVel = 0; if (this.tPos > n - 2) this.tPos = n - 2; }
    }
    this.port.postMessage({ type: 'pos', pos: this.pos / sampleRate, rate: this.rate });
    return true;
  }
}
registerProcessor('scratch-processor', ScratchProcessor);
`;

const loaded = new WeakSet<AudioContext>();

async function ensureModule(ctx: AudioContext) {
  if (loaded.has(ctx)) return;
  const url = URL.createObjectURL(new Blob([PROCESSOR], { type: "application/javascript" }));
  try {
    await ctx.audioWorklet.addModule(url);
    loaded.add(ctx);
  } finally {
    URL.revokeObjectURL(url);
  }
}

export class ScratchPlayer {
  private node: AudioWorkletNode | null = null;
  private sent: AudioBuffer | null = null;
  private ready: Promise<void>;
  private pendingRate = 0;
  private generation = 0;
  /** Last speed reported by the worklet (sec/sec), used for release hand-off. */
  liveRate = 0;
  /** Called ~every 512 frames with the live playhead position (seconds). */
  onPos: (t: number, final: boolean) => void = () => {};

  constructor(private ctx: AudioContext, private dest: AudioNode) {
    this.ready = this.init();
  }

  private async init() {
    try {
      await ensureModule(this.ctx);
      const node = new AudioWorkletNode(this.ctx, "scratch-processor", {
        numberOfInputs: 0,
        numberOfOutputs: 1,
        outputChannelCount: [2],
      });
      node.port.onmessage = (e: MessageEvent) => {
        const d = e.data as { type?: string; pos?: number; rate?: number };
        if (typeof d?.rate === "number") this.liveRate = d.rate;
        if (d?.type === "pos" && typeof d.pos === "number") this.onPos(d.pos, Boolean((d as { final?: boolean }).final));
      };
      node.connect(this.dest);
      this.node = node;
    } catch {
      this.node = null;
    }
  }

  get available() {
    return !!this.node;
  }

  private send(buffer: AudioBuffer) {
    if (!this.node || this.sent === buffer) return;
    const channels: ArrayBuffer[] = [];
    const count = Math.min(2, buffer.numberOfChannels);
    for (let c = 0; c < count; c++) {
      channels.push(buffer.getChannelData(c).slice().buffer);
    }
    this.node.port.postMessage({ type: "buffer", channels }, channels);
    this.sent = buffer;
  }

  async start(buffer: AudioBuffer, pos: number, rate = 0) {
    const generation = ++this.generation;
    this.pendingRate = rate;
    await this.ready;
    if (!this.node || generation !== this.generation) return false;
    this.send(buffer);
    this.node.port.postMessage({ type: "start", pos, rate: this.pendingRate });
    return true;
  }

  /** Upload the track to the worklet ahead of time so the first scratch has no hitch. */
  async prime(buffer: AudioBuffer) {
    await this.ready;
    this.send(buffer);
  }

  setRate(rate: number) {
    this.pendingRate = rate;
    this.node?.port.postMessage({ type: "rate", rate });
  }

  /** Position-servo scratch: absolute platter position (s) + hand velocity. */
  setTarget(pos: number, vel: number) {
    this.node?.port.postMessage({ type: "target", pos, vel });
  }

  /** Motor/brake ramp toward `rate` with time constant `tau` seconds. */
  motor(rate: number, tau: number) {
    this.node?.port.postMessage({ type: "motor", rate, tau });
  }

  setPos(pos: number) {
    this.node?.port.postMessage({ type: "pos", pos });
  }

  stop() {
    ++this.generation;
    this.pendingRate = 0;
    this.node?.port.postMessage({ type: "stop" });
  }
}
