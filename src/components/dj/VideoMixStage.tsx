import { Deck } from "@/lib/dj/engine";
import { useDeck, getMixer } from "@/lib/dj/useMixer";
import { useEffect, useRef, useState } from "react";
import { useDjSettings, VideoFx, VideoTransition } from "@/hooks/useDjSettings";
import watermarkLogo from "@/assets/watermark-logo.png";
import { Move, Minimize2, Maximize2 } from "lucide-react";
import { recordingProfile } from "@/lib/dj/recording";
import { VISUAL_PRESETS, TRANSITION_PRESETS, visualFilter, paintVisual, transitionFrame } from "@/lib/dj/videoPresets";
import { EffectBrowser } from "./EffectBrowser";
import { Button } from "@/components/ui/button";

/** Canvas CSS filter string for the selected video FX. */
function fxFilter(fx: VideoFx, t: number) {
  switch (fx) {
    case "bw":
      return "grayscale(1) contrast(1.15)";
    case "invert":
      return "invert(1)";
    case "sepia":
      return "sepia(0.85) saturate(1.4)";
    case "strobe":
      return `brightness(${Math.sin(t * 14) > 0 ? 1.75 : 0.35})`;
    case "blur":
      return "blur(4px) saturate(1.3)";
    case "rgb":
      return "saturate(2.6) contrast(1.25) hue-rotate(12deg)";
    case "hue":
      return `hue-rotate(${Math.round((t * 90) % 360)}deg) saturate(1.5)`;
    default:
      return "none";
  }
}

/** Per-deck opacity + geometry for the chosen transition, from crossfader x. */
function mixFor(transition: VideoTransition, x: number) {
  const clamp = (v: number) => Math.max(0, Math.min(1, v));
  switch (transition) {
    case "cut":
      return { a: x < 0.5 ? 1 : 0, b: x < 0.5 ? 0 : 1, slide: 0, zoom: 0, flash: 0 };
    case "dip": {
      const dip = 1 - Math.abs(x - 0.5) * 2; // 1 at centre
      return { a: clamp((1 - x) * 2) * (1 - dip), b: clamp(x * 2) * (1 - dip), slide: 0, zoom: 0, flash: 0 };
    }
    case "zoom":
      return { a: clamp(1 - x * 1.35), b: clamp(x * 1.35), slide: 0, zoom: 1 - Math.abs(x - 0.5) * 2, flash: 0 };
    case "slide":
      return { a: x < 0.999 ? 1 : 0, b: clamp(x * 1.05), slide: x, zoom: 0, flash: 0 };
    case "flash":
      return { a: clamp(1 - x * 1.2), b: clamp(x * 1.2), slide: 0, zoom: 0, flash: 1 - Math.abs(x - 0.5) * 2 };
    default: // fade
      return { a: clamp(1 - x * 1.15), b: clamp(x * 1.15), slide: 0, zoom: 0, flash: 0 };
  }
}

