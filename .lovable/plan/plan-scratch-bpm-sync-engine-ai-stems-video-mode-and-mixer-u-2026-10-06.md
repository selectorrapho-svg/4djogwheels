# Plan: Scratch/BPM/Sync engine, AI stems, video-mode and mixer UI updates

## 1. Audio engine upgrades (no visible UI change)
- Review MixCN (scratch, BPM detection, sync) and port its algorithms into the existing audio engine. Check its license first; if it is incompatible, re-implement the same approach instead of copying code.
- Swap the current BPM detection for the new detector and make Sync lock tempo and phase using the new beat grid.
- Make scratching (jogwheel and waveform) use the new scratch model so it sounds smoother.

## 2. Real AI stem separation (no visible UI change)
- Build demucs-rs for the browser (WebAssembly, using WebGPU when the device supports it) and run it in a background worker.
- Existing stem controls (vocals, drums, bass, other) will play real separated stems instead of frequency filters.
- Trade-offs: the model is a large one-time download, about 80+ MB, and separation takes about a minute per track on phones. Until the stems are ready, the current filter-based stems keep working.

## 3. Video mode
- Replace the "Mixer" button with "Samples". The sample pads sit at the bottom of the center area, not the top.
- Video-mode Hot cues view gets three tabs: Hot cues, Pitch cue (pads play the cue at different pitches), and Skip (pads jump forward or back by 1, 2, 4, 8, 16 or 32 beats).

## 4. Jogwheels
- Add two new skins: Vinyl Gold and Vinyl Diamond. Each has a loaded look and an empty, darker look. They show album art like the other skins and have no marker.

## 5. Crossfader Cut mode
- Add a "Cut" toggle next to the crossfader.
- When Cut is on and the knob is fully left or right, touching the fader track makes the knob jump to the touch point. On release it springs back to where it was. This makes scratching on Android easier.

## 6. Compact landscape layout
- Shrink the header, deck info rows and transport spacing so the file browser is reachable without scrolling.

## 7. Pad FX
- Add an On/Off button to the Pad FX panel to turn pad effects on or off.

## Technical notes
- Port engine code into `src/lib/dj` (beat detection, sync and scratch modules). Keep UI components the same except for the items above.
- demucs-rs: compile with wasm-pack, place it in `public/`, run it in a Web Worker, and cache the model and stems in IndexedDB.
- Cut mode: on pointerdown, save the fader value, call `setCrossfade(touch)`, and restore the saved value on pointerup or cancel.
