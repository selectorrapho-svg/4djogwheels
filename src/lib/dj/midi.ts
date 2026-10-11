/**
 * Web MIDI hardware controller support.
 *
 * Works with any class-compliant DJ controller (Pioneer DDJ / XDJ, Numark
 * Mixtrack / Party Mix, Denon MC / Prime, Hercules, Reloop, Traktor Kontrol …).
 * A generic, channel-per-deck mapping is used: MIDI channel 1 → deck A,
 * channel 2 → deck B, channel 3 → C, channel 4 → D.
 *
 *  Notes  : 0-7 hot cues · 11 play/pause · 12 cue · 13 sync · 14 loop toggle
 *  CC     : 8 volume · 9 pitch · 10/11/12 EQ low/mid/high · 34 jog (relative)
 *           63 crossfader (any channel)
 */
import type { Deck, DeckId, Mixer } from "./engine";

export interface MidiInfo {
  supported: boolean;
  connected: string[];
}

type Sub = (info: MidiInfo) => void;

let info: MidiInfo = { supported: false, connected: [] };
const subs = new Set<Sub>();
let mixerRef: Mixer | null = null;
let access: MIDIAccess | null = null;

function emit() {
  subs.forEach((s) => s(info));
}

export function subscribeMidi(fn: Sub) {
  subs.add(fn);
  fn(info);
  return () => subs.delete(fn);
}

export function getMidiInfo() {
  return info;
}

const DECKS: DeckId[] = ["A", "B", "C", "D"];

function deckFor(channel: number): Deck | null {
  if (!mixerRef) return null;
  const id = DECKS[channel] ?? "A";
  return mixerRef.decks[id];
}

const jogLast: Record<string, number> = {};
const jogTouch: Record<string, boolean> = {};

/** Device families we ship a factory mapping for. */
export type Vendor = "pioneer" | "generic";

function vendorOf(name: string): Vendor {
  const n = name.toLowerCase();
  if (/ddj|xdj|pioneer|alphatheta|rekordbox/.test(n)) return "pioneer";
  return "generic";
}

function hotCue(deck: Deck, i: number) {
  const cue = deck.hotCues[i];
  if (cue) deck.seek(cue.time);
  else deck.hotCues[i] = { index: i, time: deck.currentTime };
}

function jog(deck: Deck, key: string, value: number, scale: number) {
  const delta = value - 64;
  const now = performance.now();
  const prev = jogLast[key] ?? 0;
  jogLast[key] = now;
  if (delta === 0 && !jogTouch[key]) {
    deck.endScratch();
    return;
  }
  if (now - prev > 400 && !jogTouch[key]) deck.scratchStart();
  deck.scratch(Math.max(-10, Math.min(10, delta / scale)));
}

/**
 * Pioneer DDJ / XDJ (rekordbox HID-less MIDI mode, e.g. DDJ-400 / DDJ-FLX4 /
 * DDJ-SB3 / XDJ-RX). Deck 1 = MIDI ch 1, deck 2 = ch 2, performance-pad banks
 * arrive on ch 8/9.
 */
