import { Mixer, DeckPair } from "@/lib/dj/engine";
import { useActivePair } from "@/lib/dj/useMixer";
import { useSyncExternalStore } from "react";

function useFourDeck(mixer: Mixer) {
  return useSyncExternalStore(
    (l) => mixer.on(l),
    () => mixer.fourDeck,
    () => false,
  );
}

export function PairSwitcher({ mixer }: { mixer: Mixer }) {
  const pair = useActivePair(mixer);
  const four = useFourDeck(mixer);
  return (
    <div className="flex items-center gap-0.5 rounded-md border border-[#2a2a2a] bg-[#0a0a0a] p-0.5">
      {(["AB", "CD"] as DeckPair[]).map((p) => {
        const on = !four && pair === p;
        return (
          <button
            key={p}
            onClick={() => {
              if (mixer.fourDeck) mixer.setFourDeck(false);
              mixer.setActivePair(p);
            }}
            className="px-2 py-1 rounded-sm text-[10px] font-bold uppercase tracking-widest"
            style={{
              background: on ? "#ff8a3b" : "transparent",
              color: on ? "#000" : "#888",
            }}
            title={`Switch to decks ${p[0]} / ${p[1]}`}
          >
            {p[0]}·{p[1]}
          </button>
        );
      })}
      <button
        onClick={() => mixer.setFourDeck(!mixer.fourDeck)}
        className="px-2 py-1 rounded-sm text-[10px] font-bold uppercase tracking-widest"
        style={{
          background: four ? "#3bff8a" : "transparent",
          color: four ? "#000" : "#888",
        }}
        title="Show all 4 decks"
      >
        4·D
      </button>
    </div>
  );
}
