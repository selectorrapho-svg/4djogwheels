import { useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { useLicense, signUp, logIn, logOut, redeem, approvePhone, verifyPhone, whatsappPayUrl, PRICE_KES } from '@/lib/dj/license';
import { authPhone, SUBSCRIPTION_MONTHS, subscriptionExpiry } from '@/lib/dj/phoneRules';
export function AccountPanel() {
  const lic = useLicense(), queryClient = useQueryClient(), navigate = useNavigate();
  const [mode,setMode] = useState<'login'|'signup'>('login');
  const [phone,setPhone] = useState(''), [name,setName] = useState(''), [pass,setPass] = useState(''), [code,setCode] = useState(''), [msg,setMsg] = useState(''), [busy,setBusy] = useState(false);
  const [verify, setVerify] = useState(false), [otp, setOtp] = useState('');
  const run = async (fn: () => Promise<unknown>, success = '') => { setBusy(true); setMsg(''); try { await fn(); setMsg(success); setPass(''); } catch(e) { setMsg(e instanceof Error ? e.message : 'Please try again.'); } finally { setBusy(false); } };
  if (lic.loading) return <p role="status" className="text-sm text-muted-foreground">Checking account…</p>;
  if (!lic.user) return <div className="space-y-3">
    <div className="grid grid-cols-2 gap-1"><Button variant={mode === 'login' ? 'default' : 'ghost'} onClick={() => setMode('login')}>Log in</Button><Button variant={mode === 'signup' ? 'default' : 'ghost'} onClick={() => setMode('signup')}>Create account</Button></div>
    <form className="space-y-2" onSubmit={e => { e.preventDefault(); void run(async () => { if (mode === 'login') await logIn(phone,pass); else { await signUp(phone,name,pass); setVerify(true); } }, mode === 'signup' ? 'Enter the verification code sent to your phone.' : ''); }}>
      <Input name="phone" aria-label="Phone number" type="tel" autoComplete="username" placeholder="Phone number" required maxLength={20} value={phone} onChange={e => setPhone(e.target.value)} />
      {mode === 'signup' && <Input name="name" aria-label="Your name" autoComplete="name" placeholder="Your name" required maxLength={60} value={name} onChange={e => setName(e.target.value)} />}
      <Input name="password" aria-label="Password" type="password" autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} minLength={8} required placeholder="Password" value={pass} onChange={e => setPass(e.target.value)} />
      <Button type="submit" disabled={busy} className="w-full">{busy ? 'Please wait…' : mode === 'login' ? 'Log in' : 'Create account'}</Button>
    </form>
    {mode === 'login' && <Button variant="ghost" disabled={busy || !phone} onClick={() => void run(async () => { const { error } = await supabase.auth.signInWithOtp({ phone: authPhone(phone), options: { shouldCreateUser: false } }); if(error) throw error; setVerify(true); }, 'Enter the SMS code to recover account access.')}>Recover account by SMS</Button>}
    {verify && <form className="flex gap-2" onSubmit={e => { e.preventDefault(); void run(() => verifyPhone(phone,otp)); }}><Input aria-label="SMS verification code" autoComplete="one-time-code" inputMode="numeric" required value={otp} onChange={e => setOtp(e.target.value)} /><Button disabled={busy} type="submit">Verify</Button></form>}
    {msg && <p role="status" className="text-xs text-foreground">{msg}</p>}
  </div>;
  return <div className="space-y-3 text-sm">
    <div className="flex items-center justify-between gap-2"><div className="min-w-0"><div className="truncate font-semibold">{lic.user.name}</div><div className="truncate text-xs text-muted-foreground">{lic.user.email || lic.user.phone}</div></div><Button variant="outline" size="sm" disabled={busy} onClick={() => void run(async () => { await queryClient.cancelQueries(); queryClient.clear(); await logOut(); await navigate({ to: '/auth', replace: true }); })}>Log out</Button></div>
    <div className="rounded-lg border border-border bg-secondary/50 p-3"><div className="font-semibold">{lic.isAdmin ? 'Admin · PRO' : lic.isPro ? 'PRO active' : 'Free version'}</div><div className="text-xs text-muted-foreground">{lic.proUntil ? `Until ${new Date(lic.proUntil).toLocaleDateString()}` : lic.isAdmin ? 'All Pro features' : 'Studio, AI stems and recording require PRO.'}</div></div>
    {!lic.isAdmin && <><a href={whatsappPayUrl()} target="_blank" rel="noreferrer"><Button className="w-full">Pay {PRICE_KES} KES / month on WhatsApp</Button></a><form className="flex gap-2" onSubmit={e => { e.preventDefault(); void run(() => redeem(code), 'PRO activated.'); }}><Input aria-label="Pro access code" placeholder="PRO access code" required value={code} onChange={e => setCode(e.target.value)} /><Button disabled={busy} type="submit">Unlock</Button></form></>}
    {msg && <p role="status" className="text-xs text-foreground">{msg}</p>}
    {lic.isAdmin && <AdminApprovals />}
  </div>;
}
function AdminApprovals() {
  const [phone,setPhone] = useState(''), [months,setMonths] = useState(1), [result,setResult] = useState(''), [err,setErr] = useState(''), [busy,setBusy] = useState(false);
  const [expiry,setExpiry] = useState(() => subscriptionExpiry(new Date(),1).toISOString().slice(0,10));
  return <div className="space-y-2 border-t border-border pt-3"><h3 className="font-semibold">Generate PRO access code</h3><Input type="tel" aria-label="Customer phone" placeholder="Customer phone number" value={phone} onChange={e => { setPhone(e.target.value); setResult(''); }} /><label className="block text-xs">Subscription<select aria-label="Pro duration" className="mt-1 h-10 w-full rounded-md border border-border bg-secondary px-2" value={months} onChange={e => { const m = Number(e.target.value); setMonths(m); setExpiry(subscriptionExpiry(new Date(),m).toISOString().slice(0,10)); setResult(''); }}>{SUBSCRIPTION_MONTHS.map(m => <option key={m} value={m}>{m === 12 ? '1 year' : `${m} month${m === 1 ? '' : 's'}`}</option>)}</select></label><label className="block text-xs">Expiry date<Input type="date" aria-label="Code expiry date" required value={expiry} onChange={e => { setExpiry(e.target.value); setResult(''); }} /></label><Button className="w-full" disabled={busy || !phone || !expiry} onClick={async () => { setBusy(true); setErr(''); try { setResult(await approvePhone(phone,new Date(`${expiry}T23:59:59Z`).toISOString())); } catch(e) { setErr(e instanceof Error ? e.message : 'Approval failed'); } finally { setBusy(false); } }}>Generate code · 2 devices</Button>{result && <div className="break-all rounded-md border border-border p-2 font-mono text-xs text-primary select-all">{result}</div>}{result && <Button variant="outline" onClick={() => void navigator.clipboard.writeText(result).catch(() => setErr('Select the code to copy it.'))}>Copy code</Button>}{err && <p role="alert" className="text-xs text-destructive">{err}</p>}</div>;
}
