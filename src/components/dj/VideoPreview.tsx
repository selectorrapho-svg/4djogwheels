import { Deck } from "@/lib/dj/engine";
import { useDeck } from "@/lib/dj/useMixer";
import { useEffect, useRef } from "react";

export function VideoPreview({ deck }: { deck: Deck }) {
  useDeck(deck);
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    const video = deck.videoEl;
    if (!canvas || !video) return;
    // Share the master's decoded frame instead of running a second video decoder.
    canvas.width = 320; canvas.height = 180;
    const ctx = canvas.getContext("2d", { alpha: false });
    const sync = () => {
      if (!ctx || video.readyState < 2 || !video.videoWidth) return;
      const scale = Math.max(canvas.width / video.videoWidth, canvas.height / video.videoHeight);
      const w = video.videoWidth * scale, h = video.videoHeight * scale;
      ctx.drawImage(video, (canvas.width - w) / 2, (canvas.height - h) / 2, w, h);
    };
    const id = setInterval(sync, 1000 / 15);
    return () => clearInterval(id);
  }, [deck, deck.videoEl]);

  if (!deck.videoEl) return null;
  return (
    <canvas
      ref={ref}
      className="absolute inset-0 w-full h-full object-cover opacity-90 pointer-events-none"
    />
  );
}
