export type VisualFamily = "color" | "mirror" | "tiles" | "kaleidoscope" | "zoom" | "rotate" | "crt" | "strobe" | "wave";
export type TransitionFamily = "fade" | "wipe" | "slide" | "zoom" | "iris" | "blinds" | "dip";
export interface VisualPreset { key: string; label: string; category: string; family: VisualFamily; amount: number; variant: number }
export interface TransitionPreset { key: string; label: string; category: string; family: TransitionFamily; variant: number; amount: number }
const visuals: [VisualFamily, string, string][] = [
  ["color", "Color", "Color grade"], ["mirror", "Mirror", "Geometry"], ["tiles", "Grid", "Geometry"],
  ["kaleidoscope", "Kaleidoscope", "Geometry"], ["zoom", "Pulse zoom", "Motion"], ["rotate", "Spin", "Motion"],
  ["crt", "TV / CRT", "Analog"], ["strobe", "Beat flash", "Light"], ["wave", "Wave distortion", "Distortion"],
];
export const VISUAL_PRESETS: VisualPreset[] = visuals.flatMap(([family, label, category]) =>
  Array.from({ length: 8 }, (_, variant) => ({ key: `${family}-${variant}`, label: `${label} ${variant + 1}`, category, family, variant, amount: (variant + 1) / 8 })),
);
const transitions: [TransitionFamily, string][] = [["fade", "Dissolve"], ["wipe", "Wipe"], ["slide", "Slide"], ["zoom", "Zoom"], ["iris", "Iris"], ["blinds", "Blinds"], ["dip", "Dip"]];
export const TRANSITION_PRESETS: TransitionPreset[] = transitions.flatMap(([family, label]) =>
  Array.from({ length: 8 }, (_, variant) => ({ key: `${family}-${variant}`, label: `${label} ${variant + 1}`, category: label, family, variant, amount: (variant + 1) / 8 })),
);
export function visualFilter(p: VisualPreset | undefined, time: number) {
  if (!p) return "none";
  if (p.family === "color") return ["grayscale(1)", "sepia(1)", "invert(1)", "saturate(2.5)", "contrast(1.8)", "hue-rotate(90deg)", "hue-rotate(180deg)", "brightness(1.25) saturate(0.5)"][p.variant];
  if (p.family === "crt") return `contrast(${1.15 + p.amount * 0.5}) saturate(${0.6 + p.amount})`;
  if (p.family === "strobe") return `brightness(${Math.sin(time * (2 + p.variant * 2)) > 0 ? 1 + p.amount : 0.65})`;
  return "none";
}

