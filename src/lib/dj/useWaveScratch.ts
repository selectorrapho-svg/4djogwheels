import { useEffect, useRef } from "react";
import { Deck } from "./engine";
import { useDjSettings } from "@/hooks/useDjSettings";

/**
 * Drag-to-scratch on a waveform surface.
 *
 * Pointer events fire at wildly different rates per device (60–1000 Hz), so
 * instead of converting each event into a rate we sample the latest pointer
 * position on a requestAnimationFrame clock. That gives one rate update per
 * displayed frame — low latency, no event flooding, and identical feel on any
 * device. Coalesced pointer events are used so fast flicks keep full travel.
 */
export function useWaveScratch(deck: Deck, axis: "x" | "y", pxPerSec: () => number) {
  const [settings] = useDjSettings();
  const slipStart = useRef<{ position: number; time: number; playing: boolean } | null>(null);
  const active = useRef(false);
  const pointerId = useRef(-1);
  const pos = useRef(0);
  const lastPos = useRef(0);
  const lastT = useRef(0);
  const rate = useRef(0);
  const trackPos = useRef(0);
  const raf = useRef(0);

  const stopLoop = () => {
    cancelAnimationFrame(raf.current);
    raf.current = 0;
  };

  const finish = () => {
    stopLoop();
    active.current = false;
    pointerId.current = -1;
    rate.current = 0;
    deck.endScratch();
    const start = slipStart.current;
    if (settings.waveSlip && start?.playing) deck.seek(Math.min(deck.duration, start.position + (performance.now() - start.time) / 1000 * deck.rate));
    slipStart.current = null;
  };

  const tick = () => {
    raf.current = requestAnimationFrame(tick);
    const now = performance.now();
    const dt = Math.min(0.05, Math.max(0.004, (now - lastT.current) / 1000));
    lastT.current = now;

    const dpx = pos.current - lastPos.current;
    lastPos.current = pos.current;
    // dragging the waveform forward (right / down) rewinds the track
    const pps = Math.max(1, pxPerSec());
    const target = -(dpx / pps) / dt;
    // Only the audio engine smooths direction changes; doing it here as well
    // makes the scratch lag the finger on fast cuts.
    rate.current = Math.max(-12, Math.min(12, target));
    if (Math.abs(rate.current) < 0.015) rate.current = 0;
    trackPos.current = Math.max(0, Math.min(deck.duration, trackPos.current - dpx / pps));
    deck.scratchTo(trackPos.current, rate.current);
  };

  useEffect(() => () => {
    stopLoop();
    if (active.current) { active.current = false; deck.endScratch(); }
  }, [deck]);

  return {
    onPointerDown: (e: React.PointerEvent) => {
      if (!deck.buffer) return;
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      const p = axis === "x" ? e.clientX : e.clientY;
      pointerId.current = e.pointerId;
      active.current = true;
      pos.current = p;
      lastPos.current = p;
      lastT.current = performance.now();
      rate.current = 0;
      slipStart.current = { position: deck.currentTime, time: performance.now(), playing: deck.playing };
      trackPos.current = deck.currentTime;
      deck.scratchStart();
      stopLoop();
      raf.current = requestAnimationFrame(tick);
    },
    onPointerMove: (e: React.PointerEvent) => {
      if (!active.current || e.pointerId !== pointerId.current) return;
      const evts = (e.nativeEvent as PointerEvent).getCoalescedEvents?.() ?? [];
      const last = evts.length ? evts[evts.length - 1] : (e.nativeEvent as PointerEvent);
      pos.current = axis === "x" ? last.clientX : last.clientY;
    },
    onPointerUp: (e: React.PointerEvent) => {
      if (!active.current || e.pointerId !== pointerId.current) return;
      // Flush the movement since the last animation frame so a fast final
      // flick is not dropped when the finger lifts.
      pos.current = axis === "x" ? e.clientX : e.clientY;
      if (raf.current) { cancelAnimationFrame(raf.current); raf.current = 0; tick(); }
      // Serato-style: letting go snaps straight back to the platter speed.
      finish();
    },
    onLostPointerCapture: () => {
      if (active.current) finish();
    },
    onPointerCancel: () => {
      if (active.current) finish();
    },
  };
}
