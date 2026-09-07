import type { Control, Vehicle } from "../world/types.ts";
import { approach, clamp } from "../world/math.ts";
export function stepVehicle(v: Vehicle, c: Control, dt: number, slope: number) {
  const dir = c.gear === "D" ? 1 : c.gear === "R" ? -1 : 0;
  // Bicycle model calibrated for an ordinary 2.65 m wheelbase learner car.
  const traction = dir * (c.throttle * 3.4 + (c.throttle < 0.05 ? 0.65 : 0));
  const resistance = 0.14 + 0.005 * v.speed * v.speed;
  let next = v.speed + (traction - 9.81 * slope) * dt;
  const braking = c.brake * 7.5 + (c.handbrake || c.gear === "P" ? 15 : 0);
  next = approach(next, 0, (braking + resistance) * dt);
  if ((c.handbrake || c.gear === "P") && Math.abs(next) < 0.15) next = 0;
  v.speed = clamp(next, -7, 22);
  v.steer = approach(v.steer, c.steer, dt * 8);
  v.yaw -= (v.speed / 2.65) * Math.tan(v.steer * 0.57) * dt;
  v.x += Math.sin(v.yaw) * v.speed * dt;
  v.z += Math.cos(v.yaw) * v.speed * dt;
  v.distance += Math.abs(v.speed) * dt;
  return v;
}
