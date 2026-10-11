import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { FolderOpen, Music2, Search, X, ChevronDown, MoreHorizontal, ListPlus, ListMusic, Play, Film, LoaderCircle, ArrowDownWideNarrow } from 'lucide-react';
import { Deck, Mixer } from '@/lib/dj/engine';
import { deviceLibrary, type DeviceTrack } from '@/lib/dj/deviceLibrary';
import { Portal } from './Portal';
import { Button } from '@/components/ui/button';

const allDecks = ['A', 'B', 'C', 'D'] as const;
const empty = { tracks: [], queue: [], playlists: {} };
export function TrackLibraryOverlay({ open, onClose, deck, mixer }: { open: boolean; onClose: () => void; deck?: Deck; mixer?: Mixer }) {
  const [query, setQuery] = useState('');
  const [tab, setTab] = useState<'Songs' | 'Videos' | 'Files' | 'Queue' | 'Playlists'>('Songs');
  const [sort, setSort] = useState('title-asc');
  const [menu, setMenu] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState('');
  const [limit, setLimit] = useState(60);
  const [preview, setPreview] = useState<HTMLAudioElement | null>(null);
  const files = useRef<HTMLInputElement>(null);
  const library = useSyncExternalStore(deviceLibrary.subscribe, deviceLibrary.snapshot, () => empty);
  useEffect(() => { if (open) void deviceLibrary.restore().catch(() => {}); }, [open]);
  useEffect(() => () => { preview?.pause(); }, [preview]);
  if (!open) return null;
  const rows = tab === 'Files' ? library.tracks.filter(t => t.file || t.handle || t.native) : tab === 'Queue' ? library.queue : tab === 'Playlists'
    ? Object.values(library.playlists).flat() : library.tracks.filter(t => tab === 'Videos' ? t.kind === 'video' : t.kind !== 'video');
  const visible = rows.filter(t => `${t.title} ${t.filename}`.toLowerCase().includes(query.toLowerCase())).slice();
  if (sort !== 'original') visible.sort((a, b) => sort === 'title-desc' ? b.title.localeCompare(a.title, undefined, { numeric: true }) : sort === 'type' ? (a.kind ?? 'audio').localeCompare(b.kind ?? 'audio') || a.title.localeCompare(b.title) : a.title.localeCompare(b.title, undefined, { numeric: true }));
  const acquire = async (track: DeviceTrack) => track.file ?? track.handle?.getFile();
  const load = async (track: DeviceTrack, id?: typeof allDecks[number]) => {
    const destination = id && mixer ? mixer.decks[id] : deck;
    if (!destination) return;
    setLoading(`${track.filename}-${id ?? destination.id}`); setError('');
    try {
      mixer?.resume();
      const file = await acquire(track);
      if (file) await destination.loadFile(file, track.artworkUrl ?? null);
      else await destination.loadUrl(track.url, track.title, track.artworkUrl ?? null);
      onClose();
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not load this track.'); }
    finally { setLoading(''); }
  };
  const scan = async () => {
    setBusy(true); setError('');
    try {
      if (!(await deviceLibrary.openDirectory())) files.current?.click();
    } catch (e) { if (e instanceof Error && e.name !== 'AbortError') setError('Folder access was not granted. Choose files instead.'); }
    finally { setBusy(false); }
  };
  const addPlaylist = (items: DeviceTrack[]) => {
    const name = window.prompt('Playlist name');
    if (name?.trim()) deviceLibrary.addPlaylist(name.trim(), items);
    setMenu(null);
  };
  const previewTrack = async (track: DeviceTrack) => {
    preview?.pause();
    const file = await acquire(track);
    const url = file ? URL.createObjectURL(file) : track.url;
    const audio = new Audio(url);
    audio.onended = () => { if (file) URL.revokeObjectURL(url); };
    await audio.play(); setPreview(audio);
  };
  return <Portal><div className="fixed inset-0 z-[300] bg-background text-foreground" style={{ height: '100dvh' }}>
    <section className="flex h-full flex-col overflow-hidden bg-background">
      <header className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 border-b border-border bg-secondary px-4 py-3">
        <button className="text-primary" onClick={onClose} aria-label="Close library"><X className="size-6" /></button>
        <h2 className="truncate text-center text-lg font-semibold">{tab === 'Songs' ? 'Music' : tab}</h2>
        <button className="text-primary" onClick={scan} aria-label="Browse device music and videos" title="Browse device music and videos"><FolderOpen className="size-6" /></button>
      </header>
      <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
        <div className="flex min-w-0 items-center gap-2 text-lg">{visible.length} {tab} <ChevronDown className="size-4 text-muted-foreground" /></div>
        <div className="relative shrink-0"><button className="text-primary" onClick={() => setMenu(menu === 'all' ? null : 'all')} aria-label="All tracks menu"><MoreHorizontal className="size-6" /></button>
          {menu === 'all' && <div className="absolute right-0 top-8 z-30 w-56 rounded-md bg-popover p-1 shadow-lg border border-border">
            <button className="block w-full px-3 py-3 text-left" onClick={() => { deviceLibrary.addAllQueue(visible); setMenu(null); }}>Add All to Queue</button>
            <button className="block w-full px-3 py-3 text-left border-t border-border" onClick={() => addPlaylist(visible)}>Add All to Playlist…</button>
            <button className="block w-full px-3 py-3 text-left border-t border-border" onClick={() => { setMenu(null); setError('Track analysis runs when a song is loaded to a deck.'); }}>Analyze Songs</button>
          </div>}
        </div>
      </div>
      <div className="flex gap-4 overflow-x-auto border-b border-border px-4 text-sm">
        {(['Songs','Videos','Files','Queue','Playlists'] as const).map(t => <button key={t} className={`shrink-0 border-b-2 px-1 py-3 ${tab === t ? 'border-primary text-primary' : 'border-transparent text-muted-foreground'}`} onClick={() => { setTab(t); setMenu(null); setLimit(60); }}>{t}</button>)}
      </div>
      <div className="flex gap-2 mx-4 mt-3"><label className="flex flex-1 h-10 shrink-0 items-center gap-2 rounded-md bg-secondary px-3 text-muted-foreground"><Search className="size-4" /><input className="min-w-0 flex-1 bg-transparent outline-none text-foreground" value={query} onChange={e => setQuery(e.target.value)} placeholder="Search tracks" aria-label="Search tracks" /></label><label className="flex items-center gap-1 bg-secondary px-2 rounded-md text-xs"><ArrowDownWideNarrow className="size-4" /><select aria-label="Sort tracks" className="bg-secondary text-foreground max-w-28 h-10" value={sort} onChange={e => setSort(e.target.value)}><option value="title-asc">Name A–Z</option><option value="title-desc">Name Z–A</option><option value="type">File type</option><option value="added">Added</option><option value="original">Original order</option></select></label></div>
      {error && <p role="status" className="px-4 py-2 text-sm text-primary">{error}</p>}
      <div className="min-h-0 flex-1 overflow-y-auto py-3">
        {visible.slice(0, limit).map((track, index) => <div key={`${track.filename}-${index}`} className="grid grid-cols-[3.5rem_minmax(0,1fr)_auto] items-center gap-3 border-b border-border/60 px-4 py-2">
          <div className="grid size-14 place-items-center overflow-hidden rounded-md bg-secondary text-muted-foreground/40">{track.artworkUrl ? <img src={track.artworkUrl} alt="" loading="lazy" decoding="async" onError={e => { e.currentTarget.style.display = 'none'; }} className="size-full object-cover" /> : track.kind === 'video' ? <Film className="size-5" /> : null}</div>
          <button className="min-w-0 text-left" onClick={() => load(track, mixer ? mixer.activeDecks().left.id : undefined)}><span className="block truncate text-sm font-semibold">{track.title}</span><span className="block truncate text-xs text-muted-foreground">{track.file || track.handle || track.native ? 'This device' : 'MixrdjsPro library'}</span></button>
          <div className="relative"><button className="grid size-9 place-items-center rounded-full bg-secondary" aria-label={`Options for ${track.title}`} onClick={() => setMenu(menu === track.filename ? null : track.filename)}><MoreHorizontal className="size-5" /></button>
            {menu === track.filename && <div className="absolute right-0 top-9 z-20 w-52 rounded-md border border-border bg-popover p-1 shadow-lg text-sm">
              <div className="px-3 py-2 text-xs text-muted-foreground">Load to deck</div>
              <div className="grid grid-cols-4 gap-1 px-2 pb-2">{(mixer ? allDecks : [deck?.id ?? 'A']).map(id => <button key={id} className="rounded bg-secondary py-2 text-primary" disabled={!!loading} onClick={() => load(track, id as typeof allDecks[number])}>{loading === `${track.filename}-${id}` ? '…' : id}</button>)}</div>
              <button className="flex w-full items-center gap-2 border-t border-border px-3 py-2" onClick={() => { deviceLibrary.addQueue(track); setMenu(null); }}><ListPlus className="size-4" />Add to Queue</button>
              <button className="flex w-full items-center gap-2 px-3 py-2" onClick={() => addPlaylist([track])}><ListMusic className="size-4" />Add to Playlist…</button>
              <button className="flex w-full items-center gap-2 px-3 py-2" onClick={() => { void previewTrack(track).catch(() => setError('Preview unavailable for this track.')); setMenu(null); }}><Play className="size-4" />Preview</button>
            </div>}
          </div>
        </div>)}
        {visible.length > limit && <div ref={el => { if (!el) return; const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { io.disconnect(); setLimit(l => l + 60); } }); io.observe(el); }} className="py-4 text-center text-xs text-muted-foreground">Loading more…</div>}
        {!visible.length && <p className="px-4 py-8 text-center text-sm text-muted-foreground">No tracks here yet. Open a music folder or choose files.</p>}
      </div>
      <footer className="flex items-center justify-between border-t border-border bg-secondary px-4 py-3 text-xs text-muted-foreground"><span>{busy ? <LoaderCircle className="size-4 animate-spin" /> : `${visible.length} tracks`}</span><button className="flex items-center gap-2 text-primary" onClick={scan}><FolderOpen className="size-4" />Browse device</button></footer>
      <input ref={files} type="file" accept="audio/*,video/*,.mp3,.aac,.m4a,.wav,.flac,.ogg,.mp4,.webm,.mov" multiple className="hidden" onChange={e => { void deviceLibrary.addFiles(Array.from(e.target.files ?? [])); e.target.value = ''; }} />
    </section>
  </div></Portal>;
}
