import { useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import logoAsset from "@/assets/mix4deejays-logo.jpg.asset.json";
import splash from "@/assets/djogwheels-splash-clean.jpg";
import { AccountPanel } from "./AccountPanel";
import { whatsappPayUrl, PRICE_KES } from "@/lib/dj/license";

/**
 * Original artwork → optional payment + login. Entering the mixer is only via Skip.
 */
export function Splash({ onDone }: { onDone: () => void }) {
  const [phase, setPhase] = useState<"splash" | "offer">("splash");

  return (
    <div className="fixed inset-0 z-[100] bg-background dark overflow-hidden">
      <img
        src={splash}
        alt="DJ splash artwork designed by VdjRaph"
        className="splash-art absolute inset-0 w-full h-full object-cover"
      />
      <div className="splash-sheen pointer-events-none absolute inset-0" />
      <img src={logoAsset.url} alt="mix4deejays" className="splash-logo absolute left-4 top-4 h-16 w-16 rounded-md object-contain" />
      {phase === "splash" && <Button onClick={() => setPhase("offer")} className="splash-next absolute bottom-[12%] right-[7%] min-w-28 border border-border bg-background/60 text-foreground shadow-lg backdrop-blur-md hover:bg-background" aria-label="Next to pricing">Next</Button>}

      {phase === "offer" && (
        <div className="pricing-rainbow absolute inset-0 flex justify-center overflow-y-auto p-3">
          <div className="pricing-glass relative my-auto w-full max-w-[420px] rounded-2xl p-4">
            <Button variant="ghost" size="icon"
              onClick={onDone}
              aria-label="Continue without subscribing"
              className="absolute top-2 right-2 text-muted-foreground"
            >
              <X className="h-4 w-4" />
            </Button>

            <div className="text-sm font-semibold">Unlock mix4deejays PRO</div>
            <div className="text-[11px] text-muted-foreground mt-0.5">
              Real stems separation · video recording · custom watermark · full FX packs
            </div>
            <div className="mt-2 rounded-xl border border-primary/60 bg-primary/10 p-3">
              <div className="text-sm font-bold uppercase tracking-widest">PRO — <span className="text-primary">{PRICE_KES} KES / month</span></div>
              <ul className="mt-1 space-y-0.5 text-[11px] text-muted-foreground">
                <li>• Custom logo watermark on video</li>
                <li>• Record video (360p–1080p) and MP3/WAV audio</li>
                <li>• Real AI stems separation</li>
              </ul>
              <a href={whatsappPayUrl()} target="_blank" rel="noreferrer" className="mt-2 block">
                <Button className="w-full">Pay on WhatsApp</Button>
              </a>
            </div>

            <div className="mt-3">
              <AccountPanel />
            </div>

            <Button
              onClick={onDone}
              variant="outline"
              className="mt-3 w-full h-11 text-sm font-semibold"
            >
              Continue with the free version
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
