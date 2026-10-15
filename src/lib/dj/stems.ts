// Real AI stem separation using demucs-rs (Apache-2.0, HTDemucs v4) compiled
// to WebAssembly + WebGPU. Runs in a background worker; the deck keeps its
// frequency-band stems until the separated stems are ready. Pro feature only.
import wasmAsset from "@/assets/wasm/demucs_wasm_bg.wasm.asset.json";
import modelAsset from "@/assets/models/htdemucs.safetensors.asset.json";
import { isPro } from "@/lib/dj/license";
import type { StemKey } from "./engine";

const MODEL_ID = "htdemucs";
// Bundled with the app; Hugging Face is only a fallback.
const FALLBACK_MODEL_URL = "https://huggingface.co/set-soft/audio_separation/resolve/main/Demucs/htdemucs.safetensors";
const DB = "demucs-models";
const STORE = "weights";

export type StemResult = { stems: Record<StemKey, [Float32Array, Float32Array]>; sampleRate: number };

let worker: Worker | null = null;
let ready: Promise<void> | null = null;
let seq = 0;
const pending = new Map<number, { res: (v: any) => void; rej: (e: Error) => void }>();
let queue: Promise<unknown> = Promise.resolve();
let modelBytes: Promise<Uint8Array> | null = null;

export function stemsSupported() {
  return typeof window !== "undefined" && typeof Worker !== "undefined" && "gpu" in navigator;
}

function send(type: string, data: Record<string, unknown>, transfer: Transferable[] = []) {
  const id = ++seq;
  return new Promise<any>((res, rej) => {
    pending.set(id, { res, rej });
    if (!worker) { pending.delete(id); rej(new Error("Stem worker unavailable")); return; }
    worker.postMessage({ type, id, ...data }, transfer);
  });
}

function ensureWorker() {
  if (ready) return ready;
  worker = new Worker("/wasm/demucs/worker.js");
  worker.onmessage = (e) => {
    const { id, type, error } = e.data;
    if (type === "progress") return;
    const p = pending.get(id);
    if (!p) return;
    pending.delete(id);
    if (type === "error") p.rej(new Error(error));
    else p.res(e.data);
  };
  const wasmUrl = new URL(wasmAsset.url, location.href).href;
  ready = send("init", { wasmUrl }).then(() => undefined);
  ready.catch(() => { ready = null; });
  return ready;
}

function idb(): Promise<IDBDatabase> {
  return new Promise((res, rej) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(STORE);
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}

async function loadModel(): Promise<Uint8Array> {
  const db = await idb();
  const cached = await new Promise<ArrayBuffer | undefined>((res) => {
    const q = db.transaction(STORE).objectStore(STORE).get(MODEL_ID);
    q.onsuccess = () => res(q.result);
    q.onerror = () => res(undefined);
  });
  if (cached) return new Uint8Array(cached);
  let r = await fetch(modelAsset.url).catch(() => null);
  if (!r?.ok) r = await fetch(FALLBACK_MODEL_URL);
  if (!r.ok) throw new Error(`Model download failed (${r.status})`);
  const buf = await r.arrayBuffer();
  db.transaction(STORE, "readwrite").objectStore(STORE).put(buf, MODEL_ID);
  return new Uint8Array(buf);
}

/** Separate a decoded track into drums/bass/other/vocals. Resolves null when unsupported. */
export function separateStems(buffer: AudioBuffer): Promise<StemResult | null> {
  if (!stemsSupported() || !isPro() || buffer.numberOfChannels > 2) return Promise.resolve(null);
  const job = queue.then(async () => {
    await ensureWorker();
    modelBytes ??= loadModel().catch((e) => { modelBytes = null; throw e; });
    const bytes = await modelBytes;
    const left = buffer.getChannelData(0).slice();
    const right = (buffer.numberOfChannels > 1 ? buffer.getChannelData(1) : buffer.getChannelData(0)).slice();
    const out = await send("separate", {
      modelBytes: bytes.slice(), modelId: MODEL_ID,
      stems: ["drums", "bass", "other", "vocals"],
      left, right, sampleRate: buffer.sampleRate,
    }, [left.buffer, right.buffer]);
    const audio: Float32Array = out.audio;
    const n: number = out.nSamples;
    const names: string[] = out.stemNames;
    const stems = {} as StemResult["stems"];
    names.forEach((name, i) => {
      const base = i * 2 * n;
      stems[name as StemKey] = [audio.subarray(base, base + n), audio.subarray(base + n, base + 2 * n)];
    });
    if (!stems.drums || !stems.bass || !stems.other || !stems.vocals) return null;
    return { stems, sampleRate: buffer.sampleRate };
  });
  queue = job.catch(() => null);
  return job;
}
