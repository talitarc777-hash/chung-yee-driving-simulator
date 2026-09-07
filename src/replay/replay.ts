import type { Frame, Fault } from "../world/types.ts";
export interface Recording {
  version: 1;
  seed: string;
  mode: string;
  frames: Frame[];
  faults: Fault[];
  completed: boolean;
}
export class Recorder {
  data: Recording;
  constructor(seed: string, mode: string) {
    this.data = {
      version: 1,
      seed,
      mode,
      frames: [],
      faults: [],
      completed: false,
    };
  }
  capture(frame: Frame) {
    if (this.data.frames.length < 18000)
      this.data.frames.push(structuredClone(frame));
  }
  at(t: number) {
    let lo = 0,
      hi = this.data.frames.length - 1;
    while (lo < hi) {
      const m = Math.ceil((lo + hi) / 2);
      if (this.data.frames[m].t <= t) lo = m;
      else hi = m - 1;
    }
    return this.data.frames[lo];
  }
  serialize() {
    return JSON.stringify(this.data);
  }
  static parse(text: string) {
    const d = JSON.parse(text);
    if (
      d.version !== 1 ||
      !Array.isArray(d.frames) ||
      d.frames.length > 18000 ||
      typeof d.seed !== "string"
    )
      throw new Error("Invalid recording");
    return d as Recording;
  }
}
