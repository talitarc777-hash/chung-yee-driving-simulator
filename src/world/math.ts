import type { Point, Road } from "./types.ts";
export const clamp = (v: number, a: number, b: number) =>
  Math.min(b, Math.max(a, v));
export const approach = (v: number, target: number, step: number) =>
  v + clamp(target - v, -step, step);
export const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));
export function local(
  e: number,
  n: number,
  h: number,
  origin: [number, number],
): Point {
  return [e - origin[0], h, origin[1] - n];
}
export function geographic(p: Point, origin: [number, number]) {
  return [origin[0] + p[0], origin[1] - p[2], p[1]];
}
export function seeded(seed: string) {
  let h = 2166136261;
  for (const c of seed) {
    h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  }
  return () => {
    h += 0x6d2b79f5;
    let t = h;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function project(x: number, z: number, a: Point, b: Point) {
  const dx = b[0] - a[0],
    dz = b[2] - a[2],
    l2 = dx * dx + dz * dz;
  const t = l2 ? clamp(((x - a[0]) * dx + (z - a[2]) * dz) / l2, 0, 1) : 0;
  const px = a[0] + dx * t,
    pz = a[2] + dz * t;
  return {
    t,
    x: px,
    z: pz,
    y: a[1] + (b[1] - a[1]) * t,
    d: Math.hypot(x - px, z - pz),
    yaw: Math.atan2(dx, dz),
    side: ((x - px) * dz - (z - pz) * dx) / Math.sqrt(l2 || 1),
    slope: (b[1] - a[1]) / Math.sqrt(l2 || 1),
  };
}
export function nearestRoad(x: number, z: number, roads: Road[]) {
  let best: {
    road: Road;
    segment: number;
    hit: ReturnType<typeof project>;
  } | null = null;
  for (const road of roads)
    for (let i = 1; i < road.points.length; i++) {
      const hit = project(x, z, road.points[i - 1], road.points[i]);
      if (!best || hit.d < best.hit.d) best = { road, segment: i, hit };
    }
  return best!;
}
export function pointInRing(x: number, z: number, ring: number[][]) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i],
      b = ring[j];
    if (
      a[1] > z !== b[1] > z &&
      x < ((b[0] - a[0]) * (z - a[1])) / (b[1] - a[1]) + a[0]
    )
      inside = !inside;
  }
  return inside;
}
