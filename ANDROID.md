# Build the Android APK

The app ships as both an installable PWA *and* a Capacitor-wrapped native Android app. Everything works fully offline after first load.

## Option A — PWA (no build machine needed)
1. Open the published URL in Chrome on Android.
2. Menu → **Install app** / **Add to Home Screen**.
3. Launches full-screen with its own icon, works offline.

## Option B — Native APK (Capacitor)

Requirements on your build machine:
- Node 20 (or Bun)
- Java 17
- Android Studio (Android SDK Platform 34 + Build-Tools)

```bash
# 1. Install Capacitor (once)
bun add @capacitor/core @capacitor/cli @capacitor/android

# 2. Build the web bundle
bun run build            # → .output/public

# 3. Add the Android platform (once)
npx cap add android

# 4. Copy the latest web build into the native shell (every rebuild)
npx cap sync android

# 5. Open in Android Studio → Build → Build Bundle(s) / APK(s) → Build APK(s)
npx cap open android
```

Unsigned APK ends up at:
```
android/app/build/outputs/apk/debug/app-debug.apk
```

For a signed release APK, in Android Studio:
`Build → Generate Signed Bundle / APK → APK`, then follow the wizard with your keystore.

## Command-line release build (no IDE)

```bash
cd android
./gradlew assembleRelease   # → app/build/outputs/apk/release/app-release-unsigned.apk
# sign with apksigner using your keystore
```

## Configuration

`capacitor.config.ts` at the project root controls appId, appName and the WebView. Edit it before `npx cap sync android` when changing package name or splash.

## Android permissions & notifications

Add these to `android/app/src/main/AndroidManifest.xml` inside `<manifest>` after
`npx cap add android` (the app asks for each one only when you tap it in
Settings → Permissions & Notifications):

```xml
<uses-permission android:name="android.permission.INTERNET" />
<uses-permission android:name="android.permission.POST_NOTIFICATIONS" />
<uses-permission android:name="android.permission.RECORD_AUDIO" />
<uses-permission android:name="android.permission.MODIFY_AUDIO_SETTINGS" />
<uses-permission android:name="android.permission.WAKE_LOCK" />
<uses-permission android:name="android.permission.READ_MEDIA_AUDIO" />
<uses-permission android:name="android.permission.READ_MEDIA_VIDEO" />
<uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE"
    android:maxSdkVersion="32" />
<uses-feature android:name="android.hardware.usb.host" android:required="false" />
```

Keep the DJ screen landscape-friendly and awake by adding to the `<activity>` tag:

```xml
android:screenOrientation="fullSensor"
android:keepScreenOn="true"
android:configChanges="orientation|screenSize|keyboardHidden|screenLayout|uiMode"
```

All artwork (jog wheels, splash, tracks and samples) is bundled into the APK, so
the app runs with no network connection.


## Automatic music & video library (required)

The library lists every song and video on the phone through the `NativeMedia`
plugin and asks for permission on first launch. After `npx cap add android`:

1. Copy `android-native/java/NativeMediaPlugin.kt` (and `NativeDj.kt`) into
   `android/app/src/main/java/app/lovable/djogpro/`.
2. Register the plugins in `MainActivity`:

```kotlin
class MainActivity : BridgeActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        registerPlugin(NativeMediaPlugin::class.java)
        registerPlugin(NativeDj::class.java)
        super.onCreate(savedInstanceState)
    }
}
```

3. Make sure the `READ_MEDIA_AUDIO`, `READ_MEDIA_VIDEO` and
   `READ_EXTERNAL_STORAGE` permissions above are in `AndroidManifest.xml`.
4. `bun run build && npx cap sync android`, then rebuild the APK.
