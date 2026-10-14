declare module "soundtouchjs" {
  export class SoundTouch { tempo: number; pitchSemitones: number; }
  export class SimpleFilter {
    constructor(source: { extract(target: Float32Array, count: number, position: number): number }, pipe: SoundTouch);
    extract(target: Float32Array, frames: number): number;
  }
}