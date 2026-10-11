import { describe, expect, it } from "vitest";
import { VISUAL_PRESETS, TRANSITION_PRESETS, transitionFrame, paintVisual, visualFilter } from "./videoPresets";

describe("video preset coverage", () => {
  it("provides at least 70 executable visual presets", () => {
    expect(VISUAL_PRESETS.length).toBeGreaterThanOrEqual(70);
    expect(new Set(VISUAL_PRESETS.map(p => p.key)).size).toBe(VISUAL_PRESETS.length);
    for (const preset of VISUAL_PRESETS) {
      const commands: string[] = [];
      const ctx = new Proxy({ canvas: { width: 320, height: 180 }, globalAlpha: 1 }, { get: (o, key) => key in o ? o[key as keyof typeof o] : (..._args: unknown[]) => commands.push(String(key)), set: (o, key, value) => { Object.assign(o, { [key]: value }); return true; } }) as unknown as CanvasRenderingContext2D;
      paintVisual(ctx, { videoWidth: 320, videoHeight: 180, readyState: 2 } as HTMLVideoElement, preset, 1);
      expect(commands).toContain("drawImage");
      expect(visualFilter(preset, 1)).toBeDefined();
    }
  });
  it("provides more than 50 executable transitions", () => {
    expect(TRANSITION_PRESETS.length).toBeGreaterThan(50);
    for (const preset of TRANSITION_PRESETS) {
      let painted = false;
      const ctx = new Proxy({ canvas: { width: 320, height: 180 }, globalAlpha: 1 }, { get: (o, key) => key in o ? o[key as keyof typeof o] : () => {}, set: (o, key, value) => { Object.assign(o, { [key]: value }); return true; } }) as unknown as CanvasRenderingContext2D;
      transitionFrame(ctx, preset, 0.5, () => { painted = true; });
      expect(painted).toBe(true);
    }
  });
});