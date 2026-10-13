# Task roadmap

## October 13 scratch and Studio upgrade
- [ ] Improve hand-position scratch accuracy and test reversals, holds and release with loaded audio.
- [ ] Research freely licensed scratch references without copying incompatible native code.
- [ ] Remove mixer overview volume sliders; add blue value arcs and split portrait SET/cue controls; restyle shared faders.
- [ ] Add Settings Studio/DAW workspace with working audio import, arrangement and playback controls.
- [ ] Verify Studio and DJ controls in portrait and landscape; report Android/device-only limitations.

## Current full-spectrum and scratch regression
- [ ] Repair full-spectrum colors at every zoom without changing zigzag geometry.
- [ ] Repair position-locked scratch response and test signal continuity.
- [ ] Review Mixxx native implementation as reference; preserve the browser runtime.
- [ ] Verify grid-snapped hot cues and sync behavior with regression tests and loaded audio.

## AI track structure and cue recommendations
- [ ] Add in-app audio analysis using AI Gateway with structure and recommended mixing cue points.
- [ ] Verify analysis and applying suggested cues; report any external service blocker.

## Current waveform palette restoration
- [x] Copy only the original full-spectrum RGB colors from the specified previous project; retain zigzag geometry and controls.
- [x] Verify shared waveform rendering and existing stem/audio regressions.

## October 12 waveform, scratch and mixer corrections
- [ ] Restore RGB and automatic zoomed zigzags across waveform lanes.
- [ ] Fix jog position continuity and scratch ticking; run audio regressions.
- [ ] Add paired thin square VU columns; enlarge filter/EQ controls and tighten labels.
- [ ] Hide mixer overview in video and contain controls above crossfader.
- [ ] Add editable beat-grid markers and BPM controls; verify both orientations.

## October 11 scratch and reference controls
- [ ] Remove scratch ticking while keeping sharp, position-locked jog response.
- [ ] Add accessible DNA editing and selection of the scratch starting point.
- [ ] Make all waveform views follow muted stem levels, including green vocals.
- [ ] Add a working queue-based Automix view accessible from Settings.
- [ ] Match reference mixer/library controls and Settings on/off switches; retain portrait logo.
- [ ] Verify audio processing, loaded-track controls and portrait/landscape layouts.

## October 11 playback and mixer
- [x] Remove A/V from the FX library.
- [x] Improve continuous jog scratching and native Android position control.
- [x] Correct Bluetooth stream recovery (APK video clock still open).
- [ ] Improve beat-grid sync and expose key lock beside Pitch Cue.
- [x] Match neutral mixer knobs, paired segmented meters and crossfader.
- [ ] Run tests and preview checks; document device-only verification.

## Current FX refinements
- [ ] Remove A/V from FX library and add per-effect quality settings.
- [ ] Connect scratching to Android playback and verify what is possible without hardware.
- [ ] Extend deck-local FX upward to the top bar without widening it.
- [ ] Open Tools directly on FX with Samples and Hot Cues alternatives.
- [ ] Animate colorful sampler/Instant pads and add neutral glassy rectangular FX sliders.
- [ ] Add top-bar waveform dropdown and verify controls on screen.

## Active compact landscape controls
- [ ] Fit Pad/Instant/Manual FX within their deck and keep effect labels readable.
- [ ] Add discreet top-bar dropdown revealing horizontal scratch waveforms.
- [ ] Expose landscape Pitch Cue and connect loop modes to working controls.
- [ ] Verify the requested controls and layout.

## October 9 stems, mixer and performance
- [ ] Finish branded S-panel with four reactive stem faders in both layouts.
- [ ] Add channel faders to mixer overview and reference-style pitch/waveform menus.
- [ ] Add large searchable Audio/Visual/A-V/Favorites browser and working video presets.
- [ ] Remove sync pitch hunting and reduce landscape rendering work.
- [ ] Verify loaded-track controls, video output, sync tests and both layouts.

