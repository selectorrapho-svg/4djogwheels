# Plan: APK fixes, Pro/Free accounts, stems, mixer overview redesign, recorder

## 1. APK bug fixes (first)
- Library hang: read album art and track info in small batches in the background, show the list right away, and only draw the rows on screen. Tracks with no cover show an empty tile (no broken-image icon).
- Video mode in the APK: play phone videos through the app's file access, fall back to the built-in Android player when the web player can't open the file, and show a clear message if a format isn't supported.
- VU meters: read levels straight from the audio output so they move correctly offline on every deck.

## 2. Accounts and Pro (offline)
- Settings > Account: sign up / log in with phone number, name and password, saved on the phone.
- Free version (no trial): mixing, beat removal, basic FX. Locked: custom video logo, video recording, AI stems.
- Upgrade screen: background image, rounded corners, "150 KES / month" and a "Pay on WhatsApp" button that opens a chat with 0745260364 including the user's phone and a device code.
- Approval: when the admin (logged in as 0745260364) opens that request in the app, a pop-up shows the customer with Approve / Cancel. Approve creates an unlock code the admin sends back on WhatsApp; the customer enters it and all Pro features open for 30 days.
- Each unlock code works on a maximum of 2 phones for that account.
- Admin account always has every Pro feature.
- Limitation: without an online server, this stops ordinary users but a determined person who takes the app apart could get around it. I can add online checks later if you want them.

## 3. Stems (StemDeck)
- Check StemDeck's license and approach, and use its separation, BPM detection and sync ideas inside the current audio engine (keeping the existing AI stems as the main path).
- The deck "stems" button opens a Neural Mix-style panel: Drums, Bass, Harmonic, Vocals with tall sliders and mute icons (like your screenshot).

## 4. Mixer overview redesign (match your screenshots)
- Filter / High / Mid / Low knobs per side, two channel faders in the middle, segmented VU meters, EQ menu on top and round EQ on/off button.
- Crossfader knob: tall rounded dark cap with a blue center line, tick marks, plus the small dropdown arrow beside it (Crossfader FX, Tempo Blend, Auto-transition bars, Mix Now).
- Same sizes and spacing as the reference.

## 5. FX, pads, waveforms, library
- FX picker styled like your FX library screenshot: Audio / Visual / A/V / Favorites tabs, checkmark list, FX routing to stems.
- Hot cue and sampler pads restyled: dark rounded pads, colored edges, number labels, pressed glow.
- Waveform options: working High Contrast switch.
- Library: "Songs" menu (Add all to queue, Add all to playlist, Analyze songs) and a sort menu (Added, Album, Artist, BPM, Key, Released).

## 6. Pre-cue (headphones)
- A headphone cue button on each deck. On phones with headphones it sends that deck to the cue mix; in the Android app it uses split output when the device supports it.

## 7. Offline recorder (Pro)
- Video: 360p, 480p, 720p, 1080p with a "low storage" option.
- Audio: MP3 or WAV.
- Source: internal mix, microphone, or both. Files save to the phone.

## Technical notes
- Library: virtualized list, metadata queue with idle-time batching, artwork object URLs cached and revoked.
- Licensing: HMAC-signed unlock codes (account + device id + expiry), device list stored per account; admin key embedded in the app.
- Recording: MediaRecorder on the mixer output / canvas compositor stream; MP3 via a small WASM/JS encoder, WAV from raw PCM.
- Pre-cue: separate cue bus in the engine; native split output via the Android plugin.
