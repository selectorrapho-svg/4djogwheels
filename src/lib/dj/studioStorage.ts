import { Filesystem, Directory, Encoding } from "@capacitor/filesystem";
import { studioWav, trimClip, type StudioClip } from "./studio";

/**
 * Device project storage for Studio mode. Everything lives in the device's
 * `duigsstudio` folder (Documents directory on Android/iOS, IndexedDB-backed
 * storage in the browser preview):
 *
 *   duigsstudio/projects/<name>/project.json + clip-<id>.wav
 *   duigsstudio/recordings/<name>.wav
 */
export const STUDIO_ROOT = "duigsstudio";
const PROJECTS = `${STUDIO_ROOT}/projects`;
const RECORDINGS = `${STUDIO_ROOT}/recordings`;

async function ensureDir(path: string) {
  try {
    await Filesystem.mkdir({ path, directory: Directory.Documents, recursive: true });
  } catch {
    /* directory already exists */
  }
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "");
    reader.onerror = () => reject(reader.error ?? new Error("Could not read audio"));
    reader.readAsDataURL(blob);
  });
}

function base64ToBytes(base64: string): Uint8Array {
  const bin = atob(base64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function safeName(name: string) {
  return name.trim().replace(/[^\w .-]+/g, "_").replace(/\s+/g, " ").slice(0, 60) || "project";
}

export interface StudioProjectInfo {
  name: string;
  bpm: number;
  savedAt: number;
  clips: number;
  path: string;
}

type ClipMeta = Omit<StudioClip, "buffer" | "source"> & { file: string };

/** Save the whole arrangement (metadata + each clip's untrimmed source audio) into duigsstudio/projects. */
export async function saveStudioProject(name: string, bpm: number, clips: StudioClip[]): Promise<StudioProjectInfo> {
  const folder = safeName(name);
  const dir = `${PROJECTS}/${folder}`;
  await ensureDir(dir);
  const clipMetas: ClipMeta[] = [];
  for (const clip of clips) {
    const { buffer, source, ...meta } = clip;
    const file = `clip-${clip.id}.wav`;
    await Filesystem.writeFile({
      path: `${dir}/${file}`,
      directory: Directory.Documents,
      data: await blobToBase64(studioWav(source ?? buffer)),
      recursive: true,
    });
    clipMetas.push({ ...meta, file });
  }
  const info: StudioProjectInfo = { name: folder, bpm, savedAt: Date.now(), clips: clipMetas.length, path: `${STUDIO_ROOT}/projects/${folder}` };
  await Filesystem.writeFile({
    path: `${dir}/project.json`,
    directory: Directory.Documents,
    data: JSON.stringify({ ...info, clipMetas }),
    encoding: Encoding.UTF8,
    recursive: true,
  });
  return info;
}

export async function listStudioProjects(): Promise<StudioProjectInfo[]> {
  await ensureDir(PROJECTS);
  try {
    const listing = await Filesystem.readdir({ path: PROJECTS, directory: Directory.Documents });
    const out: StudioProjectInfo[] = [];
    for (const entry of listing.files) {
      if (entry.type !== "directory") continue;
      try {
        const raw = (await Filesystem.readFile({ path: `${PROJECTS}/${entry.name}/project.json`, directory: Directory.Documents, encoding: Encoding.UTF8 })).data as string;
        const manifest = JSON.parse(raw);
        out.push({ name: manifest.name, bpm: manifest.bpm, savedAt: manifest.savedAt, clips: manifest.clipMetas?.length ?? 0, path: `${STUDIO_ROOT}/projects/${entry.name}` });
      } catch {
        /* skip unreadable project */
      }
    }
    return out.sort((a, b) => b.savedAt - a.savedAt);
  } catch {
    return [];
  }
}

export async function loadStudioProject(name: string, ctx: BaseAudioContext): Promise<{ bpm: number; clips: StudioClip[] }> {
  const dir = `${PROJECTS}/${safeName(name)}`;
  const raw = (await Filesystem.readFile({ path: `${dir}/project.json`, directory: Directory.Documents, encoding: Encoding.UTF8 })).data as string;
  const manifest = JSON.parse(raw);
  const clips: StudioClip[] = [];
  for (const meta of manifest.clipMetas as ClipMeta[]) {
    const { file, ...rest } = meta;
    try {
      const data = (await Filesystem.readFile({ path: `${dir}/${file}`, directory: Directory.Documents })).data as string;
      const bytes = base64ToBytes(data);
      const source = await ctx.decodeAudioData(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer);
      const trimmed = trimClip({ ...rest, buffer: source } as StudioClip, rest.srcStart ?? 0, rest.srcEnd ?? source.duration);
      clips.push({ ...rest, buffer: trimmed.buffer, source });
    } catch {
      throw new Error(`Could not open audio for ${rest.name}. Your saved project has not been changed.`);
    }
  }
  return { bpm: manifest.bpm, clips };
}

export async function deleteStudioProject(name: string) {
  await Filesystem.rmdir({ path: `${PROJECTS}/${safeName(name)}`, directory: Directory.Documents, recursive: true });
}

/** Save a finished recording (mixer or Studio export) into duigsstudio/recordings. */
export async function saveRecording(name: string, data: Blob): Promise<string> {
  await ensureDir(RECORDINGS);
  const ext = data.type.includes("mpeg") ? ".mp3" : data.type.includes("ogg") ? ".ogg" : data.type.includes("mp4") ? ".mp4" : data.type.includes("webm") ? ".webm" : ".wav";
  const file = safeName(name).replace(/\.(wav|mp3|ogg|mp4|webm)$/i, "") + ext;
  await Filesystem.writeFile({ path: `${RECORDINGS}/${file}`, directory: Directory.Documents, data: await blobToBase64(data), recursive: true });
  return `${STUDIO_ROOT}/recordings/${file}`;
}
