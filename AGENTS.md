<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Keep the uploaded DJ mixer in `src/components/dj` with its audio engine in `src/lib/dj`, because the interface and playback logic are shared across desktop and portrait layouts.
- Render the full-size deck waveforms in the orientation chosen in Settings (default vertical) in both center-column and portrait layouts, because the mixer should show upright scrolling tracks.
- Keep one per-deck performance-tools entry point in the landscape strip, because separate cues, FX, and sampler triggers crowd narrow phones.
- Render performance tabs inline inside one deck-anchored drawer and top waveforms through shared existing scratch canvases, because nested floating tools obscure waveforms and duplicate playback logic.
- Keep Settings grouped into mobile-friendly sections, because portrait phones and tablets are the primary controls and long multi-column forms bury playback options.
- Keep scratch audio sourced from the track without synthetic vinyl hiss, because stopped or slow platters should not add background noise.
- Read embedded album artwork when media enters the library and pass it through the deck model, because the same real cover must appear in the library, headers, and loaded jogwheels.

- Keep landscape side video previews independently toggled inside DeckPanel and the master compositor mounted in CenterColumn, so hiding a preview never interrupts mixed output.
- Treat Mixxx as an algorithmic reference only; do not import its native GPL source into the web application without an explicit licensing and native integration decision.
- Render the full-spectrum RGB waveform from a once-per-track offscreen strip (src/lib/dj/rgbWave.ts) and blit visible slices per frame, because per-frame path drawing is too slow on phones.
- Share frequency palette definitions between legacy envelopes, cached RGB strips and zoomed zigzags, because every waveform view must use the same colors without changing its geometry.
- Keep sync tempo lock separate from phase alignment and re-anchor the playback clock before rate changes, because feedback pitch changes and retroactive clock scaling cause hunting and stutters.
- Define parameterized visual/transition families in `src/lib/dj/videoPresets.ts` and composite them on the existing master canvas, because output recording and hidden deck previews must share the same picture.
- Use a shared searchable effect browser for deck slots and master video selections, because small native selects cannot fit the full library on phones.
- Keep Automix in one browser-side controller per mixer using the existing queue and decks, because screen visibility must not create competing playback clocks.
- Schedule DNA direction changes on the audio clock and preserve every separated stem channel in scratch playback, because timer jitter and stereo-only scratch output disrupt cuts and stem routing.
- Render separated eight-channel waveform peaks from their actual stem pairs and key waveform caches by stem levels, because visual mutes must follow the audio controls.
