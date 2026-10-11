import type { Deck, Mixer } from "./engine";
import { deviceLibrary, type DeviceTrack } from "./deviceLibrary";

type State = { enabled: boolean; busy: boolean; error: string; deck: Deck; fadeSeconds: number };
const controllers = new WeakMap<Mixer, Automix>();
export function getAutomix(mixer: Mixer) {
  let controller = controllers.get(mixer);
  if (!controller) { controller = new Automix(mixer); controllers.set(mixer, controller); }
  return controller;
}

/** Browser-only controller: keeps playing when the Automix screen is closed. */
class Automix {
  private listeners = new Set<() => void>();
  private timer: number | undefined;
  private generation = 0;
  private next: { deck: Deck; track: DeviceTrack } | null = null;
  private fade: { from: Deck; to: Deck; started: number } | null = null;
  private state: State;
  constructor(private mixer: Mixer) { this.state = { enabled: false, busy: false, error: "", deck: mixer.decks.A, fadeSeconds: 8 }; }
  subscribe = (fn: () => void) => { this.listeners.add(fn); return () => { this.listeners.delete(fn); }; };
  snapshot = () => this.state;
  private update(patch: Partial<State>) { this.state = { ...this.state, ...patch }; this.listeners.forEach(fn => fn()); }
  setDuration(seconds: number) { this.update({ fadeSeconds: seconds }); }
  private async load(deck: Deck, track: DeviceTrack) {
    const file = track.file ?? await track.handle?.getFile();
    if (file) await deck.loadFile(file, track.artworkUrl ?? null);
    else await deck.loadUrl(track.url, track.title, track.artworkUrl ?? null);
  }
  async start() {
    if (this.state.enabled || this.state.busy) return;
    const token = ++this.generation;
    this.mixer.resume(); this.mixer.setFourDeck(false); this.mixer.setActivePair("AB");
    const deck = this.mixer.decks.A;
    this.update({ busy: true, error: "" });
    try {
      if (!deck.buffer && !deck.videoEl) {
        const track = deviceLibrary.snapshot().queue[0];
        if (!track) throw new Error("Add songs to the Automix queue first.");
        await this.load(deck, track);
        if (token !== this.generation) return;
        deviceLibrary.removeQueue(track);
      }
      this.mixer.decks.B.pause(); this.mixer.setCrossfade(0); deck.play();
      this.update({ enabled: true, deck });
      this.timer = window.setInterval(() => this.tick(), 40);
    } catch (error) { this.update({ error: error instanceof Error ? error.message : "Cannot start Automix." }); }
    finally { this.update({ busy: false }); }
  }
  stop() {
    ++this.generation; clearInterval(this.timer); this.timer = undefined;
    const active = this.fade?.to ?? this.state.deck;
    for (const deck of [this.mixer.decks.A, this.mixer.decks.B]) if (deck !== active) deck.pause();
    this.mixer.setCrossfade(active.id === "A" ? 0 : 1);
    this.fade = null; this.next = null; this.update({ enabled: false, busy: false, deck: active });
  }
  togglePlayback() {
    if (!this.state.enabled) { void this.start(); return; }
    if (this.state.deck.playing) { this.stop(); this.state.deck.pause(); }
    else this.state.deck.play();
  }
  skip() {
    if (!this.state.enabled || !this.next || this.fade) return;
    this.beginFade();
  }
  private beginFade() {
    if (!this.next) return;
    const from = this.state.deck, to = this.next.deck;
    if (from.bpm > 0 && to.bpm > 0) {
      const rate = from.bpm * from.rate / to.bpm;
      if (rate >= 0.84 && rate <= 1.16) to.setPitch((rate - 1) * 100);
      to.seek(Math.max(0, to.firstBeat));
    }
    to.play(); this.fade = { from, to, started: this.mixer.ctx.currentTime };
    deviceLibrary.removeQueue(this.next.track); this.next = null;
  }
  private tick() {
    if (!this.state.enabled) return;
    if (this.fade) {
      const progress = Math.min(1, (this.mixer.ctx.currentTime - this.fade.started) / this.state.fadeSeconds);
      this.mixer.setCrossfade(this.fade.from.id === "A" ? progress : 1 - progress);
      if (progress >= 1) { this.fade.from.pause(); const deck = this.fade.to; this.fade = null; this.update({ deck }); }
      return;
    }
    const deck = this.state.deck;
    if (this.next && (deck.duration - deck.currentTime) / deck.rate <= this.state.fadeSeconds) this.beginFade();
    else if (this.next && !deck.playing && deck.currentTime === 0) this.beginFade();
    else if (!this.next && !this.state.busy) {
      const track = deviceLibrary.snapshot().queue[0];
      if (!track) return;
      const target = deck.id === "A" ? this.mixer.decks.B : this.mixer.decks.A;
      const token = this.generation;
      this.update({ busy: true });
      void this.load(target, track).then(() => {
        if (token === this.generation) { target.setPitch(0); this.next = { deck: target, track }; this.update({ error: "" }); }
      }).catch(error => { if (token === this.generation) { deviceLibrary.removeQueue(track); this.update({ error: error instanceof Error ? error.message : "Cannot load next track." }); } })
        .finally(() => { if (token === this.generation) this.update({ busy: false }); });
    }
  }
}