// Master 16:9 stage. The decks' REAL video elements are kept alive off-screen and
// composited onto a canvas each frame, so scratching / looping / pitch drive the
// picture 1:1 AND the mix can be recorded as a real video file.
function MasterStage({ deckA, deckB }: { deckA: Deck; deckB: Deck }) {
  useDeck(deckA);
  useDeck(deckB);
  const hostA = useRef<HTMLDivElement>(null);
  const hostB = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const mount = (host: HTMLDivElement | null, deck: Deck) => {
      if (!host) return;
      host.innerHTML = "";
      if (deck.videoEl) {
        const v = deck.videoEl;
        v.style.width = "160px";
        v.style.height = "90px";
        v.muted = !!deck.buffer;
        v.playsInline = true;
        host.appendChild(v);
      }
    };
    mount(hostA.current, deckA);
    mount(hostB.current, deckB);
  }, [deckA, deckB, deckA.videoEl, deckB.videoEl, deckA.trackName, deckB.trackName]);

  const [wmImg, setWmImg] = useState<HTMLImageElement | null>(null);
  const [settings] = useDjSettings();
  // Keep the render loop reading fresh settings without re-creating the loop.
  const cfg = useRef(settings);
  cfg.current = settings;
  const wm = useRef<HTMLImageElement | null>(null);
  wm.current = wmImg;

  useEffect(() => {
    const img = new Image();
    img.src = watermarkLogo;
    img.onload = () => setWmImg(img);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const mixer = getMixer();
    if (mixer) mixer.videoCanvas = canvas;
    const ctx = canvas.getContext("2d", { alpha: false });
    let raf = 0;

    // Size the backing store from a cached box (measuring every frame is what
    // made the mix stutter and the audio glitch).
    let cssW = 320;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width;
      if (w) cssW = w;
    });
    ro.observe(canvas);

    const drawCover = (v: HTMLVideoElement, alpha: number, zoom: number, dx: number) => {
      if (!ctx || !v.videoWidth || alpha <= 0.001) return;
      const cw = canvas.width;
      const ch = canvas.height;
      const scale = Math.max(cw / v.videoWidth, ch / v.videoHeight) * (1 + zoom * 0.18);
      const w = v.videoWidth * scale;
      const h = v.videoHeight * scale;
      ctx.globalAlpha = Math.min(1, alpha);
      ctx.drawImage(v, (cw - w) / 2 + dx * cw, (ch - h) / 2, w, h);
      ctx.globalAlpha = 1;
    };

    // Frame-driven redraw: only composite when a deck has presented a NEW
    // decoded frame (requestVideoFrameCallback), or when an animated effect /
    // crossfader move needs it. Avoids redundant work that caused hangs.
    let dirty = true;
    let lastCross = -1;
    let lastSettings = cfg.current;
    let lastPaint = 0;
    const watched = new Map<HTMLVideoElement, number>();
    type RVFC = HTMLVideoElement & {
      requestVideoFrameCallback?: (cb: () => void) => number;
      cancelVideoFrameCallback?: (id: number) => void;
    };
    const watch = (v: HTMLVideoElement | null) => {
      if (!v || watched.has(v)) return;
      const rv = v as RVFC;
      if (!rv.requestVideoFrameCallback) return;
      const tick = () => {
        dirty = true;
        const request = rv.requestVideoFrameCallback;
        if (request) watched.set(v, request.call(v, tick));
      };
      watched.set(v, rv.requestVideoFrameCallback(tick));
    };
    const hasRvfc = typeof HTMLVideoElement !== "undefined" && "requestVideoFrameCallback" in HTMLVideoElement.prototype;

    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      if (!ctx) return;
      const s = cfg.current;
      if (s !== lastSettings) { lastSettings = s; dirty = true; }
      watch(deckA.videoEl);
      watch(deckB.videoEl);
      const cross = getMixer()?.lastCross ?? 0.5;
      const preset = VISUAL_PRESETS.find(p => p.key === s.visualPreset);
      const transition = TRANSITION_PRESETS.find(p => p.key === s.transitionPreset);
      const animated = s.videoFx === "strobe" || s.videoFx === "hue" || !!preset;
      if (cross !== lastCross) { lastCross = cross; dirty = true; }
      const mixer = getMixer();
      const profile = mixer?.recorder && mixer.recordOptions.kind === "video" ? recordingProfile(mixer.recordOptions) : null;
      if (now - lastPaint < 1000 / (profile?.fps ?? 30)) return;
      const w = profile?.width ?? Math.min(640, Math.max(240, Math.round(cssW)));
      const h = profile?.height ?? Math.round((w * 9) / 16);
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
        dirty = true;
      }
      if (hasRvfc && !dirty && !animated && !getMixer()?.recorder) return;
      dirty = false;
      lastPaint = now;

      ctx.filter = "none";
      ctx.globalCompositeOperation = "source-over";
      ctx.fillStyle = "#000";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const x = s.videoFollowCrossfader ? (getMixer()?.lastCross ?? 0.5) : 0.5;
      const m = s.videoFollowCrossfader
        ? mixFor(s.videoTransition, x)
        : { a: 1, b: 0.7, slide: 0, zoom: 0, flash: 0 };

      ctx.filter = preset ? visualFilter(preset, now / 1000) : fxFilter(s.videoFx, now / 1000);
      const paint = (video: HTMLVideoElement | null, alpha: number) => {
        if (!video) return;
        ctx.save(); ctx.globalAlpha = alpha;
        paintVisual(ctx, video, preset, now / 1000); ctx.restore();
      };
      if (transition && s.videoFollowCrossfader) {
        paint(deckA.videoEl, transition.family === "dip" ? Math.max(0, 1 - x * 2) : 1);
        transitionFrame(ctx, transition, x, () => paint(deckB.videoEl, ctx.globalAlpha));
      } else if (preset) { paint(deckA.videoEl, m.a); paint(deckB.videoEl, m.b); }
      else {
        if (deckA.videoEl) drawCover(deckA.videoEl, m.a, m.zoom, m.slide ? -m.slide : 0);
        if (deckB.videoEl) drawCover(deckB.videoEl, m.b, m.zoom, m.slide ? 1 - m.slide : 0);
      }
      ctx.filter = "none";

      if (m.flash > 0.01) {
        ctx.globalAlpha = m.flash * 0.8;
        ctx.fillStyle = "#fff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.globalAlpha = 1;
      }

      // Burn the watermark into the canvas so recordings carry it too.
      if (s.showWatermark) {
        ctx.globalAlpha = 0.8;
        const img = wm.current;
        if (s.watermarkLogo && img) {
          const wh = Math.round(canvas.height * 0.09);
          const ww = Math.round((img.width / img.height) * wh);
          ctx.drawImage(img, canvas.width - ww - 12, canvas.height - wh - 10, ww, wh);
        } else {
          const fs = Math.round(canvas.height * 0.07);
          ctx.font = `700 ${fs}px ui-sans-serif, system-ui`;
          ctx.textAlign = "right";
          ctx.fillStyle = "rgba(0,0,0,0.55)";
          ctx.fillText(s.watermarkText, canvas.width - 11, canvas.height - 11);
          ctx.fillStyle = "#fff";
          ctx.fillText(s.watermarkText, canvas.width - 12, canvas.height - 12);
          ctx.textAlign = "left";
        }
        ctx.globalAlpha = 1;
      }
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      watched.forEach((id, v) => (v as RVFC).cancelVideoFrameCallback?.(id));
      watched.clear();
      if (mixer && mixer.videoCanvas === canvas) mixer.videoCanvas = null;
    };
  }, [deckA, deckB]);

  return (
    <div
      className="relative overflow-hidden rounded-md dj-panel bg-background"
      style={{ aspectRatio: "16/9" }}
    >
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />
      {/* live video elements kept in the DOM (invisible) so frames keep decoding */}
      <div className="absolute left-0 top-0 w-[2px] h-[2px] overflow-hidden opacity-[0.01] pointer-events-none">
        <div ref={hostA} />
        <div ref={hostB} />
      </div>
      {!deckA.videoEl && !deckB.videoEl && (
        <div className="absolute inset-0 flex items-center justify-center text-[10px] uppercase tracking-widest text-muted-foreground">
          Load video to a deck
        </div>
      )}
    </div>
  );
}

