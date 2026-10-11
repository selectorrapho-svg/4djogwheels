/**
 * Runtime permission helpers used by the Settings panel. All calls are
 * browser-only and safe inside a Capacitor Android WebView.
 */

export type PermState = "granted" | "denied" | "unsupported" | "prompt";

export async function requestNotifications(): Promise<PermState> {
  if (typeof window === "undefined" || !("Notification" in window)) return "unsupported";
  try {
    const res = await Notification.requestPermission();
    return res === "granted" ? "granted" : res === "denied" ? "denied" : "prompt";
  } catch {
    return "denied";
  }
}

export function notify(title: string, body?: string) {
  if (typeof window === "undefined" || !("Notification" in window)) return;
  if (Notification.permission !== "granted") return;
  try {
    new Notification(title, { body, icon: "/icon-192.png" });
  } catch {
    /* ignore */
  }
}

export async function requestMicrophone(): Promise<PermState> {
  if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) return "unsupported";
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream.getTracks().forEach((t) => t.stop());
    return "granted";
  } catch {
    return "denied";
  }
}

/** Keeps the screen awake while DJing (Android WebView supports this). */
export async function requestWakeLock(): Promise<PermState> {
  const nav = navigator as Navigator & { wakeLock?: { request: (t: "screen") => Promise<unknown> } };
  if (typeof navigator === "undefined" || !nav.wakeLock) return "unsupported";
  try {
    await nav.wakeLock.request("screen");
    return "granted";
  } catch {
    return "denied";
  }
}

export function notificationState(): PermState {
  if (typeof window === "undefined" || !("Notification" in window)) return "unsupported";
  return Notification.permission === "granted"
    ? "granted"
    : Notification.permission === "denied"
      ? "denied"
      : "prompt";
}
