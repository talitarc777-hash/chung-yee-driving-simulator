import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  KeyboardInput,
  GamepadInput,
  validateCalibration,
  normalize,
  detectBinding,
  blankControl,
} from "../../src/input/input.ts";
import {
  local,
  geographic,
  seeded,
  nearestRoad,
  pointInRing,
} from "../../src/world/math.ts";
import { stepVehicle } from "../../src/vehicle/vehicle.ts";
import { Examiner } from "../../src/exam/examiner.ts";
import { Recorder } from "../../src/replay/replay.ts";
const axis = (min = -1, max = 1, center = 0) => ({
  kind: "axis",
  index: 0,
  min,
  max,
  center,
  deadzone: 0.03,
  curve: 1,
  invert: false,
});
const vehicle = () => ({
  x: 0,
  y: 10,
  z: 0,
  yaw: 0,
  speed: 0,
  steer: 0,
  distance: 0,
});
const frame = (t = 0) => ({
  t,
  vehicle: vehicle(),
  control: blankControl(),
  actors: [],
  light: "green",
});
test("HK1980 local conversion round-trips and south is positive z", () => {
  const origin = [836720, 819145];
  const p = local(836730, 819140, 53, origin);
  assert.deepEqual(p, [10, 53, 5]);
  assert.deepEqual(geographic(p, origin), [836730, 819140, 53]);
});
test("steering normalizes asymmetric limits and deadzone", () => {
  const b = axis(-0.8, 0.95, 0.05);
  assert.equal(normalize(-0.8, b, true), -1);
  assert.equal(normalize(0.95, b, true), 1);
  assert.equal(normalize(0.06, b, true), 0);
  assert.equal(normalize(-0.8, { ...b, invert: true }, true), 1);
});
test("descending pedal axes release to zero and press to one", () => {
  const b = axis(1, -1);
  assert.equal(normalize(1, b), 0);
  assert.equal(normalize(-1, b), 1);
  assert.ok(normalize(0, b) > 0.45);
});
test("calibration discovers a nonstandard pedal index", () => {
  const a = {
    id: "G923 fixture",
    connected: true,
    axes: [0, 0, 1, 0],
    buttons: [],
  };
  const b = { ...a, axes: [0, 0, -1, 0] };
  const c = detectBinding(a, b);
  assert.equal(c.index, 2);
  assert.equal(normalize(-1, c), 1);
  assert.equal(detectBinding(a, a), null);
});
test("keyboard steering is progressive and returns to centre", () => {
  const k = new KeyboardInput();
  k.down("KeyD");
  const first = k.read(1 / 60, 0).steer;
  assert.ok(first > 0 && first < 0.1);
  for (let i = 0; i < 60; i++) k.read(1 / 60, 0);
  assert.equal(k.state.steer, 1);
  k.up("KeyD");
  for (let i = 0; i < 60; i++) k.read(1 / 60, 0);
  assert.equal(k.state.steer, 0);
});
test("right steering turns toward negative yaw in east-up-south coordinates", () => {
  const v = vehicle();
  v.speed = 4;
  stepVehicle(v, { ...blankControl(), handbrake: false, steer: 1 }, 0.2, 0);
  assert.ok(v.yaw < 0);
  assert.ok(v.x < 0);
});
test("handbrake holds on a 12 percent hill and service brake stops forward motion", () => {
  const v = vehicle();
  for (let i = 0; i < 300; i++) stepVehicle(v, blankControl(), 1 / 60, 0.12);
  assert.equal(v.speed, 0);
  assert.equal(v.distance, 0);
  v.speed = 10;
  for (let i = 0; i < 300; i++)
    stepVehicle(
      v,
      { ...blankControl(), handbrake: false, brake: 1, gear: "N" },
      1 / 60,
      0,
    );
  assert.equal(v.speed, 0);
});
test("neutral rolls back uphill; reverse applies reverse traction", () => {
  const v = vehicle();
  for (let i = 0; i < 60; i++)
    stepVehicle(
      v,
      { ...blankControl(), gear: "N", handbrake: false },
      1 / 60,
      0.08,
    );
  assert.ok(v.speed < 0);
  const r = vehicle();
  for (let i = 0; i < 60; i++)
    stepVehicle(
      r,
      { ...blankControl(), gear: "R", throttle: 1, handbrake: false },
      1 / 60,
      0,
    );
  assert.ok(r.speed < 0);
});
test("Gamepad safety fallback applies brake on disconnection", () => {
  const b = axis(),
    cal = {
      version: 1,
      deviceId: "fixture",
      steering: b,
      throttle: { ...b, index: 1 },
      brake: { ...b, index: 2 },
      buttons: {},
    };
  const input = new GamepadInput(cal, () => null);
  assert.equal(input.read(1 / 60, 5).brake, 1);
  assert.equal(input.read(1 / 60, 5).throttle, 0);
});
test("two representative G923 layouts drive through the same abstraction", () => {
  for (const layout of [
    [0, 1, 2],
    [2, 3, 1],
  ]) {
    let pad = {
      id: "G923 simulated fixture",
      connected: true,
      axes: [0, 0, 0, 0],
      buttons: [{ value: 0, pressed: false }],
    };
    const [s, t, b] = layout;
    const cal = {
      version: 1,
      deviceId: pad.id,
      steering: { ...axis(), index: s },
      throttle: { ...axis(1, -1), index: t },
      brake: { ...axis(1, -1), index: b },
      buttons: { handbrake: 0 },
    };
    pad.axes[t] = -1;
    pad.axes[b] = 1;
    const input = new GamepadInput(cal, () => pad);
    pad.buttons[0] = { value: 1, pressed: true };
    const c = input.read(1 / 60, 0);
    assert.equal(c.handbrake, false);
    assert.equal(c.throttle, 1);
    assert.equal(c.brake, 0);
    assert.equal(input.read(1 / 60, 0).handbrake, false);
  }
});
test("look actions require dwell and expire independently of steering", () => {
  const e = new Examiner(),
    f = frame();
  f.control.look = "right";
  e.observe(f, 0.1);
  assert.equal(e.recent("right", 0), false);
  for (let i = 0; i < 8; i++) {
    f.t += 0.1;
    e.observe(f, 0.1);
  }
  assert.equal(e.recent("right", f.t), true);
  assert.equal(e.recent("right", 7), false);
  assert.equal(e.recent("left", f.t), false);
});
test("three separate minor faults for one item escalate once; identical event deduplicates", () => {
  const e = new Examiner(),
    f = frame();
  for (let i = 0; i < 3; i++)
    e.add(
      f,
      58,
      "j" + i,
      "minor",
      "路口",
      "Junction",
      "evidence",
      "correction",
    );
  e.add(f, 58, "j2", "minor", "路口", "Junction", "evidence", "correction");
  assert.deepEqual(
    e.faults.map((x) => x.severity),
    ["minor", "minor", "serious"],
  );
  assert.equal(e.result(true), "fail");
  assert.equal(e.result(false), "incomplete");
});
test("exam start creates evidence and never grants pass for an unfinished session", () => {
  const e = new Examiner(),
    f = frame(2);
  f.vehicle.speed = 1;
  e.update(f, 1 / 60, 50);
  assert.equal(e.faults.length, 2);
  assert.equal(e.result(false), "incomplete");
});
test("replay captures independent snapshots and seeks deterministically", () => {
  const r = new Recorder("a", "exam"),
    f = frame();
  for (let i = 0; i < 20; i++) {
    f.t = i / 10;
    f.vehicle.x = i;
    r.capture(f);
  }
  f.vehicle.x = 999;
  assert.equal(r.at(0.55).vehicle.x, 5);
  assert.equal(r.data.frames[0].vehicle.x, 0);
  const d = Recorder.parse(r.serialize());
  assert.equal(d.frames.length, 20);
  assert.throws(() => Recorder.parse("{}"));
});
test("randomized conditions reproduce the same seed", () => {
  const a = seeded("HK-0042"),
    b = seeded("HK-0042"),
    c = seeded("HK-other");
  const aa = Array.from({ length: 30 }, a);
  assert.deepEqual(aa, Array.from({ length: 30 }, b));
  assert.notDeepEqual(aa, Array.from({ length: 30 }, c));
});
test("official road asset has finite metre coordinates, correct source IDs and real buildings", () => {
  const w = JSON.parse(
    readFileSync(new URL("../../public/data/world.json", import.meta.url)),
  );
  assert.equal(w.origin[0], 836720);
  assert.ok(w.buildings.length > 200);
  const r = w.roads.find((r) => r.id === 35685);
  assert.equal(r.name, "CHUNG YEE STREET");
  assert.ok(r.points.length > 30);
  for (const road of w.roads)
    for (const p of road.points) assert.ok(p.every(Number.isFinite));
  const hit = nearestRoad(r.points[10][0], r.points[10][2], w.roads);
  assert.ok(hit.hit.d < 0.001);
  assert.equal(hit.road.id, 35685);
  assert.equal(
    pointInRing(0, 0, [
      [-1, -1],
      [1, -1],
      [1, 1],
      [-1, 1],
    ]),
    true,
  );
});

