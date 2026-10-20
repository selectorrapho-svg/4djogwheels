import { useSyncExternalStore } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { getOfflineLicense, getLicensePublicKey } from './license.functions';
import { canUseStudio, MAX_DEVICES, type OfflineEntitlement } from './licenseRules';
export { MAX_DEVICES };
export const ADMIN_WHATSAPP = '254745260364';
export const PRICE_KES = 150;
export type Account = { id: string; phone: string; name: string; email: string };
export type LicenseState = { user: Account | null; deviceId: string; isAdmin: boolean; isPro: boolean; proUntil: number | null; loading: boolean };
const SERVER: LicenseState = { user: null, deviceId: '', isAdmin: false, isPro: false, proUntil: null, loading: true };
let state = SERVER;
const listeners = new Set<() => void>();
let started = false, epoch = 0;
function publish(patch: Partial<LicenseState>) { state = { ...state, ...patch }; (globalThis as { __djPro?: boolean }).__djPro = state.isPro; listeners.forEach(l => l()); }
export function normalizePhone(p: string) { const d = p.replace(/\D/g, ''); return d.startsWith('254') && d.length === 12 ? '0' + d.slice(3) : d.length === 9 && /^[71]/.test(d) ? '0' + d : d; }
function deviceId() { let id = localStorage.getItem('djog.secure.device'); if (!id || !/^[A-F0-9]{8}$/.test(id)) { id = Array.from(crypto.getRandomValues(new Uint8Array(4)), b => b.toString(16).padStart(2,'0')).join('').toUpperCase(); localStorage.setItem('djog.secure.device', id); } return id; }
async function restoreOffline() {
  try {
    const cached = JSON.parse(localStorage.getItem('djog.signed.pro') ?? 'null');
    const publicKey = JSON.parse(localStorage.getItem('djog.license.public') ?? 'null');
    if (!cached || !publicKey) return;
    const { p256 } = await import('@noble/curves/p256');
    const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(cached.payload)));
    if (!p256.verify(new Uint8Array(cached.signature), digest, new Uint8Array(publicKey))) return;
    const e = JSON.parse(cached.payload) as OfflineEntitlement;
    const remembered = localStorage.getItem('djog.last.user');
    if (!remembered || !canUseStudio(e, remembered, state.deviceId, Date.now())) return;
    publish({ user: { id: e.userId, name: e.name, phone: e.phone, email: '' }, isPro: true, proUntil: e.until, isAdmin: false });
  } catch { /* unsigned or expired records never unlock */ }
}
export async function refreshLicense() {
  const token = ++epoch;
  const { data, error } = await supabase.auth.getUser();
  if (token !== epoch) return;
  if (error || !data.user) { publish({ loading: false }); if (error && state.isPro && !navigator.onLine) return; publish({ user: null, isAdmin: false, isPro: false, proUntil: null }); return; }
  const user = data.user;
  const [profile, roles, devices] = await Promise.all([
    supabase.from('profiles').select('name,phone').eq('id', user.id).single(),
    supabase.from('user_roles').select('role').eq('user_id', user.id),
    supabase.from('pro_devices').select('expires_at').eq('user_id', user.id).eq('device_id', state.deviceId).maybeSingle(),
  ]);
  if (token !== epoch) return;
  const isAdmin = roles.data?.some(r => r.role === 'admin') ?? false;
  const until = devices.data ? Date.parse(devices.data.expires_at) : 0;
  publish({ user: { id: user.id, email: user.email ?? '', name: profile.data?.name || user.email || 'DJ', phone: profile.data?.phone ?? '' }, isAdmin, isPro: isAdmin || until > Date.now(), proUntil: until > Date.now() ? until : null, loading: false });
  localStorage.setItem('djog.last.user', user.id);
  try {
    const [signed, publicKey] = await Promise.all([getOfflineLicense({ data: { device: state.deviceId } }), getLicensePublicKey()]);
    if (token !== epoch) return;
    localStorage.setItem('djog.license.public', JSON.stringify(publicKey));
    if (signed) localStorage.setItem('djog.signed.pro', JSON.stringify(signed)); else localStorage.removeItem('djog.signed.pro');
  } catch { /* online entitlement remains authoritative; offline signing needs hosted server */ }
}
export function initializeLicense() {
  if (started) return () => {}; started = true;
  publish({ deviceId: deviceId() });
  // Legacy client-local credentials and signing keys are not trusted or migrated.
  ['djog.accounts.v1','djog.session.v1','djog.pro.v1','djog.admin.issued.v1'].forEach(k => localStorage.removeItem(k));
  void restoreOffline().then(refreshLicense);
  const timer = window.setInterval(() => { if (!state.isAdmin && state.proUntil && state.proUntil <= Date.now()) publish({ isPro: false, proUntil: null }); }, 1000);
  return () => { clearInterval(timer); started = false; };
}
export function useLicense() { return useSyncExternalStore(l => { listeners.add(l); return () => { listeners.delete(l); }; }, () => state, () => SERVER); }
export const isPro = () => state.isPro && (state.isAdmin || (state.proUntil ?? 0) > Date.now());
export async function signUp(email: string, name: string, password: string, phone: string) {
  if (!name.trim() || password.length < 8) throw new Error('Enter your name and a password of at least 8 characters.');
  const { error } = await supabase.auth.signUp({ email: email.trim(), password, options: { emailRedirectTo: window.location.origin, data: { name: name.trim().slice(0,60), phone: normalizePhone(phone) } } });
  if (error) throw error;
}
export async function logIn(email: string, password: string) { const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password }); if (error) throw error; await refreshLicense(); }
export async function logOut() { ++epoch; localStorage.removeItem('djog.last.user'); localStorage.removeItem('djog.signed.pro'); publish({ user: null, isAdmin: false, isPro: false, proUntil: null }); const { error } = await supabase.auth.signOut(); if (error) throw error; }
export function requestCode() { return state.user ? `REQ-${state.user.id}-${state.deviceId}` : ''; }
export function whatsappPayUrl() { return `https://wa.me/${ADMIN_WHATSAPP}?text=${encodeURIComponent(`Hello, I want djogwheels PRO (${PRICE_KES} KES / month).\nName: ${state.user?.name ?? ''}\nPhone: ${state.user?.phone ?? ''}\nRequest: ${requestCode()}`)}`; }
export function parseRequest(text: string) { const m = text.match(/REQ-([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})-([A-F0-9]{8})/i); return m ? { userId: m[1].toLowerCase(), device: m[2].toUpperCase() } : null; }
export async function approve(userId: string, device: string, months = 1) { const { data, error } = await supabase.rpc('issue_pro_code', { _user_id: userId, _device: device, _months: months }); if (error) throw error; return data; }
export async function redeem(code: string) { const { error } = await supabase.rpc('redeem_pro_code', { _code: code, _device: state.deviceId }); if (error) throw error; await refreshLicense(); }
