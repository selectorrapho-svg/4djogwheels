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

export const SCRATCH_PROCESSOR = `
class ScratchProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.ch = [];
    this.pos = 0;
    this.rate = 0;
    this.target = 0;
    this.on = false;
    this.frame = 0;
    this.envelope = 0;
    this.motionGain = 0;
    this.dcX = []; this.dcY = [];
    this.events = [];
    this.sourceRate = sampleRate;
    this.session = 0;
    // 'rate' = follow a signed speed (motor / brake / backspin)
    // 'pos'  = position servo: follow the platter's absolute position so the
    //          audio can never drift away from the hand (no velocity integration).
    this.mode = 'rate';
    this.tPos = 0; this.tVel = 0; this.age = 0; this.lastT = 0; this.lastP = 0; this.estVel = 0;
    this.motorTau = 0.0009;
    // 'path' = time-stamped hand trajectory replayed with a small fixed delay.
    // The audio position is interpolated between real touch samples, so it
    // follows the hand exactly (no prediction, no overshoot, no jumps).
    this.path = []; this.delay = 0.016; this.s1 = 0; this.s2 = 0;
    this.port.onmessage = (e) => {
      const d = e.data;
      if (d.type === 'buffer') {
        this.ch = d.channels.map((c) => new Float32Array(c));
        this.sourceRate = d.sampleRate || sampleRate;
        this.dcX = this.ch.map(() => 0); this.dcY = this.ch.map(() => 0);
      } else if (d.type === 'start') {
        this.events = []; this.envelope = 0; this.motionGain = 0;
        this.session = d.session || 0;
        this.dcX.fill(0); this.dcY.fill(0);
        this.pos = d.pos * this.sourceRate;
        this.rate = d.rate || 0;
        this.target = this.rate;
        this.tPos = this.pos; this.tVel = 0; this.age = 0;
        this.lastT = 0; this.lastP = this.pos; this.estVel = 0;
        this.mode = 'pos'; this.path = [];
        this.s1 = this.pos; this.s2 = this.pos;
        this.on = true;
      } else if (d.type === 'rate') {
        if (Number.isFinite(d.when) && d.when > currentTime) {
          this.events.push({ frame: Math.round(d.when * sampleRate), rate: d.rate });
          this.events.sort((a, b) => a.frame - b.frame);
        } else {
          this.target = Number.isFinite(d.rate) ? d.rate : 0;
          this.mode = 'rate'; this.motorTau = 0.0009;
        }
      } else if (d.type === 'target') {
        // Absolute platter position (seconds) + hand velocity (sec/sec).
        const np = d.pos * this.sourceRate;
        const hv = Number.isFinite(d.vel) ? Math.max(-24, Math.min(24, d.vel)) : 0;
        const t = Number.isFinite(d.when) ? d.when : currentTime;
        // Blend the UI's hand speed with a speed measured from successive
        // absolute positions on the audio clock: jittery pointer timing can't
        // make the pitch wobble, and position and speed always agree.
        if (this.lastT > 0 && t - this.lastT > 0.002 && t - this.lastT < 0.05) {
          const est = (np - this.lastP) / this.sourceRate / (t - this.lastT);
          this.estVel += (Math.max(-24, Math.min(24, est)) - this.estVel) * 0.6;
          this.tVel = hv * 0.5 + this.estVel * 0.5;
          this.lastT = t; this.lastP = np;
        } else {
          if (!(this.lastT > 0) || t - this.lastT >= 0.05) { this.estVel = hv; this.lastT = t; this.lastP = np; }
          this.tVel = hv;
        }
        this.tPos = np;
        this.age = Number.isFinite(d.when) ? Math.max(0, Math.min(0.02, currentTime - d.when)) * sampleRate : 0;
        this.mode = 'pos';
      } else if (d.type === 'point') {
        const np = Math.max(0, d.pos * this.sourceRate);
        const when = Number.isFinite(d.when) ? d.when : currentTime;
        // Adaptive replay delay: measure how late touch points really arrive
        // (busy phones, Bluetooth). If they arrive after their replay time the
        // path stalls and the sound chops into "bad cuts", so keep the delay
        // just above the worst recent lateness.
        const late = Math.max(0, currentTime - when);
        this.late = Math.max(late, (this.late || 0) * 0.985);
        const want = Math.max(0.012, Math.min(0.045, this.late + 0.008));
        this.delay = want > this.delay ? want : this.delay + (want - this.delay) * 0.02;
        if (this.mode !== 'path' || this.path.length === 0) {
          this.path = [{ t: Math.min(when, currentTime) - 0.016, p: this.pos }];
          this.s1 = this.pos; this.s2 = this.pos;
          this.mode = 'path';
        }
        const last = this.path[this.path.length - 1];
        // Hand was resting: hold still until just before the new movement.
        if (when - last.t > 0.05) this.path.push({ t: when - 0.016, p: last.p });
        const t = Math.max(when, this.path[this.path.length - 1].t + 0.0005);
        this.path.push({ t, p: np });
        if (this.path.length > 512) this.path.splice(0, this.path.length - 512);
      } else if (d.type === 'motor') {
        // Release: spin up/down to a speed with a turntable-style time constant.
        this.target = Number.isFinite(d.rate) ? d.rate : 0;
        this.motorTau = Math.max(0.0005, d.tau || 0.0009);
        // Free spin: the platter leaves the hand at the fling speed.
        if (Number.isFinite(d.from)) this.rate = Math.max(-24, Math.min(24, d.from));
        this.mode = 'rate'; this.path = [];
      } else if (d.type === 'pos') {
        this.pos = d.pos * this.sourceRate;
      } else if (d.type === 'stop') {
        this.on = false;
        this.events = [];
        this.port.postMessage({ type: 'pos', pos: this.pos / this.sourceRate, rate: this.rate, session: this.session, when: currentTime, final: true });
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
    if ((!this.on && this.envelope < 0.00001) || this.ch.length === 0) {
      for (let c = 0; c < out.length; c++) out[c].fill(0);
      return true;
    }
    const n = this.ch[0].length;
    const ratio = this.sourceRate / sampleRate;
    const jump = Math.abs(this.target - this.rate);
    const reversing = this.target * this.rate < 0;
    const tau = this.motorTau > 0.0011 ? this.motorTau : reversing ? 0.002 : jump > 2 ? 0.0012 : 0.0009;
    const k = 1 - Math.exp(-1 / (tau * sampleRate));
    // Position servo constants (allocation-free, computed once per block).
    // Adaptive "mass-spring" response (turntable-style): small hand wobble is
    // smoothed, but a hard push or direction flip snaps instantly so cuts,
    // chirps and transforms keep their sharp attack like real DJ software.
    const servoSoft = 1 / (0.0045 * sampleRate);
    const servoHard = 1 / (0.0015 * sampleRate);
    const kSoft = 1 - Math.exp(-1 / (0.0012 * sampleRate));
    const kHard = 1 - Math.exp(-1 / (0.00025 * sampleRate));
    // Extrapolate the hand for well over one display frame (60 Hz = 16.7 ms).
    const maxAge = 0.04 * sampleRate;             // extrapolate hand motion ≤40 ms
    const vDecay = Math.exp(-1 / (0.09 * sampleRate)); // gentle coast after that
    const gainK = 1 - Math.exp(-1 / (0.001 * sampleRate));
    // Slower motion gate (4 ms) so passing through zero speed on a reversal
    // fades instead of chopping the signal — the chop was the audible 'tik'.
    const motionK = 1 - Math.exp(-1 / (0.004 * sampleRate));
    const pathK = 1 - Math.exp(-1 / (0.0012 * sampleRate)); // smooths speed steps between touch samples (zipper/cut noise)
    const dcPole = Math.exp(-2 * Math.PI * 5 / sampleRate);
    for (let s = 0; s < len; s++) {
      while (this.events.length && this.events[0].frame <= currentFrame + s) {
        const event = this.events.shift();
        this.target = Number.isFinite(event.rate) ? event.rate : 0;
        this.mode = 'rate';
      }
      let advanced = false;
      if (this.mode === 'path' && this.path.length) {
        const rt = (currentFrame + s) / sampleRate - this.delay;
        const P = this.path;
        while (P.length > 2 && P[1].t <= rt) P.shift();
        const a = P[0], b = P[1];
        let goal;
        if (!b || rt <= a.t) goal = a.p;
        else if (rt >= b.t) goal = b.p;
        else goal = a.p + (b.p - a.p) * (rt - a.t) / (b.t - a.t);
        // Two cascaded 0.7 ms poles round the corners between touch samples
        // (C1-continuous speed) without audible lag: no zipper, no ticks.
        this.s1 += (goal - this.s1) * pathK;
        this.s2 += (this.s1 - this.s2) * pathK;
        const np = this.s2;
        let r = (np - this.pos) / ratio;
        if (r > 24) r = 24; else if (r < -24) r = -24;
        this.rate = r;
        this.pos += r * ratio;
        advanced = true;
      } else if (this.mode === 'pos') {
        // Alpha-beta position tracker (the technique Mixxx uses for jog
        // scratching, rebuilt here per-sample): predict position from the
        // current speed, then correct both position and speed by the error.
        // Critically damped at ~45 Hz, so the record locks to the hand within
        // a few ms, reverses without overshoot and never jumps (no clicks).
        const fresh = this.age < maxAge;
        if (!fresh) this.tVel *= vDecay;
        const a = fresh ? this.age : maxAge;
        const goal = this.tPos + this.tVel * a * ratio;
        const predicted = this.pos + this.rate * ratio;
        const err = goal - predicted;
        const step = this.rate * ratio + abA * err;
        let v = this.rate * ratio + abB * err;
        let r = v / ratio;
        if (r > 24) r = 24; else if (r < -24) r = -24;
        let st = step / ratio;
        if (st > 24) st = 24; else if (st < -24) st = -24;
        this.pos += st * ratio;
        this.rate = r;
        advanced = true;
        if (!fresh && Math.abs(this.rate) < 0.001 && Math.abs(goal - this.pos) < 1) this.rate = 0;
        this.age++;
      } else {
        this.rate += (this.target - this.rate) * k;
        if (Math.abs(this.target - this.rate) < 0.0001) this.rate = this.target;
      }
      const rp = advanced ? this.pos - this.rate * ratio : this.pos;
      const i = Math.floor(rp);
      const f = rp - i;
      // A stationary platter must be silent: repeatedly outputting the same
      // sample creates a DC/buzzy tone on some Bluetooth and phone outputs.
      const slow = Math.min(1, Math.abs(this.rate) * 90);
      this.motionGain += (slow - this.motionGain) * motionK;
      this.envelope += ((this.on ? 1 : 0) - this.envelope) * gainK;
      for (let c = 0; c < out.length; c++) {
        const src = this.ch[c < this.ch.length ? c : this.ch.length - 1];
        const value = this.lagrange6(src, i, f);
        const filtered = value - (this.dcX[c] || 0) + dcPole * (this.dcY[c] || 0);
        this.dcX[c] = value; this.dcY[c] = filtered;
        out[c][s] = filtered * this.motionGain * this.envelope;
      }
      if (!advanced) this.pos += this.rate * ratio;
      if (this.pos < 0) { this.pos = 0; this.rate = 0; this.target = 0; this.tVel = 0; if (this.tPos < 0) this.tPos = 0; }
      if (this.pos > n - 2) { this.pos = n - 2; this.rate = 0; this.target = 0; this.tVel = 0; if (this.tPos > n - 2) this.tPos = n - 2; }
    }
    if (++this.frame % 2 === 0) this.port.postMessage({ type: 'pos', pos: this.pos / this.sourceRate, rate: this.rate, session: this.session, when: (currentFrame + len) / sampleRate });
    return true;
  }
}
registerProcessor('scratch-processor', ScratchProcessor);
`;

