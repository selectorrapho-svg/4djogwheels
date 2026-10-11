import { useEffect, useRef, useState } from "react";
import { Mixer, Deck, DeckPair } from "./engine";

export function useActivePair(mixer: Mixer | null): DeckPair {
  const [, setT] = useState(0);
  useEffect(() => {
    if (!mixer) return;
    const off = mixer.on(() => setT((t) => t + 1));
    return () => { off(); };
  }, [mixer]);
  return mixer?.activePair ?? "AB";
}

let _mixer: Mixer | null = null;
export function getMixer(): Mixer | null {
  if (typeof window === "undefined") return null;
  if (!_mixer) _mixer = new Mixer();
  return _mixer;
}

export function useMixer(): Mixer | null {
  const [m, setM] = useState<Mixer | null>(null);
  useEffect(() => {
    setM(getMixer());
  }, []);
  return m;
}

export function useDeck(deck: Deck) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const off = deck.on(() => setTick((t) => t + 1));
    return () => {
      off();
    };
  }, [deck]);
  return deck;
}

export function useRaf(active: boolean) {
  const [, setTick] = useState(0);
  const raf = useRef(0);
  useEffect(() => {
    if (!active) return;
    const loop = () => {
      setTick((t) => (t + 1) % 1_000_000);
      raf.current = requestAnimationFrame(loop);
    };
    raf.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf.current);
  }, [active]);
}
