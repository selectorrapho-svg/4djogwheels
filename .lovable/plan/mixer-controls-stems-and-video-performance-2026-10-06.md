# Mixer controls, stems and video performance

## 1. Fix stems first
- Replace the S button’s current vocal-mute action with a four-channel panel: Drums, Bass, Harmonic and Vocals.
- Connect each slider and mute button to that deck’s audio controls, in landscape and portrait.
- Clearly distinguish real separated stems from the existing frequency-band fallback. Show separation progress, unsupported-device and Pro-lock states rather than silently doing nothing.

## 2. Jogwheels and compact mixer controls
- Add a silver-only, Rane-inspired needle/playhead outside the rotating platter. Dragging it seeks backward and forward; platter dragging continues to scratch. Keep real album art visible.
- Finish distinct diamond and gold vinyl appearances and add extended platter options without replacing the other skins.
- Move Cut mode into Settings and apply the same saved setting to every crossfader; remove the adjacent CUT button.
- Remove the redundant side-strip FX button; keep FX reachable through the main performance tools with hot cues and Samples.
- Keep small menus compact, high-contrast and within screen boundaries.

## 3. Portrait controls and performance views
- Match the supplied dark-grey transport, pad and FX references: round play/pause controls, softly rounded Set/Cue controls, restrained blue selection states and clear dividers.
- Add A / Mix / B selection. A and B show only the selected deck’s main content; Mix shows both. Preserve the crossfader and transport access.
- Show cues, Samples and Pad / Instant / Manual FX in the main performance area rather than stacked floating drawers.
- Open a large, searchable, high-contrast effect browser only when choosing or replacing an FX slot. Include categories and selected-effect feedback, then return to the performance view.

## 4. Splash, logo and payment
- Use your uploaded mix4deejays logo in the splash and app branding, without embedding the reference screenshots.
- Replace the obsolete dollar plans and seven-day offer after Next with the existing 150 KES/month WhatsApp payment offer, login/create account and a visible Skip button.
- Keep free mixing available through Skip; login or payment must not block loading tracks.
- Replace the unsafe phone-number-based admin check and embedded unlock-signing secret with verified accounts and server-checked payment approvals through Lovable Cloud. A phone number alone will never grant admin access.
- WhatsApp opens a payment request; it does not claim payment succeeded. Approved Pro access can be cached for offline use, but new sign-ins and approvals need a connection.

## 5. Video transitions and VFX
- Add compact, dedicated Transitions and VFX controls in video mode, opening an organized visual preset browser.
- Provide at least 70 functional VFX presets and more than 50 transition presets, grouped by effect family—not empty labels.
- Include TV/CRT simulation and a Vegas-inspired rotating 3D box, alongside wipes, slides, zooms, dissolves and stylized color/distortion treatments.
- Apply selections to the actual master output and recorded picture while keeping audio, scratch timing and independently hidden deck previews intact.
- Use restrained preview sizes and a lower-quality fallback for devices that cannot sustain the selected effect.

## Technical approach
- Keep shared UI in `src/components/dj` and audio/video logic in `src/lib/dj`.
- Reuse the existing stem gain/mute methods and AI worker; opening the panel must not depend on successful AI initialization.
- Use a browser-safe WebGL shader compositor for advanced video effects, with the current canvas path as a basic fallback. Preserve the recorder’s master-canvas source.
- Use a maintained shader/transition library where its licensing and browser support fit; define reusable preset families with explicit parameters.
- Store Cut and jog options through the existing settings system. Use shared effect-browser components across both orientations.
- Enable Lovable Cloud before implementing secure account or approval logic; store roles separately and validate them server-side.

## Verification
- Test that S opens the panel and all four controls change concrete audio gains/mute states.
- Test silver needle seeking, Cut spring return, A / Mix / B visibility, effect selection and preset counts.
- Exercise splash → Next → login/payment → Skip → mixer in the preview.
- Load actual audio and video, apply VFX/transitions and move the crossfader; verify master output and playback, not just empty decks.
- Check both layouts for clipped controls and overlapping menus. Android APK permissions, headphone routing and sustained device performance remain hardware checks.