import { createServerFn } from '@tanstack/react-start';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { z } from 'zod';

export const getLicensePublicKey = createServerFn({ method: 'GET' }).handler(async () => {
  const secret = process.env['DJ_LICENSE_SIGNING_SECRET']; if (!secret) throw new Error('License signing unavailable');
  const { p256 } = await import('@noble/curves/p256');
  const key = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(secret)));
  return Array.from(p256.getPublicKey(key));
});
export const getOfflineLicense = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth])
  .inputValidator(z.object({ device: z.string().regex(/^[A-F0-9]{8}$/) }))
  .handler(async ({ data, context }) => {
    const { data: profile, error: profileError } = await context.supabase.from('profiles').select('name,phone').eq('id', context.userId).single();
    if (profileError || !profile) throw new Error('Account details unavailable');
    const { data: device } = await context.supabase.from('pro_devices').select('expires_at').eq('user_id', context.userId).eq('device_id', data.device).maybeSingle();
    const { data: admin } = await context.supabase.rpc('has_role', { _user_id: context.userId, _role: 'admin' });
    const until = admin ? Date.now() + 7 * 86400000 : device ? Date.parse(device.expires_at) : 0;
    if (until <= Date.now()) return null;
    const payload = JSON.stringify({ userId: context.userId, name: profile.name, phone: profile.phone, device: data.device, until });
    const secret = process.env['DJ_LICENSE_SIGNING_SECRET']; if (!secret) throw new Error('License signing unavailable');
    const { p256 } = await import('@noble/curves/p256');
    const key = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(secret)));
    const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(payload)));
    return { payload, signature: Array.from(p256.sign(digest, key).toCompactRawBytes()) };
  });