function handlePioneer(data: Uint8Array) {
  if (!mixerRef) return;
  const status = data[0];
  const ch = status & 0x0f;
  const kind = status & 0xf0;
  const d1 = data[1];
  const d2 = data[2];
  // pad banks (ch 7/8) belong to deck 1/2
  const deck = deckFor(ch >= 7 ? ch - 7 : ch);
  if (!deck) return;
  const key = `p${ch}`;

  if (kind === 0x90) {
    if (d2 === 0) {
      if (d1 === 0x36) {
        // jog platter released
        jogTouch[key] = false;
        deck.endScratch();
      }
      return;
    }
    switch (d1) {
      case 0x0b:
        return deck.playing ? deck.pause() : deck.play();
      case 0x0c:
        return deck.seek(deck.cuePoint);
      case 0x58:
        return deck.syncTo(mixerRef.decks[deck.id === "A" ? "B" : "A"]);
      case 0x36: // jog top touch
        jogTouch[key] = true;
        return deck.scratchStart();
      case 0x4d: // beat loop / auto loop
      case 0x14:
        return deck.toggleLoop(deck.loopBeats);
      case 0x54: // loop halve
        return deck.toggleLoop(Math.max(0.03125, deck.loopBeats / 2));
      case 0x55: // loop double
        return deck.toggleLoop(Math.min(32, deck.loopBeats * 2));
      default:
        if (d1 <= 0x07) return hotCue(deck, d1);
        return;
    }
  }

  if (kind === 0xb0) {
    const norm = d2 / 127;
    switch (d1) {
      case 0x00: // tempo slider
        return deck.setPitch((0.5 - norm) * 16);
      case 0x13: // channel fader
        return deck.setVolume(norm);
      case 0x07: // EQ hi
        return deck.setEq("high", (norm - 0.5) * 2);
      case 0x0b: // EQ mid
        return deck.setEq("mid", (norm - 0.5) * 2);
      case 0x0f: // EQ low
        return deck.setEq("low", (norm - 0.5) * 2);
      case 0x1f: // crossfader
      case 0x08:
        return mixerRef.setCrossfade(norm);
      case 0x22: // jog turn (scratch)
      case 0x21:
        return jog(deck, key, d2, 5);
      case 0x23: // jog bend (outer ring)
        return jog(deck, key, d2, 24);
    }
  }
}

function handleGeneric(data: Uint8Array) {
  if (!mixerRef) return;
  const status = data[0];
  const channel = status & 0x0f;
  const kind = status & 0xf0;
  const d1 = data[1];
  const d2 = data[2];
  const deck = deckFor(channel);
  if (!deck) return;

  if (kind === 0x90 && d2 > 0) {
    if (d1 <= 7) return hotCue(deck, d1);
    if (d1 === 11) return deck.playing ? deck.pause() : deck.play();
    if (d1 === 12) return deck.seek(deck.cuePoint);
    if (d1 === 13) {
      const other = mixerRef.decks[deck.id === "A" ? "B" : "A"];
      return deck.syncTo(other);
    }
    if (d1 === 14) return deck.toggleLoop(deck.loopBeats);
    return;
  }

  if (kind === 0xb0) {
    const norm = d2 / 127;
    switch (d1) {
      case 8:
        return deck.setVolume(norm);
      case 9:
        return deck.setPitch((norm - 0.5) * 16);
      case 10:
        return deck.setEq("low", (norm - 0.5) * 2);
      case 11:
        return deck.setEq("mid", (norm - 0.5) * 2);
      case 12:
        return deck.setEq("high", (norm - 0.5) * 2);
      case 63:
        return mixerRef.setCrossfade(norm);
      case 34:
        return jog(deck, `g${channel}`, d2, 6);
    }
  }
}

function handle(data: Uint8Array, vendor: Vendor) {
  if (vendor === "pioneer") handlePioneer(data);
  else handleGeneric(data);
}

function refresh() {
  if (!access) return;
  const names: string[] = [];
  access.inputs.forEach((input) => {
    const name = input.name || "MIDI input";
    const vendor = vendorOf(name);
    names.push(vendor === "pioneer" ? `${name} (Pioneer map)` : name);
    input.onmidimessage = (e) => handle(new Uint8Array(e.data ?? []), vendor);
  });
  info = { supported: true, connected: names };
  emit();
}

export async function connectMidi(mixer: Mixer): Promise<MidiInfo> {
  mixerRef = mixer;
  const nav = navigator as Navigator & { requestMIDIAccess?: () => Promise<MIDIAccess> };
  if (!nav.requestMIDIAccess) {
    info = { supported: false, connected: [] };
    emit();
    return info;
  }
  try {
    access = await nav.requestMIDIAccess();
    access.onstatechange = () => refresh();
    refresh();
  } catch {
    info = { supported: true, connected: [] };
    emit();
  }
  return info;
}
