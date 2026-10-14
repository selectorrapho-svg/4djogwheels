import { describe, expect, it } from "vitest";
import { SCRATCH_PROCESSOR } from "./scratchPlayer";

function processor() {
  let Processor: any;
  const clock = { currentTime: 0, currentFrame: 0 };
  class Base { port = { onmessage: (_: any) => {}, postMessage: (_: any) => {} }; }
  const setup = new Function("AudioWorkletProcessor", "registerProcessor", "sampleRate", "clock", `with (clock) { ${SCRATCH_PROCESSOR}; return () => new ScratchProcessor(); }`);
  const create = setup(Base, (_: string, p: any) => { Processor = p; }, 48000, clock);
  expect(Processor).toBeDefined();
  const node = create();
  const message = (data: any) => node.port.onmessage({ data });
  const block = (channels = 2) => {
    const out = Array.from({ length: channels }, () => new Float32Array(128));
    node.process([], [out]); clock.currentFrame += 128; clock.currentTime = clock.currentFrame / 48000;
    return out;
  };
  return { node, message, block, clock };
}

describe("scratch audio", () => {
  it("releases sound with a ramp instead of an abrupt cut", () => {
    const { message, block } = processor();
    const signal = Float32Array.from({ length: 48000 }, (_, i) => 0.5 * Math.sin(i * 2 * Math.PI * 220 / 48000));
    message({ type: "buffer", channels: [signal.buffer] }); message({ type: "start", pos: 0.1, rate: 1 }); message({ type: "rate", rate: 1 });
    for (let i = 0; i < 20; i++) block();
    message({ type: "stop" });
    const first = block()[0];
    expect(Math.max(...first.map(Math.abs))).toBeGreaterThan(0.01);
    for (let i = 0; i < 10; i++) block();
    expect(Math.max(...block()[0].map(Math.abs))).toBeLessThan(0.00001);
  });
  it("keeps steady 60Hz platter motion audible between updates", () => {
    const { message, block, clock } = processor();
    const signal = Float32Array.from({ length: 96000 }, (_, i) => 0.4 * Math.sin(i * 2 * Math.PI * 440 / 48000));
    message({ type: "buffer", channels: [signal.buffer] }); message({ type: "start", pos: 0.4, rate: 0 });
    let position = 0.4;
    let next = 0;
    const samples: number[] = [];
    for (let i = 0; i < 180; i++) {
      if (clock.currentTime >= next) { position = 0.4 + clock.currentTime; message({ type: "target", pos: position, vel: 1 }); next += 1 / 60; }
      samples.push(...block()[0]);
    }
    for (let start = 4800; start < samples.length - 480; start += 480) {
      const rms = Math.sqrt(samples.slice(start, start + 480).reduce((sum, v) => sum + v * v, 0) / 480);
      expect(rms).toBeGreaterThan(0.1);
    }
  });
  it("preserves all eight separated stem channels", () => {
    const { message, block } = processor();
    const channels = Array.from({ length: 8 }, (_, c) => Float32Array.from({ length: 48000 }, (_, i) => (c + 1) / 16 * Math.sin(i * 0.03)).buffer);
    message({ type: "buffer", channels }); message({ type: "start", pos: 0.1, rate: 1 }); message({ type: "rate", rate: 1 });
    for (let i = 0; i < 10; i++) block(8);
    const output = block(8);
    expect(output).toHaveLength(8);
    expect(Math.abs(output[7][50])).toBeGreaterThan(Math.abs(output[0][50]) * 7);
  });
  it("applies scheduled direction changes on the audio clock", () => {
    const { node, message, block } = processor();
    message({ type: "buffer", channels: [new Float32Array(48000).buffer] });
    message({ type: "start", pos: 0.5, rate: 1 }); message({ type: "rate", rate: 1 });
    message({ type: "rate", rate: -1, when: 0.02 });
    for (let i = 0; i < 7; i++) block();
    expect(node.target).toBe(1);
    for (let i = 0; i < 3; i++) block();
    expect(node.target).toBe(-1);
  });
  it("follows a timestamped hand path exactly, including a reversal, without overshoot", () => {
    const { node, message, block, clock } = processor();
    message({ type: "buffer", channels: [new Float32Array(96000).buffer] });
    message({ type: "start", pos: 0.5, rate: 0 });
    // Hand: forward 0.2 s over 100 ms, then back 0.2 s over 100 ms (60 Hz touch samples).
    const hand = (t: number) => 0.5 + (t < 0.1 ? t * 2 : Math.max(0, 0.2 - (t - 0.1) * 2));
    let next = 0, maxPos = 0;
    for (let i = 0; i < 120; i++) {
      if (clock.currentTime >= next && next <= 0.2) { message({ type: "point", pos: hand(next), when: next }); next += 1 / 60; }
      block();
      maxPos = Math.max(maxPos, node.pos / 48000);
    }
    expect(maxPos).toBeLessThan(0.7 + 0.002);
    expect(maxPos).toBeGreaterThan(0.69);
    expect(Math.abs(node.pos / 48000 - 0.5)).toBeLessThan(0.002);
  });
});