## October 9 mixer corrections
- [ ] Keep silver jog artwork unchanged and remove seek needle.
- [ ] Reduce landscape rendering/audio glitches and link jog, waveform and scratch position.
- [ ] Correct directed tempo/beat sync and grouped four-deck sync; check key lock.
- [ ] Keep C/D exclusive to four-deck mode; add compact portrait/four-deck pitch dropdowns.
- [ ] Add folder browsing and reference manual loop/beat-jump controls; improve zoomed RGB shapes.
- [ ] Verify loaded audio/video flows and tests; distinguish Android hardware checks.

## October 8 DJ upgrades
- [ ] Connect vinyl control and BPM/waveform analysis where supported.
- [ ] Improve scratching and video synchronization.
- [ ] Add Settings audio/video recording selector, quality controls and file/folder access.
- [ ] Restore standalone blue waveform colouring and reference frosted landscape cue pads/account navigation.
- [ ] Verify browser flows and identify Android hardware checks.

## Current request
- [ ] Restore original splash artwork with mix4deejays as a logo only.
- [ ] Remove all gold/diamond jog styles, extend remaining platter designs and improve touch scratching.
- [ ] Fix the S-button stems panel and verify its four audio sliders.
- [ ] Add silver-only seek needle and extended jog options; gold/diamond styles are withdrawn.
- [ ] Add splash Next → payment/login/Skip using the supplied mix4deejays logo.
- [ ] Move Cut to Settings and consolidate performance FX controls.
- [ ] Replace floating FX library with a large high-contrast load-effect browser.
- [ ] Add video preset browser: 70+ VFX, 50+ transitions, TV simulation and 3D box.
- [ ] Match portrait transport/pads/FX references and A/B/Mix visibility; compact dropdowns.
- [ ] Verify requested controls in the preview; identify Android-only checks.

- [x] Accounts \& Pro: offline phone+name+password login, WhatsApp payment (0745260364, 150 KES/month), admin approve/cancel pop-up, 30-day unlock codes, 2 phones per account, admin all-features; Account tab + upgrade card with background image and rounded corners in Settings.
- [x] Pro gating: custom video watermark, video recording and AI stems locked for free users; free keeps mixing and beat removal.
- [ ] Stems UI: Drums/Bass/Harmonic/Vocals sliders panel opening from the deck stems button.
- [ ] Mixer overview redesign: filter/EQ knobs, channel faders, segmented VU meters, reference crossfader with FX menu.
- [ ] FX library UI (Audio/Visual/A-V/Favorites tabs), pad restyle, library menu and sorting.
- [ ] Pre-cue button per deck with split-output cue mix where supported.
- [ ] Offline recorder: video 360p-1080p + low-storage option, MP3/WAV audio, internal/mic/both sources.
- [ ] Verify the whole flow in the preview after the APK-reported library hang and video fixes.

---

- [ ] Improve scratch sound and video playback/synchronization; verify native behavior on Android hardware.
- [x] Make upright spectrum waveforms and reference-inspired landscape controls/crossfader.
- [ ] Share one mobile library across all four decks, support device music/video access, queue, playlists, and track analysis.
- [ ] Verify loaded-track playback and mobile layouts; document native platform limitations honestly.
- [ ] Match the uploaded portrait top/bottom deck controls, vinyl views, waveform/pads tabs, and combine landscape performance tools; verify both orientations.
- [x] Activate portrait cue/retrigger, replace vinyl artwork with supplied jog parts, and fit landscape transport/crossfader.
- [x] Add library sorting/files view, reference-style FX/sampler grids, and adjustable FX beats.
- [x] Video mode: Samples replaces Mixer with bottom pads; working Pitch Cue and Skip pads; crossfader Cut spring mode; Pad FX on/off toggle. Verified in browser.
- [ ] Bundled demo tracks return not-found from the asset store in the dev sandbox ("Unable to decode audio data"); confirm whether they load in the published app or re-upload the audio files.
- [ ] Add floating master/A/B video monitors and 100+ functional transition/VFX presets; verify browser playback and scratch path.

- [ ] Restyle landscape transport/crossfader as frosted dark-grey controls without gradients; enlarge jogwheels, restore skins and add Rane-inspired style without marker.
- [ ] Hide initial landscape waveforms; add view toggles, waveform dropdown settings and RGB frequency colours.
- [ ] Add independently collapsible video deck previews retaining master output; verify crossfader interaction.
- [ ] Download and review Mixxx as a reference; document native engine integration limits.
