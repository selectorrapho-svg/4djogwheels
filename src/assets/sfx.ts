import s1 from "./sfx/AMZAZING_LASER.mp3.asset.json";
import s2 from "./sfx/BOMB_LASER_2.mp3.asset.json";
import s3 from "./sfx/FAIYAAA.mp3.asset.json";
import s4 from "./sfx/LASER_INGINE_KALI.mp3.asset.json";
import s5 from "./sfx/PIPOPIPO_HORN.mp3.asset.json";
import s6 from "./sfx/RAISE_IT_HORN.mp3.asset.json";

export interface SamplePad {
  label: string;
  url: string;
  color: string;
}

export const SFX_PACK: SamplePad[] = [
  { label: "Laser", url: s1.url, color: "#ff3b3b" },
  { label: "Bomb", url: s2.url, color: "#ffcf3b" },
  { label: "Faiyaaa", url: s3.url, color: "#ff7a3b" },
  { label: "Kali", url: s4.url, color: "#3bff8a" },
  { label: "Pipo", url: s5.url, color: "#3bd2ff" },
  { label: "Raise", url: s6.url, color: "#a83bff" },
];
