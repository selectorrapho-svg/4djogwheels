import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  useLicense, signUp, logIn, logOut, redeem, approve, parseRequest, issuedDevices,
  whatsappPayUrl, requestCode, PRICE_KES, MAX_DEVICES, ADMIN_WHATSAPP,
} from "@/lib/dj/license";

/** Settings > Account: login, Pro status, WhatsApp payment and admin approvals. */
export function AccountPanel() {
  const lic = useLicense();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [pass, setPass] = useState("");
  const [code, setCode] = useState("");
  const [msg, setMsg] = useState("");
  const run = (fn: () => Promise<void>) => fn().then(() => setMsg("")).catch((e: Error) => setMsg(e.message));

  if (!lic.user) {
    return (
      <div className="space-y-2">
        <div className="grid grid-cols-2 gap-1">
          <Button variant={mode === "login" ? "default" : "ghost"} onClick={() => setMode("login")}>Log in</Button>
          <Button variant={mode === "signup" ? "default" : "ghost"} onClick={() => setMode("signup")}>Create account</Button>
        </div>
        <Input inputMode="tel" placeholder="Phone number" value={phone} onChange={(e) => setPhone(e.target.value)} />
        {mode === "signup" && <Input placeholder="Your name" value={name} onChange={(e) => setName(e.target.value)} />}
        <Input type="password" placeholder="Password" value={pass} onChange={(e) => setPass(e.target.value)} />
        <Button className="w-full" onClick={() => run(() => (mode === "login" ? logIn(phone, pass) : signUp(phone, name, pass)))}>
          {mode === "login" ? "Log in" : "Create account"}
        </Button>
        {msg && <p role="alert" className="text-xs text-destructive">{msg}</p>}
      </div>
    );
  }

  return (
    <div className="space-y-3 text-sm">
      <div className="flex items-center justify-between">
        <div>
          <div className="font-semibold">{lic.user.name}</div>
          <div className="text-xs text-muted-foreground">{lic.user.phone}</div>
        </div>
        <Button variant="outline" size="sm" onClick={logOut}>Log out</Button>
      </div>
      <div className={`rounded-xl border p-3 ${lic.isPro ? "border-primary/60 bg-primary/10" : "border-border bg-secondary/50"}`}>
        <div className="font-semibold">{lic.isAdmin ? "Admin · all Pro features" : lic.isPro ? "PRO active" : "Free version"}</div>
        <div className="text-xs text-muted-foreground">
          {lic.isPro && lic.proUntil ? `Until ${new Date(lic.proUntil).toLocaleDateString()}` : !lic.isPro ? "No custom video logo, no video recording, no AI stems. Beat removal works." : ""}
        </div>
      </div>

      {!lic.isPro && (
        <div className="space-y-2">
          <a href={whatsappPayUrl()} target="_blank" rel="noreferrer" className="block">
            <Button className="w-full">Pay {PRICE_KES} KES / month on WhatsApp</Button>
          </a>
          <p className="text-[11px] text-muted-foreground">Your request code: <span className="font-mono text-foreground">{requestCode()}</span>. After payment the admin sends you an unlock code.</p>
          <div className="flex gap-2">
            <Input placeholder="PRO-XXXX-XXXXXXXXXX" value={code} onChange={(e) => setCode(e.target.value)} />
            <Button onClick={() => run(() => redeem(code))}>Unlock</Button>
          </div>
        </div>
      )}
      {msg && <p role="alert" className="text-xs text-destructive">{msg}</p>}
      {lic.isAdmin && <AdminApprovals />}
    </div>
  );
}

function AdminApprovals() {
  const [text, setText] = useState("");
  const [req, setReq] = useState<{ phone: string; device: string } | null>(null);
  const [result, setResult] = useState("");
  const [err, setErr] = useState("");
  return (
    <div className="space-y-2 rounded-xl border border-border p-3">
      <div className="font-semibold">Approve payments</div>
      <p className="text-[11px] text-muted-foreground">Paste the customer's WhatsApp message.</p>
      <textarea className="h-20 w-full rounded-md border border-border bg-secondary p-2 text-xs" value={text} onChange={(e) => setText(e.target.value)} />
      <Button className="w-full" onClick={() => { setErr(""); setResult(""); const r = parseRequest(text); if (r) setReq(r); else setErr("No request code found."); }}>Review request</Button>
      {err && <p className="text-xs text-destructive">{err}</p>}
      {result && (
        <div className="space-y-1 text-xs">
          Unlock code: <span className="font-mono text-primary select-all">{result}</span>
          <a className="block text-primary underline" target="_blank" rel="noreferrer" href={`https://wa.me/${req ? "254" + req.phone.slice(1) : ADMIN_WHATSAPP}?text=${encodeURIComponent("Your djogwheels PRO unlock code: " + result)}`}>Send on WhatsApp</a>
        </div>
      )}
      {req && !result && (
        <div className="fixed inset-0 z-[400] grid place-items-center bg-background/70 p-4 backdrop-blur" role="dialog" aria-label="Approve payment">
          <div className="w-full max-w-xs rounded-2xl border border-border bg-popover p-4 shadow-2xl">
            <div className="font-semibold">Approve PRO?</div>
            <div className="mt-1 text-xs text-muted-foreground">Phone {req.phone} · device {req.device}</div>
            <div className="text-xs text-muted-foreground">Phones active: {issuedDevices(req.phone).length}/{MAX_DEVICES}</div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <Button variant="outline" onClick={() => setReq(null)}>Cancel</Button>
              <Button onClick={() => approve(req.phone, req.device).then(setResult).catch((e: Error) => { setErr(e.message); setReq(null); })}>Approve</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
