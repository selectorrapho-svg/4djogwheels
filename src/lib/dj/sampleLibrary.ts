// Sample library: built-in packs (bundled in /public/samples) plus the user's
// own samples, which are stored on the device (IndexedDB) so they survive restarts.
import { SFX_PACK } from "@/assets/sfx";

export type Sample = { id: string; label: string; url: string; color: string; custom?: boolean };
export type SamplePack = { id: string; name: string; samples: Sample[] };

const COLORS = ["#ff2d95", "#ff3131", "#ff7a3b", "#ffd23b", "#22ff88", "#14e0ff", "#2f6bff", "#ffffff"];
const FILES: string[] = ["10-9-8.", "2Hey", "808_Clave", "808_Cowbell", "808_Kick", "808_Snare", "808_clap", "808_hat", "909_Closed_Hat", "909_Kick", "909_Open_Hat", "909_Ride", "909_Snare", "909_clap", "Ah_yeah", "Applause", "Attack", "Baby_Scratch", "Big_Ben", "Break", "Bust_dat_groove", "CarHorn", "Crowd", "DJ", "Dirty_Wub", "DrBass", "Drop", "Dub_Siren", "Filth_Wobble", "Firework", "Game_Over", "Gong", "Gunshot", "Hard_stab", "Heart_Kick", "Heavy_Bass", "Heavy_Kick", "Heavy_Snare", "Hey", "Horn", "House", "Impact1", "Impact2", "Impact3", "Incoming", "Jungle", "Laser_Saber", "Let's_go", "Let's_go_girl", "Minimal", "Mission_Complete", "Oh_yeah", "Oh_yeah_girl", "Out", "Party_sound", "Police_Siren", "Punch", "RJDJ", "Ride", "Rise1", "Rise2", "Rise3", "Siren", "Siren_Edit", "Snake_FX", "Sub_Kick", "Terminus", "Tribal", "Tribal2", "Urban", "Vador_Death", "Vibes", "Vocal_Wub", "Walk", "Walk2", "Wassup_y'all", "Whistle", "Wild", "Wobble", "Yeah", "Yo_DJ", "Zap", "dangerous_dj", "fx", "glass_break", "heywhatsap", "horn", "horn2", "madade", "ookey", "pull_up", "spindokta", "wey", "yeh"];

const isDrum = (n: string) => /(808|909|kick|snare|hat|ride|clap|punch|bass|stab|tribal|jungle|house|minimal|urban|break|walk)/i.test(n);
const isVocal = (n: string) => /(hey|yeah|yo_|let's|wassup|dj|madade|wey|yeh|ookey|pull_up|spindokta|rjdj|ah_|oh_|vibes|wild|out|10-9)/i.test(n);
const mk = (n: string, i: number): Sample => ({
  id: `b-${n}`, label: n.replace(/_/g, " ").replace(/\.$/, "").slice(0, 12),
  url: `/samples/${encodeURIComponent(n)}.ogg`, color: COLORS[i % 8],
});

const builtIn: SamplePack[] = [
  { id: "sfx", name: "SFX Horns", samples: SFX_PACK.map((s, i) => ({ id: `sfx-${i}`, ...s })) },
  { id: "drums", name: "Drums", samples: FILES.filter(isDrum).map(mk) },
  { id: "vocals", name: "Vocals", samples: FILES.filter((n) => !isDrum(n) && isVocal(n)).map(mk) },
  { id: "fx", name: "FX & Risers", samples: FILES.filter((n) => !isDrum(n) && !isVocal(n)).map(mk) },
];

let mine: Sample[] = [];
let snapshot: SamplePack[] = [...builtIn, { id: "mine", name: "My samples", samples: mine }];
const listeners = new Set<() => void>();
const publish = () => {
  snapshot = [...builtIn, { id: "mine", name: "My samples", samples: mine }];
  listeners.forEach((f) => f());
};

function db(): Promise<IDBDatabase> {
  return new Promise((res, rej) => {
    const r = indexedDB.open("djog-samples", 1);
    r.onupgradeneeded = () => r.result.createObjectStore("samples", { keyPath: "id" });
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}
async function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const d = await db();
  return new Promise<T>((res, rej) => {
    const req = fn(d.transaction("samples", mode).objectStore("samples"));
    req.onsuccess = () => { res(req.result); d.close(); };
    req.onerror = () => { rej(req.error); d.close(); };
  });
}

type Stored = { id: string; label: string; color: string; blob: Blob };
let loaded = false;

export const sampleLibrary = {
  subscribe(f: () => void) { listeners.add(f); return () => { listeners.delete(f); }; },
  snapshot: () => snapshot,
  async restore() {
    if (loaded || typeof indexedDB === "undefined") return;
    loaded = true;
    const rows = (await tx("readonly", (s) => s.getAll())) as Stored[];
    mine = rows.map((r) => ({ id: r.id, label: r.label, color: r.color, url: URL.createObjectURL(r.blob), custom: true }));
    publish();
  },
  async add(files: File[]) {
    for (const f of files) {
      const row: Stored = {
        id: `u-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        label: f.name.replace(/\.[^.]+$/, "").slice(0, 12),
        color: COLORS[mine.length % 8], blob: f,
      };
      await tx("readwrite", (s) => s.put(row));
      mine = [...mine, { id: row.id, label: row.label, color: row.color, url: URL.createObjectURL(f), custom: true }];
    }
    publish();
  },
  async remove(id: string) {
    await tx("readwrite", (s) => s.delete(id));
    const gone = mine.find((s) => s.id === id);
    if (gone) URL.revokeObjectURL(gone.url);
    mine = mine.filter((s) => s.id !== id);
    publish();
  },
};
