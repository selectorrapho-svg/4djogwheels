import { LIBRARY, type LibraryTrack } from '@/assets/library';
import { readAlbumArt } from './albumArt';

export type DeviceTrack = LibraryTrack & { file?: File; handle?: FileSystemFileHandle; kind?: 'audio' | 'video'; native?: boolean; artworkUrl?: string | null };
type DirectoryPicker = () => Promise<FileSystemDirectoryHandle>;
const CACHE_KEY = 'mixrdjspro-library-directory';
let tracks: DeviceTrack[] = [...LIBRARY];
let queue: DeviceTrack[] = [];
let playlists: Record<string, DeviceTrack[]> = {};
const listeners = new Set<() => void>();
let current = { tracks, queue, playlists };
const publish = () => { current = { tracks, queue, playlists }; listeners.forEach(fn => fn()); };
export const deviceLibrary = {
  subscribe(fn: () => void) { listeners.add(fn); return () => { listeners.delete(fn); }; },
  snapshot() { return current; },
  async addFiles(files: File[]) {
    const next: DeviceTrack[] = files.filter(f => f.type.startsWith('audio/') || f.type.startsWith('video/') || /\.(mp3|aac|m4a|wav|flac|ogg|mp4|webm|mov)$/i.test(f.name))
      .map(f => ({ title: f.name.replace(/\.[^.]+$/, ''), filename: f.name, url: '', file: f, kind: f.type.startsWith('video/') || /\.(mp4|webm|mov)$/i.test(f.name) ? 'video' as const : 'audio' as const, artworkUrl: null }));
    tracks = [...next, ...tracks.filter(t => !next.some(n => n.filename === t.filename && t.file))]; publish();
    queueArtwork(next);
  },
  /** Android app: ask permission once, then list every song/video on the phone. */
  async scanNative() {
    const cap = (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean; convertFileSrc?: (u: string) => string; Plugins?: { NativeMedia?: { scan(): Promise<{ items: { uri: string; title: string; filename: string; artworkUri?: string; kind: 'audio' | 'video' }[] }> } } } }).Capacitor;
    const media = cap?.isNativePlatform?.() ? cap.Plugins?.NativeMedia : undefined;
    if (!media) return false;
    const { items } = await media.scan();
    const found: DeviceTrack[] = items.map(i => ({ title: i.title, filename: i.filename || i.uri, url: cap?.convertFileSrc ? cap.convertFileSrc(i.uri) : i.uri, artworkUrl: i.artworkUri && cap?.convertFileSrc ? cap.convertFileSrc(i.artworkUri) : i.artworkUri, kind: i.kind, native: true }));
    tracks = [...found, ...tracks.filter(t => !t.native)]; publish();
    return true;
  },
  async openDirectory() {
    if (await this.scanNative()) return true;
    const picker = (window as Window & { showDirectoryPicker?: DirectoryPicker }).showDirectoryPicker;
    if (!picker) return false;
    const handle = await picker();
    await saveHandle(handle);
    await this.scan(handle);
    return true;
  },
  async restore() {
    if (await this.scanNative().catch(() => false)) return;
    const handle = await readHandle();
    if (!handle) return;
    const query = (handle as FileSystemDirectoryHandle & { queryPermission?: (o: { mode: 'read' }) => Promise<PermissionState> }).queryPermission;
    const permission = query ? await query.call(handle, { mode: 'read' }) : 'prompt';
    if (permission === 'granted') await this.scan(handle);
  },
  async scan(handle: FileSystemDirectoryHandle) {
    const found: DeviceTrack[] = [];
    async function visit(dir: FileSystemDirectoryHandle) {
      for await (const item of dir.values()) {
        if (item.kind === 'directory') { await visit(item); continue; }
        if (!/\.(mp3|aac|m4a|wav|flac|ogg|mp4|webm|mov)$/i.test(item.name)) continue;
        found.push({ title: item.name.replace(/\.[^.]+$/, ''), filename: item.name, url: '', handle: item, kind: /\.(mp4|webm|mov)$/i.test(item.name) ? 'video' : 'audio', artworkUrl: null });
        // Show the list early while large folders are still being walked.
        if (found.length % 200 === 0) { tracks = [...found, ...tracks.filter(t => !t.handle)]; publish(); await idle(); }
      }
    }
    await visit(handle);
    tracks = [...found, ...tracks.filter(t => !t.handle)]; publish();
    queueArtwork(found);
  },
  addQueue(track: DeviceTrack) { queue = [...queue, track]; publish(); },
  addAllQueue(items: DeviceTrack[]) { queue = [...queue, ...items]; publish(); },
  addPlaylist(name: string, items: DeviceTrack[]) { playlists = { ...playlists, [name]: [...(playlists[name] ?? []), ...items] }; publish(); },
};

// Album art is read a couple of files at a time in idle moments so big
// libraries never freeze the UI. Tracks without art simply stay blank.
const idle = () => new Promise<void>(r => {
  const ric = (globalThis as { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number }).requestIdleCallback;
  if (ric) ric(() => r(), { timeout: 200 }); else setTimeout(r, 16);
});
let artQueue: DeviceTrack[] = [];
let artRunning = false;
function queueArtwork(items: DeviceTrack[]) {
  artQueue.push(...items.filter(t => t.kind !== 'video' && !t.artworkUrl));
  if (artRunning) return;
  artRunning = true;
  void (async () => {
    let changed = 0;
    while (artQueue.length) {
      const batch = artQueue.splice(0, 2);
      await Promise.all(batch.map(async t => {
        try {
          const file = t.file ?? (t.handle ? await t.handle.getFile() : undefined);
          if (file && file.size < 60 * 1024 * 1024) t.artworkUrl = await readAlbumArt(file);
          if (t.artworkUrl) changed++;
        } catch { /* leave blank */ }
      }));
      if (changed >= 12 || !artQueue.length) { if (changed) publish(); changed = 0; }
      await idle();
    }
    artRunning = false;
  })();
}

// Store only a directory handle, not the user's actual media files.
function db(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(CACHE_KEY, 1);
    request.onupgradeneeded = () => request.result.createObjectStore('access');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
async function saveHandle(handle: FileSystemDirectoryHandle) {
  const database = await db();
  await new Promise<void>((resolve, reject) => {
    const tx = database.transaction('access', 'readwrite');
    tx.objectStore('access').put(handle, 'directory');
    tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error);
  });
  database.close();
}
async function readHandle(): Promise<FileSystemDirectoryHandle | null> {
  const database = await db();
  const handle = await new Promise<FileSystemDirectoryHandle | null>((resolve, reject) => {
    const request = database.transaction('access').objectStore('access').get('directory');
    request.onsuccess = () => resolve(request.result ?? null);
    request.onerror = () => reject(request.error);
  });
  database.close(); return handle;
}
