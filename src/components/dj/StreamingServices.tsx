import { Music2, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";

const services = [
  ["Spotify", "https://www.spotify.com"],
  ["Apple Music", "https://music.apple.com"],
  ["TIDAL", "https://tidal.com"],
  ["SoundCloud", "https://soundcloud.com"],
  ["Beatport", "https://www.beatport.com"],
  ["Beatsource", "https://www.beatsource.com"],
] as const;

export function StreamingServices() {
  return <div className="px-4"><h3 className="mb-3 text-sm text-muted-foreground">DJ playback connections unavailable</h3>{services.map(([name, url]) => <div key={name} className="flex items-center gap-3 border-b border-border py-3"><Music2 className="size-5 text-muted-foreground" /><div className="min-w-0 flex-1"><span className="block font-medium">{name}</span><span className="text-xs text-muted-foreground">Not connected · playback unavailable</span></div><Button variant="ghost" size="icon" asChild><a href={url} target="_blank" rel="noopener noreferrer" aria-label={`Visit ${name}`}><ExternalLink className="size-4" /></a></Button></div>)}</div>;
}