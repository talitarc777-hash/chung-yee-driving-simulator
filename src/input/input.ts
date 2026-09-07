import { approach, clamp } from "../world/math.ts";
import type { Control, Look } from "../world/types.ts";
export type Action =
  | "throttle"
  | "brake"
  | "left"
  | "right"
  | "handbrake"
  | "lookLeft"
  | "lookRight"
  | "rear"
  | "mirrorLeft"
  | "mirrorRight"
  | "indicatorLeft"
  | "indicatorRight"
  | "cancel"
  | "drive"
  | "reverse"
  | "neutral";
export const DEFAULT_KEYS: Record<Action, string> = {
  throttle: "KeyW",
  brake: "KeyS",
  left: "KeyA",
  right: "KeyD",
  handbrake: "Space",
  lookLeft: "KeyQ",
  lookRight: "KeyE",
  rear: "KeyR",
  mirrorLeft: "Digit1",
  mirrorRight: "Digit2",
  indicatorLeft: "KeyZ",
  indicatorRight: "KeyX",
  cancel: "KeyC",
  drive: "Digit3",
  reverse: "Digit4",
  neutral: "Digit5",
};
export const blankControl = (): Control => ({
  steer: 0,
  throttle: 0,
  brake: 0,
  clutch: 0,
  handbrake: true,
  gear: "D",
  indicator: 0,
  look: "forward",
});
export interface InputDevice {
  read(dt: number, speed: number): Control;
  reset(): void;
}
export interface HapticDevice {
  readonly supported: boolean;
  pulse(strength: number, durationMs: number): Promise<void>;
}
export class NoHaptics implements HapticDevice {
  readonly supported = false;
  async pulse() {}
}
export class KeyboardInput implements InputDevice {
  keys = new Set<string>();
  state = blankControl();
  bindings = { ...DEFAULT_KEYS };
  down(code: string, repeat = false) {
    this.keys.add(code);
    if (repeat) return;
    const b = this.bindings;
    if (code === b.handbrake) this.state.handbrake = !this.state.handbrake;
    if (code === b.indicatorLeft)
      this.state.indicator = this.state.indicator === -1 ? 0 : -1;
    if (code === b.indicatorRight)
      this.state.indicator = this.state.indicator === 1 ? 0 : 1;
    if (code === b.cancel) this.state.indicator = 0;
    if (code === b.drive) this.state.gear = "D";
    if (code === b.reverse) this.state.gear = "R";
    if (code === b.neutral) this.state.gear = "N";
  }
  up(code: string) {
    this.keys.delete(code);
  }
  reset() {
    this.keys.clear();
    this.state = blankControl();
  }
  read(dt: number, speed: number) {
    const b = this.bindings,
      k = this.keys;
    const held = (action: Action, alias = "") =>
      k.has(b[action]) || (!!alias && k.has(alias));
    let steer =
      Number(held("right", "ArrowRight")) - Number(held("left", "ArrowLeft"));
    steer *= clamp(1 - Math.abs(speed) / 32, 0.28, 1);
    this.state.steer = approach(
      this.state.steer,
      steer,
      dt * (steer ? 1.25 : 2.4),
    );
    this.state.throttle = approach(
      this.state.throttle,
      Number(held("throttle", "ArrowUp")),
      dt * 2.5,
    );
    this.state.brake = approach(
      this.state.brake,
      Number(held("brake", "ArrowDown")),
      dt * 4,
    );
    const looks: [Action, Look][] = [
      ["lookLeft", "left"],
      ["lookRight", "right"],
      ["rear", "rear"],
      ["mirrorLeft", "mirrorLeft"],
      ["mirrorRight", "mirrorRight"],
    ];
    this.state.look = looks.find(([a]) => held(a))?.[1] ?? "forward";
    return { ...this.state };
  }
}
export interface AxisBinding {
  kind: "axis" | "button";
  index: number;
  min: number;
  max: number;
  center: number;
  deadzone: number;
  curve: number;
  invert: boolean;
}
export interface Calibration {
  version: 1;
  deviceId: string;
  steering: AxisBinding;
  throttle: AxisBinding;
  brake: AxisBinding;
  clutch?: AxisBinding;
  buttons: Partial<Record<Action, number>>;
}
export interface Pad {
  id: string;
  axes: readonly number[];
  buttons: readonly { value: number; pressed: boolean }[];
  connected: boolean;
}
export function value(p: Pad, b: AxisBinding) {
  return b.kind === "axis"
    ? (p.axes[b.index] ?? 0)
    : (p.buttons[b.index]?.value ?? 0);
}
export function normalize(v: number, b: AxisBinding, steering = false) {
  let n = steering
    ? v >= b.center
      ? (v - b.center) / (b.max - b.center || 1)
      : (v - b.center) / (b.center - b.min || 1)
    : (v - b.min) / (b.max - b.min || 1);
  if (b.invert) n = steering ? -n : 1 - n;
  n = clamp(n, steering ? -1 : 0, 1);
  const sign = Math.sign(n);
  n = Math.max(0, (Math.abs(n) - b.deadzone) / (1 - b.deadzone));
  return sign * n ** b.curve;
}
export function detectBinding(before: Pad, after: Pad): AxisBinding | null {
  const changes = [
    ...after.axes.map((v, i) => ({
      kind: "axis" as const,
      index: i,
      delta: Math.abs(v - (before.axes[i] ?? v)),
      min: before.axes[i] ?? 0,
      max: v,
    })),
    ...after.buttons.map((v, i) => ({
      kind: "button" as const,
      index: i,
      delta: Math.abs(v.value - (before.buttons[i]?.value ?? v.value)),
      min: before.buttons[i]?.value ?? 0,
      max: v.value,
    })),
  ].sort((a, b) => b.delta - a.delta);
  const c = changes[0];
  return c && c.delta > 0.25
    ? {
        kind: c.kind,
        index: c.index,
        min: c.min,
        max: c.max,
        center: 0,
        deadzone: 0.03,
        curve: 1,
        invert: false,
      }
    : null;
}
export class GamepadInput implements InputDevice {
  state = blankControl();
  last = new Set<number>();
  constructor(
    public calibration: Calibration,
    public provider: () => Pad | null,
  ) {}
  reset() {
    this.state = blankControl();
    this.last.clear();
  }
  read(_dt: number, _speed: number) {
    void _dt;
    void _speed;
    const p = this.provider();
    if (!p?.connected) return { ...blankControl(), brake: 1 };
    const c = this.calibration;
    this.state.steer = normalize(value(p, c.steering), c.steering, true);
    this.state.throttle = normalize(value(p, c.throttle), c.throttle);
    this.state.brake = normalize(value(p, c.brake), c.brake);
    this.state.clutch = c.clutch ? normalize(value(p, c.clutch), c.clutch) : 0;
    const held = new Set(p.buttons.flatMap((b, i) => (b.pressed ? [i] : [])));
    const is = (a: Action) =>
      c.buttons[a] !== undefined && held.has(c.buttons[a]!);
    const edge = (a: Action) => is(a) && !this.last.has(c.buttons[a]!);
    if (edge("handbrake")) this.state.handbrake = !this.state.handbrake;
    if (edge("indicatorLeft"))
      this.state.indicator = this.state.indicator === -1 ? 0 : -1;
    if (edge("indicatorRight"))
      this.state.indicator = this.state.indicator === 1 ? 0 : 1;
    if (edge("cancel")) this.state.indicator = 0;
    if (edge("drive")) this.state.gear = "D";
    if (edge("reverse")) this.state.gear = "R";
    if (edge("neutral")) this.state.gear = "N";
    this.state.look = is("lookLeft")
      ? "left"
      : is("lookRight")
        ? "right"
        : is("rear")
          ? "rear"
          : is("mirrorLeft")
            ? "mirrorLeft"
            : is("mirrorRight")
              ? "mirrorRight"
              : "forward";
    this.last = held;
    return { ...this.state };
  }
}