export function VideoMixStage({ deckA, deckB, embedded = false }: { deckA: Deck; deckB: Deck; embedded?: boolean }) {
  const [s, setS] = useDjSettings();
  const [pos, setPos] = useState({ x: 24, y: 70 });
  const drag = useRef<{ dx: number; dy: number } | null>(null);
  const scale = s.videoScale;
  const [browser, setBrowser] = useState<"visual" | "transitions" | null>(null);
  const controls = <><div className="flex justify-center gap-1 py-1"><Button variant="secondary" className="h-7 px-2 text-[10px]" aria-label="Video transitions" onClick={() => setBrowser("transitions")}>Transitions</Button><Button variant="secondary" className="h-7 px-2 text-[10px]" aria-label="Video effects" onClick={() => setBrowser("visual")}>VFX</Button>{s.visualPreset !== "none" && <Button variant="ghost" className="h-7 px-2 text-[10px]" aria-label="Clear video effect" onClick={() => setS({ visualPreset: "none" })}>Off</Button>}</div>{browser && <EffectBrowser initialTab="Visual" transitions={browser === "transitions"} selected={browser === "transitions" ? s.transitionPreset : s.visualPreset} onVisual={visualPreset => setS({ visualPreset })} onTransition={transitionPreset => setS({ transitionPreset })} onClose={() => setBrowser(null)} />}</>;

  if (embedded || !s.floatingVideo) {
    return (
      <div className="mx-auto w-full" style={{ maxWidth: 320 * scale }}>
        <MasterStage deckA={deckA} deckB={deckB} />
        {controls}
      </div>
    );
  }

  return (
    <div
      className="fixed z-[60] select-none"
      style={{ left: pos.x, top: pos.y, width: 280 * scale, touchAction: "none" }}
    >
      <div
        className="flex items-center gap-1 px-2 py-1 rounded-t-xl dj-panel"
        onPointerDown={(e) => {
          (e.target as HTMLElement).setPointerCapture(e.pointerId);
          drag.current = { dx: e.clientX - pos.x, dy: e.clientY - pos.y };
        }}
        onPointerMove={(e) => {
          if (!drag.current || !(e.buttons & 1)) return;
          setPos({ x: e.clientX - drag.current.dx, y: e.clientY - drag.current.dy });
        }}
        onPointerUp={() => (drag.current = null)}
      >
        <Move className="w-3 h-3 text-muted-foreground" />
        <span className="text-[9px] uppercase tracking-widest text-muted-foreground">Video</span>
        <button
          className="ml-auto text-muted-foreground"
          onClick={() => setS({ videoScale: Math.max(0.6, +(scale - 0.2).toFixed(2)) })}
        >
          <Minimize2 className="w-3 h-3" />
        </button>
        <button
          className="text-muted-foreground"
          onClick={() => setS({ videoScale: Math.min(2, +(scale + 0.2).toFixed(2)) })}
        >
          <Maximize2 className="w-3 h-3" />
        </button>
      </div>
      <MasterStage deckA={deckA} deckB={deckB} />
      {controls}
    </div>
  );
}