test("a continuous speeding episode creates one fault, with a new fault only after recovery", () => {
  const e = new Examiner(),
    f = frame();
  f.vehicle.speed = 20;
  for (let i = 0; i < 1800; i++) {
    f.t = i / 60;
    e.update(f, 1 / 60, 50);
  }
  assert.equal(e.faults.filter((x) => x.item === 35).length, 1);
  f.vehicle.speed = 0;
  e.update(f, 1 / 60, 50);
  f.vehicle.speed = 20;
  for (let i = 0; i < 180; i++) {
    f.t += 1 / 60;
    e.update(f, 1 / 60, 50);
  }
  assert.equal(e.faults.filter((x) => x.item === 35).length, 2);
});
test("missing move-off signal maps to the historical no-signal item 39", () => {
  const e = new Examiner(),
    f = frame();
  f.vehicle.speed = 1;
  e.update(f, 0.1, 50);
  assert.equal(e.faults.find((x) => x.id === "move-signal").item, 39);
});
test("the historical form preserves all 73 rows and the source duplicate number", () => {
  const f = JSON.parse(
    readFileSync(
      new URL("../../data/exam_rules/historical-form.json", import.meta.url),
    ),
  );
  assert.equal(f.items.length, 73);
  assert.equal(new Set(f.items.map((x) => x.id)).size, 73);
  assert.equal(f.items.filter((x) => x.printedNumber === 62).length, 2);
  assert.equal(f.items.find((x) => x.id === "62b").sequence, 63);
  assert.ok(f.items.find((x) => x.id === "70").transcriptionNote);
});

test("calibration rejects shared pedal channels and duplicated action buttons", () => {
  const cal = {
    version: 1,
    deviceId: "fixture",
    steering: axis(),
    throttle: { ...axis(1, -1), index: 1 },
    brake: { ...axis(1, -1), index: 2 },
    buttons: {
      handbrake: 0,
      indicatorLeft: 1,
      indicatorRight: 2,
      lookLeft: 3,
      lookRight: 4,
      rear: 5,
    },
  };
  assert.equal(validateCalibration(cal), null);
  assert.match(
    validateCalibration({ ...cal, brake: cal.throttle }),
    /separate input/,
  );
  assert.match(
    validateCalibration({ ...cal, buttons: { ...cal.buttons, rear: 0 } }),
    /different button/,
  );
  assert.match(
    validateCalibration({ ...cal, steering: { ...cal.steering, center: 2 } }),
    /centre/,
  );
});
