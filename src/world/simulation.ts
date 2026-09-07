import RAPIER from "@dimforge/rapier3d-compat";
import { DrivingScene } from "../render/scene";
import { MapScene } from "../render/map-scene";
import {
  KeyboardInput,
  GamepadInput,
  blankControl,
  type Calibration,
  type InputDevice,
} from "../input/input";
import { nearestRoad, seeded, wrap } from "./math";
import type { Actor, Control, Frame, Vehicle, WorldData, Road } from "./types";
import { stepVehicle } from "../vehicle/vehicle";
import { Examiner } from "../exam/examiner";
import { Recorder } from "../replay/replay";

export interface Snapshot {
  environment: import("../render/environment").EnvironmentStatus;
  phase: "ready" | "driving" | "paused" | "result" | "replay";
  t: number;
  vehicle: Vehicle;
  control: Control;
  road: string;
  roadTC: string;
  limit: number;
  fps: number;
  drawCalls: number;
  triangles: number;
  instruction: string;
  instructionTC: string;
  progress: number;
  faults: Examiner["faults"];
  result: string;
  light: Frame["light"];
  seed: string;
  replayDuration: number;
  deviceConnected: boolean;
}
interface Traffic {
  actor: Actor;
  road: Road;
  segment: number;
  t: number;
  direction: number;
}
const ROUTE = [
  [-125, -11, "Turn right into Hau Man Street", "右轉入孝民街"],
  [-123, -131, "Continue along Hau Man Street", "沿孝民街前進"],
  [-231, -262, "Turn right into Carmel Village Street", "右轉入迦密村街"],
  [-115, -416, "Turn left into Chung Hau Street", "左轉入忠孝街"],
  [-196, -507, "Follow Chung Hau Street", "沿忠孝街行駛"],
  [-340, -408, "Continue on Chung Hau Street", "繼續沿忠孝街行駛"],
  [-356, -293, "Continue ahead", "繼續前進"],
  [-352, -144, "Continue ahead", "繼續前進"],
  [-311, -84, "Continue on Chung Hau Street", "繼續沿忠孝街行駛"],
  [-237, 10, "Keep left and continue", "靠左繼續行駛"],
  [-180, 65, "Turn left into Hau Man Street", "左轉入孝民街"],
  [-125, -11, "Turn right into Chung Yee Street", "右轉入忠義街"],
  [-10, 0, "Pull over safely and apply the handbrake", "安全停車並拉起手掣"],
] as const;
export class Simulation {
  scene: DrivingScene | MapScene;
  webgl = true;
  keyboard = new KeyboardInput();
  input: InputDevice = this.keyboard;
  exam = new Examiner();
  recorder = new Recorder("HK-0042", "learn");
  v: Vehicle = { x: 0, y: 0, z: 0, yaw: 0, speed: 0, steer: 0, distance: 0 };
  control = blankControl();
  actors: Actor[] = [];
  traffic: Traffic[] = [];
  phase: Snapshot["phase"] = "ready";
  mode = "learn";
  seed = "HK-0042";
  t = 0;
  routeIndex = 0;
  light: Frame["light"] = "green";
  raf = 0;
  last = 0;
  accumulator = 0;
  publishTime = 0;
  lastRender = 0;
  replayTime = 0;
  replayPlaying = false;
  fps = 60;
  worldPhysics: RAPIER.World | null = null;
  playerBody: RAPIER.RigidBody | null = null;
  playerCollider: RAPIER.Collider | null = null;
  actorBodies = new Map<number, RAPIER.RigidBody>();
  colliderActor = new Map<number, number>();
  lastJunction = -1;
  audio: AudioContext | null = null;
  osc: OscillatorNode | null = null;
  gain: GainNode | null = null;
  audioEnabled = false;
  disposed = false;
  constructor(
    container: HTMLElement,
    public data: WorldData,
    public onState: (s: Snapshot) => void,
  ) {
    try {
      const probe = document.createElement("canvas");
      if (!probe.getContext("webgl2")) throw new Error("WebGL2 unavailable");
      this.scene = new DrivingScene(container, data);
    } catch (error) {
      this.scene = new MapScene(container, data);
      this.scene.environmentStatus.detail = `DEVELOPMENT FALLBACK: ${error instanceof Error ? error.message : "3D renderer initialization failed"}. This is a 2D map; f2 is not rendered.`;
      this.webgl = false;
    }
    this.reset();
    window.addEventListener("keydown", this.down);
    window.addEventListener("keyup", this.up);
    window.addEventListener("blur", this.blur);
    document.addEventListener("visibilitychange", this.visibility);
    this.raf = requestAnimationFrame(this.loop);
  }
  async initPhysics() {
    await RAPIER.init();
    if (this.disposed) return;
    this.worldPhysics = new RAPIER.World({ x: 0, y: 0, z: 0 });
    this.playerBody = this.worldPhysics.createRigidBody(
      RAPIER.RigidBodyDesc.kinematicPositionBased(),
    );
    this.playerCollider = this.worldPhysics.createCollider(
      RAPIER.ColliderDesc.cuboid(0.86, 0.7, 2.1).setSensor(true),
      this.playerBody,
    );
    this.rebuildColliders();
  }
  rebuildColliders() {
    const w = this.worldPhysics;
    if (!w) return;
    for (const b of this.actorBodies.values()) w.removeRigidBody(b);
    this.actorBodies.clear();
    this.colliderActor.clear();
    for (const a of this.actors) {
      const body = w.createRigidBody(
        RAPIER.RigidBodyDesc.kinematicPositionBased(),
      );
      const c = w.createCollider(
        a.kind === "pedestrian"
          ? RAPIER.ColliderDesc.capsule(0.55, 0.22).setSensor(true)
          : RAPIER.ColliderDesc.cuboid(0.86, 0.7, 2.1).setSensor(true),
        body,
      );
      this.actorBodies.set(a.id, body);
      this.colliderActor.set(c.handle, a.id);
    }
  }
  down = (e: KeyboardEvent) => {
    if ((e.target as HTMLElement)?.closest("input,select,textarea,button"))
      return;
    if (e.code === "Escape") {
      this.pause();
      return;
    }
    if (
      ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"].includes(
        e.code,
      )
    )
      e.preventDefault();
    if (this.phase === "driving") this.keyboard.down(e.code, e.repeat);
  };
  up = (e: KeyboardEvent) => this.keyboard.up(e.code);
  blur = () => {
    this.keyboard.keys.clear();
    if (this.phase === "driving") this.phase = "paused";
  };
  visibility = () => {
    if (document.hidden) this.blur();
  };
  reset() {
    this.exam = new Examiner();
    this.t = 0;
    this.routeIndex = 0;
    this.accumulator = 0;
    this.replayTime = 0;
    this.replayPlaying = false;
    this.input.reset();
    this.keyboard.reset();
    this.control = blankControl();
    const r = this.data.roads.find((r) => r.id === 35685)!;
    const p = r.points[5],
      q = r.points[6];
    const yaw = Math.atan2(q[0] - p[0], q[2] - p[2]);
    this.v = {
      x: p[0] + Math.cos(yaw) * 1.75,
      y: p[1],
      z: p[2] - Math.sin(yaw) * 1.75,
      yaw,
      speed: 0,
      steer: 0,
      distance: 0,
    };
    this.recorder = new Recorder(this.seed, this.mode);
    this.populate();
    this.rebuildColliders();
  }
  populate() {
    const rand = seeded(this.seed);
    this.actors = [];
    this.traffic = [];
    const eligible = this.data.roads.filter(
      (r) => r.points.length > 18 && r.id !== 35687,
    );
    for (let i = 0; i < 8; i++) {
      const road = eligible[Math.floor(rand() * eligible.length)];
      const direction = road.direction === 1 && rand() > 0.5 ? -1 : 1;
      const segment = 2 + Math.floor(rand() * (road.points.length - 5));
      const a: Actor = {
        id: i,
        x: 0,
        y: 0,
        z: 0,
        yaw: 0,
        speed: 3 + rand() * 3,
        kind: i % 4 === 0 ? "van" : "car",
        parked: false,
      };
      this.traffic.push({ actor: a, road, segment, t: 0, direction });
      this.actors.push(a);
      this.placeTraffic(this.traffic[this.traffic.length - 1]);
    }
    const r = this.data.roads.find((r) => r.id === 35685)!;
    for (let i = 0; i < 2; i++) {
      const p = r.points[20 + i * 11],
        q = r.points[21 + i * 11];
      const yaw = Math.atan2(q[0] - p[0], q[2] - p[2]);
      this.actors.push({
        id: 20 + i,
        x: p[0] - Math.cos(yaw) * (r.width / 2 - 0.9),
        y: p[1],
        z: p[2] + Math.sin(yaw) * (r.width / 2 - 0.9),
        yaw: yaw + Math.PI,
        speed: 0,
        kind: i ? "van" : "car",
        parked: true,
      });
    }
    const p = r.points[27];
    this.actors.push({
      id: 30,
      x: p[0],
      y: p[1],
      z: p[2] - 5,
      yaw: 0,
      speed: 0,
      kind: "pedestrian",
      parked: false,
    });
  }
  placeTraffic(o: Traffic) {
    const a = o.road.points[o.segment],
      b = o.road.points[o.segment + o.direction];
    if (!b) return;
    const dx = b[0] - a[0],
      dz = b[2] - a[2],
      yaw = Math.atan2(dx, dz),
      offset = o.road.direction === 1 ? 1.8 : 0;
    o.actor.x = a[0] + dx * o.t + Math.cos(yaw) * offset;
    o.actor.z = a[2] + dz * o.t - Math.sin(yaw) * offset;
    o.actor.y = a[1] + (b[1] - a[1]) * o.t;
    o.actor.yaw = yaw;
  }
  chooseKeyboard() {
    this.input = this.keyboard;
  }
  chooseWheel(cal: Calibration) {
    this.input = new GamepadInput(
      cal,
      () =>
        Array.from(navigator.getGamepads()).find(
          (p) => p?.id === cal.deviceId,
        ) ?? null,
    );
  }
  start(mode: string, seed: string) {
    this.mode = mode;
    this.seed = seed || "HK-0042";
    this.reset();
    this.phase = "driving";
    this.scene.view = "cockpit";
    if (this.audioEnabled) this.startAudio();
  }
  startAudio() {
    if (!this.audio) {
      this.audio = new AudioContext();
      this.osc = this.audio.createOscillator();
      this.osc.type = "triangle";
      this.gain = this.audio.createGain();
      this.gain.gain.value = 0.025;
      this.osc.connect(this.gain).connect(this.audio.destination);
      this.osc.start();
    }
    void this.audio.resume();
  }
  pause() {
    if (this.phase === "driving") this.phase = "paused";
    else if (this.phase === "paused") this.phase = "driving";
    this.keyboard.keys.clear();
  }
  finish(completed = false) {
    if (this.phase !== "driving" && this.phase !== "paused") return;
    this.phase = "result";
    this.recorder.data.completed = completed;
    this.recorder.data.faults = structuredClone(this.exam.faults);
  }
  replay(t = 0) {
    this.phase = "replay";
    this.replayTime = t;
    this.replayPlaying = false;
  }
  tick(dt: number) {
    this.t += dt;
    const previousGear = this.control.gear;
    this.control = this.input.read(dt, this.v.speed);
    if (Math.abs(this.v.speed) > 0.3 && this.control.gear !== previousGear)
      this.control.gear = previousGear;
    if (
      this.input instanceof GamepadInput &&
      !this.input.provider()?.connected
    ) {
      this.phase = "paused";
      return;
    }
    const n = nearestRoad(this.v.x, this.v.z, this.data.roads);
    const old = { ...this.v };
    const align = Math.cos(wrap(this.v.yaw - n.hit.yaw));
    stepVehicle(this.v, this.control, dt, n.hit.slope * align);
    const road = nearestRoad(this.v.x, this.v.z, this.data.roads);
    this.v.y = road.hit.y;
    this.light =
      this.t % 38 < 21 ? "green" : this.t % 38 < 24 ? "amber" : "red";
    for (const o of this.traffic) {
      let blocked = false;
      const lookX = Math.sin(o.actor.yaw),
        lookZ = Math.cos(o.actor.yaw);
      for (const a of [{ ...this.v, id: -1 }, ...this.actors]) {
        if (a.id === o.actor.id) continue;
        const dx = a.x - o.actor.x,
          dz = a.z - o.actor.z,
          forward = dx * lookX + dz * lookZ,
          side = Math.abs(dx * lookZ - dz * lookX);
        if (forward > 0 && forward < 9 && side < 1.9) {
          blocked = true;
          break;
        }
      }
      if (blocked) continue;
      const a = o.road.points[o.segment],
        b = o.road.points[o.segment + o.direction];
      if (!b) continue;
      const len = Math.hypot(b[0] - a[0], b[2] - a[2]);
      o.t += (dt * o.actor.speed) / (len || 1);
      if (o.t >= 1) {
        o.t -= 1;
        o.segment += o.direction;
        if (!o.road.points[o.segment + o.direction]) {
          const end = o.road.points[o.segment];
          const next = this.data.roads.find(
            (r) =>
              r.id !== o.road.id &&
              Math.hypot(r.points[0][0] - end[0], r.points[0][2] - end[2]) <
                1.5,
          );
          if (next) {
            o.road = next;
            o.segment = 0;
            o.direction = 1;
          } else {
            o.actor.speed = 0;
            continue;
          }
        }
      }
      this.placeTraffic(o);
    }
    const ped = this.actors.find((a) => a.kind === "pedestrian")!;
    const rr = this.data.roads.find((r) => r.id === 35685)!;
    const pp = rr.points[27];
    const phase = this.t % 38;
    if (phase > 25 && phase < 33) {
      const desired = pp[2] - 5 + (phase - 25) * 1.25;
      const tooClose =
        Math.hypot(this.v.x - ped.x, this.v.z - ped.z) < 7 &&
        Math.abs(this.v.speed) > 0.4;
      if (!tooClose) ped.z = desired;
    } else if (phase < 21) ped.z = pp[2] - 5;
    const f: Frame = {
      t: this.t,
      vehicle: this.v,
      control: this.control,
      actors: this.actors,
      light: this.light,
    };
    this.exam.update(f, dt, road.road.speedLimit);
    if (
      road.hit.d > road.road.width / 2 - 0.8 &&
      Math.abs(this.v.speed) > 0.3
    ) {
      this.exam.add(
        f,
        41,
        `kerb-${Math.floor(this.t / 10)}`,
        "serious",
        "車輛觸碰路壆",
        "Vehicle contacted the road edge",
        `Centreline offset ${road.hit.d.toFixed(2)} m; estimated road width ${road.road.width} m`,
        "Maintain safe road position and slow down before tight turns.",
      );
      this.v.x = old.x;
      this.v.z = old.z;
      this.v.speed = 0;
    }
    const goal = ROUTE[this.routeIndex];
    const dist = Math.hypot(this.v.x - goal[0], this.v.z - goal[1]);
    if (dist < 16) {
      if (
        this.routeIndex === 0 ||
        this.routeIndex === 2 ||
        this.routeIndex === 3 ||
        this.routeIndex === 10 ||
        this.routeIndex === 11
      )
        this.exam.junction(f, String(this.routeIndex));
      if (this.routeIndex < ROUTE.length - 1) this.routeIndex++;
      else if (
        Math.abs(this.v.speed) < 0.15 &&
        this.control.handbrake &&
        this.v.distance > 700
      )
        this.finish(true);
    }
    if (this.worldPhysics && this.playerBody && this.playerCollider) {
      const quat = (yaw: number) => ({
        x: 0,
        y: Math.sin(yaw / 2),
        z: 0,
        w: Math.cos(yaw / 2),
      });
      this.playerBody.setNextKinematicTranslation({
        x: this.v.x,
        y: this.v.y + 0.7,
        z: this.v.z,
      });
      this.playerBody.setNextKinematicRotation(quat(this.v.yaw));
      for (const a of this.actors) {
        const b = this.actorBodies.get(a.id)!;
        b.setNextKinematicTranslation({ x: a.x, y: a.y + 0.7, z: a.z });
        b.setNextKinematicRotation(quat(a.yaw));
      }
      this.worldPhysics.timestep = dt;
      this.worldPhysics.step();
      this.worldPhysics.intersectionPairsWith(this.playerCollider, (c) => {
        const id = this.colliderActor.get(c.handle);
        if (id !== undefined && Math.abs(old.speed) > 0.25) {
          this.exam.add(
            f,
            41,
            `collision-${id}-${Math.floor(this.t / 10)}`,
            "serious",
            "碰及物體或其他道路使用者",
            "Collision detected",
            `Rapier overlap with actor ${id}`,
            "Stop, allow sufficient clearance, and yield to vulnerable road users.",
          );
          this.v.x = old.x;
          this.v.z = old.z;
          this.v.speed = 0;
        }
      });
    }
    if (Math.floor(this.t * 10) !== Math.floor((this.t - dt) * 10))
      this.recorder.capture(f);
    if (this.audio && this.osc && this.gain) {
      this.osc.frequency.setTargetAtTime(
        36 + Math.abs(this.v.speed) * 4 + this.control.throttle * 20,
        this.audio.currentTime,
        0.1,
      );
      this.gain.gain.setTargetAtTime(
        this.audioEnabled ? 0.018 : 0,
        this.audio.currentTime,
        0.1,
      );
    }
  }
  loop = (now: number) => {
    if (this.disposed) return;
    const dt = Math.min(0.1, (now - (this.last || now)) / 1000);
    this.last = now;
    this.fps = this.fps * 0.95 + (dt ? 1 / dt : 60) * 0.05;
    if (this.phase === "driving") {
      this.accumulator += dt;
      let steps = 0;
      while (
        this.phase === "driving" &&
        this.accumulator >= 1 / 60 &&
        steps++ < 6
      ) {
        this.tick(1 / 60);
        this.accumulator -= 1 / 60;
      }
    } else if (this.gain && this.audio)
      this.gain.gain.setTargetAtTime(0, this.audio.currentTime, 0.05);
    let v = this.v,
      c = this.control,
      actors = this.actors;
    if (this.phase === "replay") {
      if (this.replayPlaying)
        this.replayTime = Math.min(
          this.replayTime + dt,
          this.recorder.data.frames.at(-1)?.t ?? 0,
        );
      const f = this.recorder.at(this.replayTime);
      if (f) {
        v = f.vehicle;
        c = f.control;
        actors = f.actors;
      }
    }
    const activeView = this.phase === "driving" || this.phase === "replay";
    if (activeView || now - this.lastRender >= 50) {
      this.lastRender = now;
      this.scene.render(v, c, actors, this.phase === "ready");
    }
    if (now - this.publishTime > 100) {
      this.publishTime = now;
      const n = nearestRoad(v.x, v.z, this.data.roads);
      const goal = ROUTE[this.routeIndex];
      this.onState({
        phase: this.phase,
        t: this.phase === "replay" ? this.replayTime : this.t,
        vehicle: { ...v },
        control: { ...c },
        road: n.road.name,
        roadTC: n.road.tc,
        limit: n.road.speedLimit,
        fps: Math.round(this.fps),
        drawCalls: this.scene.renderer.info.render.calls,
        triangles: this.scene.renderer.info.render.triangles,
        instruction: goal[2],
        instructionTC: goal[3],
        progress: this.routeIndex / (ROUTE.length - 1),
        faults: [...this.exam.faults],
        result: this.exam.result(this.recorder.data.completed),
        light: this.light,
        seed: this.seed,
        replayDuration: this.recorder.data.frames.at(-1)?.t ?? 0,
        environment: {
          ...this.scene.environmentStatus,
          physicsRoad: !!this.worldPhysics,
        },
        deviceConnected:
          !(this.input instanceof GamepadInput) ||
          !!this.input.provider()?.connected,
      });
    }
    this.raf = requestAnimationFrame(this.loop);
  };
  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    window.removeEventListener("keydown", this.down);
    window.removeEventListener("keyup", this.up);
    window.removeEventListener("blur", this.blur);
    document.removeEventListener("visibilitychange", this.visibility);
    this.scene.dispose();
    this.worldPhysics?.free();
    void this.audio?.close();
  }
}
