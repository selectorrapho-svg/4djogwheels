# Native Android audio engine (Oboe: AAudio + OpenSL ES)

On Android the DJ decks play and scratch through a native C++ engine built on
Google's Oboe library (AAudio on Android 8.1+, OpenSL ES on older phones). The
web screens stay the same; the browser sound engine is muted automatically.

## Setup (once, after `npx cap add android`)

1. Copy files:
   - `android-native/cpp/*` → `android/app/src/main/cpp/`
   - `android-native/java/NativeDj.kt` and `NativeVideo.kt` → `android/app/src/main/java/app/lovable/djogpro/`
2. `android/app/build.gradle`:
   ```gradle
   android {
     defaultConfig { externalNativeBuild { cmake { cppFlags "-std=c++17" } }
                     ndk { abiFilters "arm64-v8a", "armeabi-v7a", "x86_64" } }
     externalNativeBuild { cmake { path "src/main/cpp/CMakeLists.txt" } }
     buildFeatures { prefab true }
   }
   dependencies { implementation "com.google.oboe:oboe:1.9.0" }
   ```
   Also add Kotlin: `apply plugin: 'kotlin-android'` (and the kotlin gradle plugin in the root build.gradle).
3. `MainActivity.java`:
   ```java
   public class MainActivity extends BridgeActivity {
     @Override public void onCreate(Bundle b) { registerPlugin(NativeDj.class); registerPlugin(NativeVideo.class); super.onCreate(b); }
   }
   ```
4. `bun run build && npx cap sync android && npx cap open android` → Build APK.

## What runs natively
- Deck playback, pitch, signed-rate scratching (true reverse), per-sample
  rate smoothing, Hermite interpolation, volume + crossfader, soft limiter.
- Hardware MediaCodec decoding of mp3/aac/m4a/wav and the audio track of mp4.

Video: `NativeVideo` decodes decks A/B with the hardware decoder into OpenGL ES textures, crossfades them on the GPU, and slaves each frame to the Oboe deck clock (rate-correct small drift, seek on large drift).

Oboe is pulled automatically by Gradle (`com.google.oboe:oboe`), so no repo clone is needed. Superpowered is a licensed SDK and is not bundled.
EQ, filter, FX and stems are still processed by the web engine in this version.

## Native analysis (WaveAnalyzer.cpp)
`NativeDj.nAnalyze(pcm, sampleRate, bins)` returns a 3-band low/mid/high
summary (full-spectrum RGB waveform: red = bass, green = mids, blue = highs)
plus the detected BPM as the last value. It runs in C++ so long tracks
analyse in a fraction of the time the WebView needs.
