import type { CapacitorConfig } from "@capacitor/cli";

// Capacitor wrapper to produce a real Android APK from this web app.
// See ANDROID.md for the build steps and the Android permission list.
const config: CapacitorConfig = {
  appId: "app.lovable.djogpro",
  appName: "DjogPro",
  webDir: ".output/public",
  android: {
    allowMixedContent: true,
    // Media (audio/video) must be able to start without an extra tap.
    webContentsDebuggingEnabled: false,
  },
  server: {
    // Allow loading local audio/video files picked from device storage.
    androidScheme: "https",
  },
  plugins: {
    LocalNotifications: {
      smallIcon: "ic_stat_icon",
      iconColor: "#2f6bff",
    },
  },
};

export default config;
