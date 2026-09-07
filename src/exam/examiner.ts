import type { Fault, Frame, Look } from "../world/types.ts";
import policy from "../../data/exam_rules/policy.json" with { type: "json" };
export const THRESHOLDS = {
  ...policy.simulatorHeuristics,
  repeatMinor: policy.officialPolicy.minorFaultsSameItemToEscalate,
};
export class Examiner {
  faults: Fault[] = [];
  observations: Partial<Record<Look, number>> = {};
  dwell = 0;
  lastLook: Look = "forward";
  seen = new Set<string>();
  speedTime = 0;
  speedEpisode = 0;
  speedActive = false;
  moved = false;
  observe(f: Frame, dt: number) {
    if (f.control.look === this.lastLook) this.dwell += dt;
    else {
      this.lastLook = f.control.look;
      this.dwell = 0;
    }
    if (this.dwell >= THRESHOLDS.observationDwell)
      this.observations[f.control.look] = f.t;
  }
  recent(look: Look, t: number) {
    return (
      this.observations[look] !== undefined &&
      t - this.observations[look]! <= THRESHOLDS.observationWindow
    );
  }
  add(
    f: Frame,
    item: number,
    key: string,
    severity: "minor" | "serious",
    tc: string,
    en: string,
    evidence: string,
    correction: string,
  ) {
    if (this.seen.has(key)) return;
    this.seen.add(key);
    const repeats = this.faults.filter(
      (x) => x.item === item && x.severity === "minor",
    ).length;
    if (severity === "minor" && repeats >= THRESHOLDS.repeatMinor - 1)
      severity = "serious";
    this.faults.push({
      id: key,
      t: f.t,
      item,
      severity,
      tc,
      en,
      evidence,
      correction,
      x: f.vehicle.x,
      z: f.vehicle.z,
      heuristic: true,
    });
  }
  update(f: Frame, dt: number, speedLimit: number) {
    this.observe(f, dt);
    if (!this.moved && Math.abs(f.vehicle.speed) > 0.6) {
      this.moved = true;
      if (!this.recent("right", f.t) || !this.recent("rear", f.t))
        this.add(
          f,
          21,
          "move-observation",
          "minor",
          "開行前未充分觀察",
          "Incomplete observation before moving off",
          `Look actions within ${THRESHOLDS.observationWindow}s: ${JSON.stringify(this.observations)}`,
          "Check mirrors and the relevant blind spot before moving off.",
        );
      if (!f.control.indicator)
        this.add(
          f,
          39,
          "move-signal",
          "minor",
          "開行前未發出訊號",
          "No signal before moving off",
          "Indicator was off when the vehicle moved.",
          "Signal when it would help other road users; check it is safe before moving.",
        );
    }
    if (Math.abs(f.vehicle.speed) * 3.6 > speedLimit + THRESHOLDS.speedGrace)
      this.speedTime += dt;
    else {
      this.speedTime = 0;
      if (this.speedActive) this.speedEpisode++;
      this.speedActive = false;
    }
    if (this.speedTime > THRESHOLDS.speedDuration) {
      this.speedActive = true;
      this.add(
        f,
        35,
        `speed-${this.speedEpisode}`,
        "serious",
        "超過限制速度",
        "Speed limit exceeded",
        `${(f.vehicle.speed * 3.6).toFixed(1)} km/h, limit ${speedLimit} km/h`,
        "Observe the posted limit and adjust speed to road and traffic conditions.",
      );
    }
  }
  junction(f: Frame, id: string) {
    if (!this.recent("left", f.t) || !this.recent("right", f.t))
      this.add(
        f,
        58,
        `junction-${id}`,
        "minor",
        "路口觀察不足",
        "Incomplete junction observation",
        "A deliberate left and right look was not recorded in the preceding five seconds.",
        "Slow down and check the relevant approaches before entering.",
      );
  }
  result(completed: boolean) {
    return !completed
      ? "incomplete"
      : this.faults.some((f) => f.severity === "serious")
        ? "fail"
        : "pass";
  }
}