/** Paint a real decoded frame with bounded geometry work; no per-pixel reads. */
export function paintVisual(ctx: CanvasRenderingContext2D, video: HTMLVideoElement, p: VisualPreset | undefined, time: number) {
  const w = ctx.canvas.width, h = ctx.canvas.height;
  if (!video.videoWidth || video.readyState < 2) return;
  const cover = () => {
    const scale = Math.max(w / video.videoWidth, h / video.videoHeight);
    const vw = video.videoWidth * scale, vh = video.videoHeight * scale;
    ctx.drawImage(video, (w - vw) / 2, (h - vh) / 2, vw, vh);
  };
  ctx.save();
  if (p?.family === "zoom" || p?.family === "rotate") {
    ctx.translate(w / 2, h / 2);
    if (p.family === "rotate") ctx.rotate(Math.sin(time * (0.2 + p.amount)) * p.amount);
    const scale = 1.2 + Math.sin(time * (1 + p.amount)) * p.amount * 0.18;
    ctx.scale(scale, scale); ctx.translate(-w / 2, -h / 2); cover();
  } else if (p?.family === "mirror") {
    if (p.variant % 2) { ctx.translate(w, 0); ctx.scale(-1, 1); }
    if (p.variant % 3 === 0) { ctx.translate(0, h); ctx.scale(1, -1); }
    cover();
    ctx.globalAlpha *= 0.25 + p.amount * 0.4; ctx.translate(w, 0); ctx.scale(-1, 1); cover();
  } else if (p?.family === "tiles") {
    const n = 2 + p.variant;
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) ctx.drawImage(video, x * w / n, y * h / n, w / n, h / n);
  } else if (p?.family === "kaleidoscope") {
    const n = 3 + p.variant; ctx.translate(w / 2, h / 2);
    for (let i = 0; i < n; i++) {
      ctx.save(); ctx.rotate(i * Math.PI * 2 / n + time * 0.08); ctx.beginPath(); ctx.moveTo(0, 0);
      ctx.arc(0, 0, Math.hypot(w, h), 0, Math.PI * 2 / n); ctx.closePath(); ctx.clip();
      ctx.drawImage(video, -w / 2, -h / 2, w, h); ctx.restore();
    }
  } else if (p?.family === "wave") {
    const n = 24;
    for (let i = 0; i < n; i++) {
      const shift = Math.sin(i * (0.3 + p.amount) + time * (1 + p.variant)) * w * 0.04 * p.amount;
      ctx.drawImage(video, 0, i * video.videoHeight / n, video.videoWidth, video.videoHeight / n, shift, i * h / n, w, h / n + 1);
    }
  } else cover();
  if (p?.family === "crt") {
    ctx.fillStyle = "rgba(0,0,0,0.3)";
    for (let y = 0; y < h; y += 3 + p.variant) ctx.fillRect(0, y, w, 1);
    ctx.fillRect(0, (time * (20 + p.variant * 10)) % h, w, 2 + p.variant);
  }
  ctx.restore();
}

/** Clip/transform the incoming frame as the crossfader moves. */
export function transitionFrame(ctx: CanvasRenderingContext2D, p: TransitionPreset, x: number, paint: () => void) {
  const w = ctx.canvas.width, h = ctx.canvas.height;
  const t = Math.max(0, Math.min(1, x));
  ctx.save();
  if (p.family === "fade") ctx.globalAlpha *= Math.pow(t, 0.5 + p.amount * 2);
  else if (p.family === "dip") ctx.globalAlpha *= Math.max(0, (t - 0.5) * 2);
  else if (p.family === "zoom") {
    ctx.globalAlpha *= t; ctx.translate(w / 2, h / 2); const scale = 0.05 + t * (0.95 + p.amount * (1 - t)); ctx.scale(scale, scale); ctx.rotate((1 - t) * (p.variant - 3) * 0.12); ctx.translate(-w / 2, -h / 2);
  } else if (p.family === "slide") {
    const direction = p.variant % 4;
    ctx.translate(direction < 2 ? (1 - t) * w * (direction === 0 ? 1 : -1) : 0, direction >= 2 ? (1 - t) * h * (direction === 2 ? 1 : -1) : 0);
  } else {
    ctx.beginPath();
    if (p.family === "iris") ctx.ellipse(w / 2, h / 2, Math.hypot(w, h) * t / 2, Math.hypot(w, h) * t / 2 * (0.5 + p.amount), p.variant * Math.PI / 8, 0, Math.PI * 2);
    else if (p.family === "blinds") {
      const n = p.variant + 3;
      for (let i = 0; i < n; i++) p.variant % 2 ? ctx.rect(0, i * h / n, w, h / n * t) : ctx.rect(i * w / n, 0, w / n * t, h);
    } else {
      const direction = p.variant % 4;
      if (direction < 2) ctx.rect(direction === 0 ? 0 : w * (1 - t), 0, w * t, h);
      else ctx.rect(0, direction === 2 ? 0 : h * (1 - t), w, h * t);
      if (p.variant >= 4) { ctx.rect(w / 2 - w * t / 2, h / 2 - h * t / 2, w * t, h * t); }
    }
    ctx.clip();
  }
  paint(); ctx.restore();
}