import { useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { lovable } from '@/integrations/lovable';
import '@lovable.dev/cloud-auth-js/styles.css';
import { useLicense, signUp, logIn, logOut, redeem, approve, parseRequest, whatsappPayUrl, requestCode, PRICE_KES } from '@/lib/dj/license';
import { PRO_MONTHS } from '@/lib/dj/licenseRules';
export function AccountPanel() {
  const lic = useLicense(), queryClient = useQueryClient(), navigate = useNavigate();
  const [mode,setMode] = useState<'login'|'signup'>('login');
  const [email,setEmail] = useState(''), [phone,setPhone] = useState(''), [name,setName] = useState(''), [pass,setPass] = useState(''), [code,setCode] = useState(''), [msg,setMsg] = useState(''), [busy,setBusy] = useState(false);
  const run = async (fn: () => Promise<unknown>, success = '') => { setBusy(true); setMsg(''); try { await fn(); setMsg(success); setPass(''); } catch(e) { setMsg(e instanceof Error ? e.message : 'Please try again.'); } finally { setBusy(false); } };
  if (lic.loading) return <p role="status" className="text-sm text-muted-foreground">Checking account…</p>;
  if (!lic.user) return <div className="space-y-3">
    <div className="grid grid-cols-2 gap-1"><Button variant={mode === 'login' ? 'default' : 'ghost'} onClick={() => setMode('login')}>Log in</Button><Button variant={mode === 'signup' ? 'default' : 'ghost'} onClick={() => setMode('signup')}>Create account</Button></div>
    <form className="space-y-2" onSubmit={e => { e.preventDefault(); void run(() => mode === 'login' ? logIn(email,pass) : signUp(email,name,pass,phone), mode === 'signup' ? 'Check your email to confirm your account before signing in.' : ''); }}>
      <Input name="email" aria-label="Email address" type="email" autoComplete="username" placeholder="Email address" required value={email} onChange={e => setEmail(e.target.value)} />
      {mode === 'signup' && <><Input name="name" aria-label="Your name" autoComplete="name" placeholder="Your name" required maxLength={60} value={name} onChange={e => setName(e.target.value)} /><Input name="phone" aria-label="Phone number" autoComplete="tel" inputMode="tel" placeholder="Phone number" maxLength={20} value={phone} onChange={e => setPhone(e.target.value)} /></>}
      <Input name="password" aria-label="Password" type="password" autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} minLength={8} required placeholder="Password" value={pass} onChange={e => setPass(e.target.value)} />
      <Button type="submit" disabled={busy} className="w-full">{busy ? 'Please wait…' : mode === 'login' ? 'Log in' : 'Create account'}</Button>
    </form>
    {mode === 'login' && <Button variant="ghost" disabled={busy || !email} onClick={() => void run(async () => { const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/reset-password` }); if(error) throw error; }, 'If an account exists, check your email for a reset link.')}>Forgot password?</Button>}
    <Button variant="outline" className="w-full" disabled={busy} onClick={() => void run(async () => { const result = await lovable.auth.signInWithOAuth('google', { redirect_uri: window.location.origin }); if(result.error) throw result.error; })}>Continue with Google</Button>
    <Button className="lovable-auth-button w-full" disabled={busy} onClick={() => void run(async () => { const result = await lovable.auth.signInWithOAuth('lovable', { redirect_uri: window.location.origin }); if(result.error) throw result.error; })}>Continue with Lovable</Button>
    {msg && <p role="status" className="text-xs text-foreground">{msg}</p>}
  </div>;
  return <div className="space-y-3 text-sm">
    <div className="flex items-center justify-between gap-2"><div className="min-w-0"><div className="truncate font-semibold">{lic.user.name}</div><div className="truncate text-xs text-muted-foreground">{lic.user.email || lic.user.phone}</div></div><Button variant="outline" size="sm" disabled={busy} onClick={() => void run(async () => { await queryClient.cancelQueries(); queryClient.clear(); await logOut(); await navigate({ to: '/auth', replace: true }); })}>Log out</Button></div>
    <div className="rounded-lg border border-border bg-secondary/50 p-3"><div className="font-semibold">{lic.isAdmin ? 'Admin · PRO' : lic.isPro ? 'PRO active' : 'Free version'}</div><div className="text-xs text-muted-foreground">{lic.proUntil ? `Until ${new Date(lic.proUntil).toLocaleDateString()}` : lic.isAdmin ? 'All Pro features' : 'Studio, AI stems and recording require PRO.'}</div></div>
    {!lic.isAdmin && <><a href={whatsappPayUrl()} target="_blank" rel="noreferrer"><Button className="w-full">Pay {PRICE_KES} KES / month on WhatsApp</Button></a><p className="break-all text-xs text-muted-foreground">Request: <span className="select-all font-mono text-foreground">{requestCode()}</span></p><form className="flex gap-2" onSubmit={e => { e.preventDefault(); void run(() => redeem(code), 'PRO activated.'); }}><Input aria-label="Pro access code" placeholder="PRO access code" required value={code} onChange={e => setCode(e.target.value)} /><Button disabled={busy} type="submit">Unlock</Button></form></>}
    {msg && <p role="status" className="text-xs text-foreground">{msg}</p>}
    {lic.isAdmin && <AdminApprovals />}
  </div>;
}
function AdminApprovals() {
  const [text,setText] = useState(''), [months,setMonths] = useState(1), [result,setResult] = useState(''), [err,setErr] = useState(''), [busy,setBusy] = useState(false);
  return <div className="space-y-2 border-t border-border pt-3"><h3 className="font-semibold">Generate PRO access code</h3><textarea aria-label="Customer request" placeholder="Paste the customer's REQ code" className="h-20 w-full rounded-md border border-border bg-secondary p-2 text-xs" value={text} onChange={e => { setText(e.target.value); setResult(''); }} /><label className="block text-xs">Duration<select aria-label="Pro duration" className="mt-1 h-10 w-full rounded-md border border-border bg-secondary px-2" value={months} onChange={e => { setMonths(Number(e.target.value)); setResult(''); }}>{PRO_MONTHS.map(m => <option key={m} value={m}>{m === 12 ? '1 year' : `${m} month${m === 1 ? '' : 's'}`}</option>)}</select></label><Button className="w-full" disabled={busy} onClick={async () => { const req = parseRequest(text); if(!req) { setErr('No valid customer request found.'); return; } setBusy(true); setErr(''); try { setResult(await approve(req.userId,req.device,months)); } catch(e) { setErr(e instanceof Error ? e.message : 'Approval failed'); } finally { setBusy(false); } }}>Generate code</Button>{result && <div className="break-all rounded-md border border-border p-2 font-mono text-xs text-primary select-all">{result}</div>}{result && <Button variant="outline" onClick={() => void navigator.clipboard.writeText(result).catch(() => setErr('Select the code to copy it.'))}>Copy code</Button>}{err && <p role="alert" className="text-xs text-destructive">{err}</p>}</div>;
}
