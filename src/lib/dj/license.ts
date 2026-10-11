// Offline accounts + Pro unlock codes.
// Customers pay on WhatsApp; the admin approves a request inside the app and
// sends back a signed unlock code tied to the customer's phone + this device.
import { useSyncExternalStore } from "react";

export const ADMIN_PHONE = "0745260364";
export const ADMIN_WHATSAPP = "254745260364";
export const PRICE_KES = 150;
export const PRO_DAYS = 30;
export const MAX_DEVICES = 2;
// Embedded signing key. Stops ordinary sharing of codes; not tamper-proof.
const SECRET = "djogwheels-pro-v1::vdj-raph::k7Q2xN9mRt";

const ACCOUNTS = "djog.accounts.v1";
const SESSION = "djog.session.v1";
const DEVICE = "djog.device.v1";
const PRO = "djog.pro.v1";
const ISSUED = "djog.admin.issued.v1";

export type Account = { phone: string; name: string; pass: string };
export type LicenseState = { user: Account | null; deviceId: string; isAdmin: boolean; isPro: boolean; proUntil: number | null };

export function normalizePhone(p: string) {
  const d = p.replace(/\D/g, "");
  if (d.startsWith("254") && d.length === 12) return "0" + d.slice(3);
  if (d.length === 9 && /^[71]/.test(d)) return "0" + d;
  return d;
}

const read = <T,>(k: string, d: T): T => {
  if (typeof window === "undefined") return d;
  try { const v = localStorage.getItem(k); return v ? (JSON.parse(v) as T) : d; } catch { return d; }
};
const write = (k: string, v: unknown) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* ignore */ } };

function deviceId() {
  let id = read<string | null>(DEVICE, null);
  if (!id) {
    const a = new Uint8Array(4);
    crypto.getRandomValues(a);
    id = Array.from(a, (b) => b.toString(16).padStart(2, "0")).join("").toUpperCase();
    write(DEVICE, id);
  }
  return id;
}

async function sha(text: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, "0")).join("");
}
async function sign(payload: string) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(SECRET), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  return Array.from(new Uint8Array(sig).slice(0, 5), (b) => b.toString(16).padStart(2, "0")).join("").toUpperCase();
}

// ---------- store ----------
const listeners = new Set<() => void>();
let state: LicenseState = compute();
function compute(): LicenseState {
  const user = read<Account | null>(SESSION, null);
  const isAdmin = !!user && normalizePhone(user.phone) === ADMIN_PHONE;
  const pro = read<{ phone: string; until: number } | null>(PRO, null);
  const valid = !!user && !!pro && pro.phone === normalizePhone(user.phone) && pro.until > Date.now();
  const s = { user, deviceId: typeof window === "undefined" ? "" : deviceId(), isAdmin, isPro: isAdmin || valid, proUntil: valid ? pro!.until : null };
  if (typeof window !== "undefined") (globalThis as { __djPro?: boolean }).__djPro = s.isPro;
  return s;
}
function publish() { state = compute(); listeners.forEach((l) => l()); }
const SERVER: LicenseState = { user: null, deviceId: "", isAdmin: false, isPro: false, proUntil: null };

export function useLicense() {
  return useSyncExternalStore((l) => { listeners.add(l); return () => listeners.delete(l); }, () => state, () => SERVER);
}
export const isPro = () => state.isPro;

// ---------- accounts ----------
export async function signUp(phone: string, name: string, password: string) {
  const p = normalizePhone(phone);
  if (p.length < 10) throw new Error("Enter a valid phone number.");
  if (!name.trim()) throw new Error("Enter your name.");
  if (password.length < 4) throw new Error("Password must be at least 4 characters.");
  const accounts = read<Account[]>(ACCOUNTS, []);
  if (accounts.some((a) => a.phone === p)) throw new Error("This phone is already registered. Log in instead.");
  const acc = { phone: p, name: name.trim().slice(0, 60), pass: await sha(p + ":" + password) };
  write(ACCOUNTS, [...accounts, acc]);
  write(SESSION, acc);
  publish();
}
export async function logIn(phone: string, password: string) {
  const p = normalizePhone(phone);
  const acc = read<Account[]>(ACCOUNTS, []).find((a) => a.phone === p);
  if (!acc || acc.pass !== (await sha(p + ":" + password))) throw new Error("Wrong phone number or password.");
  write(SESSION, acc);
  publish();
}
export function logOut() { localStorage.removeItem(SESSION); publish(); }

// ---------- payment requests ----------
/** Code the customer sends on WhatsApp: REQ-<phone>-<device> */
export function requestCode() {
  return state.user ? `REQ-${state.user.phone}-${state.deviceId}` : "";
}
export function whatsappPayUrl() {
  const u = state.user;
  const msg = `Hello, I want djogwheels PRO (${PRICE_KES} KES / month).\nName: ${u?.name ?? ""}\nPhone: ${u?.phone ?? ""}\nRequest: ${requestCode()}`;
  return `https://wa.me/${ADMIN_WHATSAPP}?text=${encodeURIComponent(msg)}`;
}
export function parseRequest(text: string) {
  const m = text.toUpperCase().match(/REQ-(\d{9,13})-([0-9A-F]{8})/);
  return m ? { phone: normalizePhone(m[1]), device: m[2] } : null;
}

/** Admin: devices already approved per phone (max 2). */
export function issuedDevices(phone: string) {
  return read<Record<string, string[]>>(ISSUED, {})[phone] ?? [];
}
export async function approve(phone: string, device: string) {
  if (!state.isAdmin) throw new Error("Only the admin can approve.");
  const all = read<Record<string, string[]>>(ISSUED, {});
  const list = all[phone] ?? [];
  if (!list.includes(device) && list.length >= MAX_DEVICES) throw new Error(`This account is already active on ${MAX_DEVICES} phones.`);
  if (!list.includes(device)) all[phone] = [...list, device];
  write(ISSUED, all);
  const day = Math.floor(Date.now() / 86_400_000) + PRO_DAYS;
  const sig = await sign(`${phone}|${device}|${day}`);
  return `PRO-${day.toString(36).toUpperCase()}-${sig}`;
}

/** Customer: enter unlock code from WhatsApp. */
export async function redeem(code: string) {
  const u = state.user;
  if (!u) throw new Error("Log in first.");
  const m = code.trim().toUpperCase().match(/^PRO-([0-9A-Z]+)-([0-9A-F]{10})$/);
  if (!m) throw new Error("That code is not valid.");
  const day = parseInt(m[1], 36);
  if ((await sign(`${u.phone}|${state.deviceId}|${day}`)) !== m[2]) throw new Error("This code is for a different phone or account.");
  const until = day * 86_400_000;
  if (until < Date.now()) throw new Error("This code has expired.");
  write(PRO, { phone: u.phone, until });
  publish();
}
