import { ChevronDown, Rows2, Rows3, Minus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import { useDjSettings } from "@/hooks/useDjSettings";

export function WaveformOptions({ topVisible, onTopVisible }: { topVisible?: boolean; onTopVisible?: (visible: boolean) => void }) {
  const [settings, update] = useDjSettings();
  return <Popover>
    <PopoverTrigger asChild><Button variant="ghost" size="icon" className="dj-glass size-7 rounded-md" aria-label="Waveform settings"><ChevronDown /></Button></PopoverTrigger>
    <PopoverContent className="wave-options reference-menu w-72 max-h-[80dvh] overflow-y-auto rounded-lg p-4" side="bottom" align="start">
      <h2 className="mb-4 text-base font-semibold">Waveforms</h2>
      <div className="space-y-4">
        {onTopVisible && <label className="flex items-center justify-between text-sm">Top waveforms<Switch aria-label="Show top waveforms" checked={topVisible} onCheckedChange={onTopVisible} /></label>}
        <label className="flex items-center justify-between text-sm">Scratch<Switch checked={settings.waveScratch} onCheckedChange={waveScratch => update({ waveScratch })} /></label>
         <label className="flex items-center justify-between text-sm">Slip<Switch checked={settings.waveSlip} onCheckedChange={waveSlip => update({ waveSlip })} /></label>
        <label className="flex items-center justify-between text-sm">High contrast<Switch checked={settings.waveHighContrast} onCheckedChange={waveHighContrast => update({ waveHighContrast })} /></label>
        <label className="block text-sm">Direction<select className="mt-2 w-full rounded-md border border-border bg-secondary p-2" value={settings.waveOrientation} onChange={event => update({ waveOrientation: event.target.value === "horizontal" ? "horizontal" : "vertical" })}><option value="vertical">Vertical</option><option value="horizontal">Horizontal</option></select></label>
        <label className="block text-sm">Spectrum<select aria-label="Waveform spectrum" className="mt-2 w-full rounded-md border border-border bg-secondary p-2" value={settings.waveColor} onChange={e => update({ waveColor: e.target.value })}><option value="rgb3">Full RGB spectrum</option><option value="beat">Beat blocks (Serato style)</option><option value="zigzag">Zigzag when zoomed</option><option value="bars">Spectrum bars</option><option value="all">Original multicolor</option><option value="blue">Blue</option></select></label>
        <div className="text-xs text-muted-foreground">mix4deejays tracks</div><div className="grid grid-cols-3 gap-1">{([1, 2, 3] as const).map((n) => <Button key={n} variant={settings.waveTracks === n ? "default" : "secondary"} aria-label={`${n} waveform lanes`} aria-pressed={settings.waveTracks === n} onClick={() => update({ waveTracks: n })}>{n === 1 ? <Minus /> : n === 2 ? <Rows2 /> : <Rows3 />}</Button>)}</div>
        <label className="block text-sm">Zoom · {settings.waveZoom.toFixed(1)}×<input aria-label="Waveform zoom" type="range" min={0.25} max={4} step={0.25} value={settings.waveZoom} onChange={e => update({ waveZoom: Number(e.target.value) })} className="mt-2 w-full accent-primary" /></label>
      </div>
    </PopoverContent>
  </Popover>;
}