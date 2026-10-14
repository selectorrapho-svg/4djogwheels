import type { Deck } from "@/lib/dj/engine";

export function WaveAnalysisStatus({ deck }: { deck: Deck }) {
  if (!deck.analyzing) return null;
  return <div className="wave-analysis" role="status"><span>Analyzing waveform · {Math.round(deck.analysisProgress * 100)}%</span><progress value={deck.analysisProgress} max={1} aria-label="Waveform analysis" /></div>;
}