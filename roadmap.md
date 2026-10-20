# Task roadmap

## October 19 account, Studio, appearance and scratch upgrade
- [ ] Secure persistent login/logout and password-manager support; profiles confirmed, passwords never readable by admins.
- [ ] Restrict Studio mode to Pro users, including offline entitlement checks.
- [ ] Admin-generated Pro codes for 1–7 months and one year.
- [ ] Offline Studio projects and recordings in the device's duigsstudio folder.
- [ ] Studio grid eraser/delete, 70+ track/event FX, and undo/redo including splits and cuts.
- [ ] Remove jogwheel scratch settings; sharpen waveforms and add independent dark/light waveform background.
- [ ] Reference-inspired vinyl, performance icons, gray/light glass controls/library; blue blinking sync without BPM; remove orange accents.
- [ ] Refine baby scratches, chirps and flings against the reference video; no video attached in this turn, device headphone acceptance pending.
- [ ] Verify editing, recordings, loaded-track scratch and account flows; APK persistence requires installed-device checks.

## Current repository update import
- [x] Import source updates from selectorrapho-svg/3djogwheels while retaining current project asset ownership.
- [x] Verify regression tests and loaded-track mixer playback after import (28 tests passed; loaded playback resumes after jog release with no page errors).

## October 16 selected priorities
- [x] Scratch engine round: reversal-aware level gate (no more tick on every direction change), release coast bridging the motor hand-off (JogWheel wait 48→30 ms), adaptive replay delay from the real touch interval, and anti-aliased fast reads. 47 tests pass; preview scratch verified with a loaded track. Device ear check still pending.
- [ ] Verify real stem separation and four-slider mute/solo playback; fix discovered failures.
- [x] Restore always-visible portrait pitch and repair mixer knob sizing without volume sliders through the repository updates.

## Active reference controls and Studio
- [ ] Finer Studio zoom and tiny-clip splitting with editing verification.
- [ ] Gray/Light only, compact marked platters, grouped EQ/Waveforms/Video, glassy faders and Pitch/Volume selector.
- [ ] Diagnose scratch against supplied video, improve DSP and verify loaded playback; headphone/device listening remains required.

## October 14 compact Studio and scratch
- [ ] Improve sample-based scratch hand tracking and verify loaded audio.
- [ ] Compact Studio, independent split-clip fades/reverse, round stretch handles, and playhead-anchored zoom.
- [ ] Use supplied bold portrait logo in light and dark themes.
- [ ] Run editing/audio tests and verify Studio on desktop and portrait.

## October 14 uploaded scratch and Android request
- [ ] Integrate uploaded scratch controller/worklet, attach platter, and connect crossfader gain without duplicate attenuation.
- [x] Use supplied portrait splash and narrow/tall less-rounded crossfader handle.
- [ ] Prepare Android wrapper while preserving the supported web interface; native rewrite is not supported here.
- [ ] Verify loaded-track scratch, gain, artwork, and tests; Android device verification requires hardware.

## October 14 active request
- [ ] Match Extended, Combat Dark/Light platters and thicker mixer knob rings to references.
- [ ] Diagnose and improve audible jog scratch responsiveness with regression tests.
- [ ] Studio: per-track FX, detailed grids, long-press edit/paste, ±24 pitch, reverse, drag placement and stretch, snap/sync and two-finger zoom.
- [ ] Verify Studio editing and mixer rendering; document Android hardware limitations.

## October 13 requested refinements
- [ ] Restrict jog styles to seven and provide djay-inspired platter designs and dropdown.
- [ ] Remove colorful pricing artwork; compact knob rings and rounded neutral crossfader; double-click resets.
- [ ] Generate fallback track artwork and show streaming service choices (playback unavailable).
- [ ] Enable decoded-track playback before analysis completes; show progress and RGB overview waveforms.
- [ ] Diagnose and improve scratch timing with regression tests and preview checks.

## October 11 playback and mixer
- [ ] Remove A/V from the FX library.
- [ ] Improve continuous jog scratching and native Android position control.
- [ ] Correct Bluetooth stream recovery and APK video clock handling.
- [ ] Improve beat-grid sync and expose key lock beside Pitch Cue.
- [ ] Match neutral mixer knobs, paired segmented meters and crossfader.
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
- [x] Bundled demo tracks were 2-second stubs ("ends instantly, BPM —"); added five full-length demo tracks (92/100/112/124/128 BPM) and re-verified: decode, RGB waveform, playback, scratch position tracking and BPM analysis all work in the preview. Scratch sound quality still needs an ear check on a real device.
- [ ] Add floating master/A/B video monitors and 100+ functional transition/VFX presets; verify browser playback and scratch path.

- [ ] Restyle landscape transport/crossfader as frosted dark-grey controls without gradients; enlarge jogwheels, restore skins and add Rane-inspired style without marker.
- [ ] Hide initial landscape waveforms; add view toggles, waveform dropdown settings and RGB frequency colours.
- [ ] Add independently collapsible video deck previews retaining master output; verify crossfader interaction.
- [ ] Download and review Mixxx as a reference; document native engine integration limits.