const loaded = new WeakSet<AudioContext>();

async function ensureModule(ctx: AudioContext) {
  if (loaded.has(ctx)) return;
  const url = URL.createObjectURL(new Blob([SCRATCH_PROCESSOR], { type: "application/javascript" }));
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
  private pendingRateMessage: { rate: number; when?: number } | null = null;
  private generation = 0;
  private channels = 2;
  private starting = false;
  private pendingTarget: { pos: number; vel: number } | null = null;
  private pendingPoints: { pos: number; when: number }[] = [];
  private reportedPosition: number | null = null;
  private reportedTime = 0;
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
      this.createNode(2);
    } catch {
      this.node = null;
    }
  }

  private createNode(channels: number) {
      this.node?.disconnect();
      const node = new AudioWorkletNode(this.ctx, "scratch-processor", {
        numberOfInputs: 0,
        numberOfOutputs: 1,
        outputChannelCount: [channels],
      });
      node.port.onmessage = (e: MessageEvent) => {
        const d = e.data as { type?: string; pos?: number; rate?: number; session?: number; when?: number };
        if (d.session !== this.generation) return;
        if (typeof d?.rate === "number") this.liveRate = d.rate;
        if (d?.type === "pos" && typeof d.pos === "number") {
          this.reportedPosition = d.pos;
          this.reportedTime = d.when ?? this.ctx.currentTime;
          this.onPos(d.pos, Boolean((d as { final?: boolean }).final));
        }
      };
      node.connect(this.dest);
      this.node = node;
      this.channels = channels;
      this.sent = null;
  }

  get available() {
    return !!this.node;
  }

  private send(buffer: AudioBuffer) {
    if (!this.node || this.sent === buffer) return;
    if (this.channels !== buffer.numberOfChannels) this.createNode(buffer.numberOfChannels);
    const channels: ArrayBuffer[] = [];
    const count = buffer.numberOfChannels;
    for (let c = 0; c < count; c++) {
      channels.push(buffer.getChannelData(c).slice().buffer);
    }
    this.node.port.postMessage({ type: "buffer", channels, sampleRate: buffer.sampleRate }, channels);
    this.sent = buffer;
  }

  async start(buffer: AudioBuffer, pos: number, rate = 0) {
    const generation = ++this.generation;
    this.starting = true;
    this.pendingTarget = null;
    this.pendingPoints = [];
    this.pendingRateMessage = null;
    this.pendingRate = rate;
    this.reportedPosition = pos;
    this.reportedTime = this.ctx.currentTime;
    this.liveRate = rate;
    await this.ready;
    if (!this.node || generation !== this.generation) return false;
    this.send(buffer);
    this.node.port.postMessage({ type: "start", pos, rate: this.pendingRate, session: generation });
    const pending = this.pendingRateMessage as { rate: number; when?: number } | null;
    if (pending) this.node.port.postMessage({ type: "rate", rate: pending.rate, when: pending.when });
    this.pendingRateMessage = null;
    this.starting = false;
    this.flushTarget();
    return true;
  }

  private flushTarget() {
    const target = this.pendingTarget;
    if (target) this.node?.port.postMessage({ type: "target", pos: target.pos, vel: target.vel, when: this.ctx.currentTime });
    this.pendingTarget = null;
    for (const p of this.pendingPoints) this.node?.port.postMessage({ type: "point", pos: p.pos, when: p.when });
    this.pendingPoints = [];
  }

  /**
   * Hand-trajectory scratch: `pos` is the platter position (s) at the
   * pointer event's `performance.now()` timestamp. Mapped onto the audio
   * clock so the worklet replays the exact gesture timing.
   */
  pushPoint(pos: number, eventTime: number) {
    const lag = Math.max(0, Math.min(0.1, (performance.now() - eventTime) / 1000));
    const when = this.ctx.currentTime - lag;
    if (this.starting) { this.pendingPoints.push({ pos, when }); return; }
    this.node?.port.postMessage({ type: "point", pos, when });
  }

  /** Upload the track to the worklet ahead of time so the first scratch has no hitch. */
  async prime(buffer: AudioBuffer) {
    await this.ready;
    this.send(buffer);
  }

  setRate(rate: number, when?: number) {
    this.pendingRate = rate;
    if (this.starting) { this.pendingRateMessage = { rate, when }; return; }
    this.node?.port.postMessage({ type: "rate", rate, when });
  }

  /** Position-servo scratch: absolute platter position (s) + hand velocity. */
  setTarget(pos: number, vel: number) {
    if (this.starting) { this.pendingTarget = { pos, vel }; return; }
    this.node?.port.postMessage({ type: "target", pos, vel, when: this.ctx.currentTime });
  }

  /** Motor/brake ramp toward `rate` with time constant `tau` seconds. */
  motor(rate: number, tau: number, from?: number) {
    this.node?.port.postMessage({ type: "motor", rate, tau, from });
  }

  setPos(pos: number) {
    this.node?.port.postMessage({ type: "pos", pos });
  }

  get position() {
    if (this.reportedPosition === null) return null;
    return this.reportedPosition + this.liveRate * Math.max(0, Math.min(0.02, this.ctx.currentTime - this.reportedTime));
  }

  stop() {
    ++this.generation;
    this.starting = false;
    this.pendingRate = 0;
    this.node?.port.postMessage({ type: "stop" });
  }
}
