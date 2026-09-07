export type Point = [number, number, number]; // east, up (HKPD), south, metres
export interface Road {
  id: number;
  name: string;
  tc: string;
  direction: number;
  width: number;
  widthSource: string;
  points: Point[];
  speedLimit: number;
}
export interface WorldData {
  origin: [number, number];
  originWGS84: [number, number];
  roads: Road[];
  surfaces: number[][][];
  buildings: {
    rings: number[][][];
    height: number;
    base: number;
    name: string;
  }[];
  heights: number[][];
  markings: number[][][];
  metadata: Record<string, unknown>;
}
export type Look =
  "forward" | "left" | "right" | "rear" | "mirrorLeft" | "mirrorRight";
export interface Control {
  steer: number;
  throttle: number;
  brake: number;
  clutch: number;
  handbrake: boolean;
  gear: "D" | "N" | "R" | "P";
  indicator: -1 | 0 | 1;
  look: Look;
}
export interface Vehicle {
  x: number;
  y: number;
  z: number;
  yaw: number;
  speed: number;
  steer: number;
  distance: number;
}
export interface Actor {
  id: number;
  x: number;
  y: number;
  z: number;
  yaw: number;
  speed: number;
  kind: "car" | "van" | "pedestrian";
  parked: boolean;
}
export interface Frame {
  t: number;
  vehicle: Vehicle;
  control: Control;
  actors: Actor[];
  light: "red" | "amber" | "green";
}
export interface Fault {
  id: string;
  t: number;
  item: number;
  severity: "minor" | "serious";
  tc: string;
  en: string;
  evidence: string;
  correction: string;
  x: number;
  z: number;
  heuristic: boolean;
}