/** Reject conflicting mappings before a wheel can control the vehicle. */
export function validateCalibration(c: Calibration): string | null {
  const channels = new Set<string>();
  for (const [name, b] of [
    ["steering", c.steering],
    ["throttle", c.throttle],
    ["brake", c.brake],
    ...(c.clutch ? [["clutch", c.clutch]] : []),
  ] as [string, AxisBinding][]) {
    if (
      !b ||
      !Number.isInteger(b.index) ||
      b.index < 0 ||
      ![b.min, b.max, b.center, b.deadzone, b.curve].every(Number.isFinite) ||
      Math.abs(b.max - b.min) < 0.25 ||
      b.deadzone < 0 ||
      b.deadzone >= 0.5 ||
      b.curve <= 0
    )
      return `Invalid ${name} calibration.`;
    const key = `${b.kind}:${b.index}`;
    if (channels.has(key))
      return "Steering and each pedal must use a separate input channel.";
    channels.add(key);
    if (
      name === "steering" &&
      (b.kind !== "axis" || b.center <= b.min || b.center >= b.max)
    )
      return "Steering centre must be between both limits.";
  }
  const buttons = new Set<number>();
  for (const index of Object.values(c.buttons)) {
    if (!Number.isInteger(index) || index! < 0 || buttons.has(index!))
      return "Assign a different button to each action.";
    if (channels.has(`button:${index}`))
      return "A pedal button cannot also trigger an action.";
    buttons.add(index!);
  }
  for (const a of [
    "handbrake",
    "indicatorLeft",
    "indicatorRight",
    "lookLeft",
    "lookRight",
    "rear",
  ] as Action[])
    if (c.buttons[a] === undefined) return `Assign ${a} before saving.`;
  return null;
}
