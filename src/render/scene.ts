import * as T from "three";
import { LandsDEnvironment } from "./landsd-environment";
import type {
  WorldData,
  Vehicle,
  Control,
  Actor,
  Point,
} from "../world/types.ts";
import { nearestRoad, seeded } from "../world/math.ts";

export class DrivingScene {
  renderer: T.WebGLRenderer;
  scene = new T.Scene();
  camera = new T.PerspectiveCamera(58, 1, 0.1, 650);
  rig = new T.Group();
  cockpit = new T.Group();
  sun = new T.DirectionalLight(0xfff4df, 2.6);
  environment: LandsDEnvironment;
  developmentFallback = new T.Group();
  developmentFallbackBuilt = false;
  scenery = new T.Group();
  vehicles = new Map<number, T.Group>();
  wheel = new T.Group();
  player = new T.Group();
  disposed = false;
  view = "cockpit";
  quality = "medium";
  mirrorTarget = new T.WebGLRenderTarget(384, 128);
  mirrorCamera = new T.PerspectiveCamera(48, 3, 0.2, 180);
  mirrorScreen: T.Mesh | null = null;
  frame = 0;
  get environmentStatus() {
    return this.environment.status;
  }
  resizer: ResizeObserver;
  constructor(
    public container: HTMLElement,
    public world: WorldData,
  ) {
    this.renderer = new T.WebGLRenderer({
      antialias: true,
      powerPreference: "high-performance",
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    this.renderer.outputColorSpace = T.SRGBColorSpace;
    this.renderer.toneMapping = T.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.12;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = T.PCFSoftShadowMap;
    container.appendChild(this.renderer.domElement);
    this.scene.background = new T.Color(0xc7d8df);
    this.scene.fog = new T.Fog(0xc7d8df, 200, 1200);
    this.scene.add(new T.HemisphereLight(0xd5e9fc, 0x737466, 2.1));
    this.sun.position.set(100, 230, -130);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(1024, 1024);
    Object.assign(this.sun.shadow.camera, {
      left: -100,
      right: 100,
      top: 100,
      bottom: -100,
      near: 1,
      far: 500,
    });
    this.sun.shadow.bias = -0.0004;
    this.scene.add(
      this.sun,
      this.sun.target,
      this.scenery,
      this.rig,
      this.developmentFallback,
    );
    this.developmentFallback.visible = false;
    this.environment = new LandsDEnvironment(
      this.scene,
      this.camera,
      this.renderer,
      world,
    );
    this.rig.add(this.cockpit);
    this.buildWorld();
    this.enableTiles();
    this.buildCockpit();
    this.player = this.car("player");
    this.scene.add(this.player);
    this.resizer = new ResizeObserver(() => {
      const w = container.clientWidth,
        h = container.clientHeight;
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(w, h);
    });
    this.resizer.observe(container);
    this.camera.aspect = container.clientWidth / container.clientHeight;
    this.camera.updateProjectionMatrix();
  }
  mat(color: number, roughness = 0.9) {
    return new T.MeshStandardMaterial({ color, roughness });
  }
  box(w: number, h: number, d: number, color: number, x = 0, y = 0, z = 0) {
    const m = new T.Mesh(new T.BoxGeometry(w, h, d), this.mat(color));
    m.position.set(x, y, z);
    m.castShadow = true;
    m.receiveShadow = true;
    return m;
  }
  ribbon(
    points: Point[],
    width: number,
    material: T.Material,
    offset = 0,
    height = 0,
  ) {
    const verts: number[] = [],
      uv: number[] = [],
      indices: number[] = [];
    let distance = 0;
    points.forEach((p, i) => {
      const a = points[Math.max(0, i - 1)],
        b = points[Math.min(points.length - 1, i + 1)];
      const dx = b[0] - a[0],
        dz = b[2] - a[2],
        l = Math.hypot(dx, dz) || 1;
      const nx = dz / l,
        nz = -dx / l;
      if (i) distance += Math.hypot(p[0] - a[0], p[2] - a[2]);
      for (const side of [-1, 1]) {
        verts.push(
          p[0] + nx * (offset + (side * width) / 2),
          p[1] + height,
          p[2] + nz * (offset + (side * width) / 2),
        );
        uv.push(side === -1 ? 0 : 1, distance / 8);
      }
      if (i) {
        const j = i * 2;
        indices.push(j - 2, j - 1, j, j - 1, j + 1, j);
      }
    });
    const g = new T.BufferGeometry();
    g.setAttribute("position", new T.Float32BufferAttribute(verts, 3));
    g.setAttribute("uv", new T.Float32BufferAttribute(uv, 2));
    g.setIndex(indices);
    g.computeVertexNormals();
    const mesh = new T.Mesh(g, material);
    mesh.receiveShadow = true;
    return mesh;
  }
  texture(kind: "asphalt" | "windows") {
    const c = document.createElement("canvas");
    c.width = c.height = 256;
    const ctx = c.getContext("2d")!;
    const rand = seeded(kind);
    if (kind === "asphalt") {
      const im = ctx.createImageData(256, 256);
      for (let i = 0; i < im.data.length; i += 4) {
        const v = 75 + rand() * 23;
        im.data[i] = v;
        im.data[i + 1] = v + 2;
        im.data[i + 2] = v + 3;
        im.data[i + 3] = 255;
      }
      ctx.putImageData(im, 0, 0);
    } else {
      ctx.fillStyle = "#b9bcb8";
      ctx.fillRect(0, 0, 256, 256);
      for (let y = 0; y < 256; y += 32)
        for (let x = 0; x < 256; x += 24) {
          ctx.fillStyle = rand() > 0.6 ? "#788b91" : "#4c646e";
          ctx.fillRect(x + 5, y + 6, 13, 19);
          ctx.fillStyle = "#d1d4cf";
          ctx.fillRect(x + 5, y + 25, 14, 3);
        }
    }
    const t = new T.CanvasTexture(c);
    t.wrapS = t.wrapT = T.RepeatWrapping;
    t.colorSpace = T.SRGBColorSpace;
    t.anisotropy = 4;
    return t;
  }
  buildWorld() {
    const roadMat = new T.MeshStandardMaterial({
      map: this.texture("asphalt"),
      roughness: 0.96,
      side: T.DoubleSide,
    });
    const curb = this.mat(0xb1b3ae),
      walk = this.mat(0x969c98),
      paint = this.mat(0xede8d4);
    roadMat.polygonOffset = true;
    roadMat.polygonOffsetFactor = -1;
    for (const r of this.world.roads) {
      this.scenery.add(
        this.ribbon(r.points, r.width + 3, walk, 0, -0.02),
        this.ribbon(r.points, r.width, roadMat, 0, 0.02),
      );
      for (const side of [-1, 1])
        this.scenery.add(
          this.ribbon(r.points, 0.2, curb, side * (r.width / 2 + 0.05), 0.13),
        );
      if (r.direction === 1) {
        for (let i = 0; i < r.points.length - 2; i += 4)
          this.scenery.add(
            this.ribbon(r.points.slice(i, i + 2), 0.1, paint, 0, 0.06),
          );
      }
    }
  }
  buildDevelopmentFallback() {
    if (this.developmentFallbackBuilt) return;
    this.developmentFallbackBuilt = true;
    // Ground is only visual. Vehicle contact follows separate road data.
    const g = new T.PlaneGeometry(1600, 1600, 70, 70);
    g.rotateX(-Math.PI / 2);
    const pos = g.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const n = nearestRoad(pos.getX(i), pos.getZ(i), this.world.roads);
      pos.setY(i, n.hit.y - 0.4);
    }
    g.computeVertexNormals();
    const ground = new T.Mesh(g, this.mat(0x87917c));
    ground.receiveShadow = true;
    this.developmentFallback.add(ground);
    const win = this.texture("windows");
    for (const b of this.world.buildings) {
      const shape = new T.Shape(
        b.rings[0].map((p) => new T.Vector2(p[0], -p[1])),
      );
      for (const ring of b.rings.slice(1))
        shape.holes.push(
          new T.Path(ring.map((p) => new T.Vector2(p[0], -p[1]))),
        );
      const geom = new T.ExtrudeGeometry(shape, {
        depth: b.height,
        bevelEnabled: false,
      });
      geom.rotateX(-Math.PI / 2);
      geom.translate(0, b.base, 0);
      const u = geom.attributes.uv;
      for (let i = 0; i < u.count; i++)
        u.setXY(i, u.getX(i) / 18, u.getY(i) / 22);
      const material = new T.MeshStandardMaterial({
        color: 0xc0c5c4,
        map: win,
        roughness: 0.9,
      });
      const mesh = new T.Mesh(geom, [this.mat(0xb5b8b2), material]);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      this.developmentFallback.add(mesh);
    }
    const r = this.world.roads.find(
      (r) => r.name === "CHUNG YEE STREET" && r.id === 35685,
    )!;
    for (let i = 8; i < r.points.length - 2; i += 13) {
      const p = r.points[i];
      const pole = this.box(
        0.1,
        7,
        0.1,
        0x777e80,
        p[0],
        p[1] + 3.5,
        p[2] + r.width / 2 + 1,
      );
      this.developmentFallback.add(
        pole,
        this.box(
          1.4,
          0.15,
          0.38,
          0xb9c3c4,
          p[0] - 0.6,
          p[1] + 7,
          p[2] + r.width / 2 + 1,
        ),
      );
    }
  }
  buildCockpit() {
    this.cockpit.add(
      this.box(1.95, 0.3, 0.8, 0x232a2c, 0, 0.72, 1.1),
      this.box(1.95, 0.07, 0.6, 0x444b4b, 0, 0.9, 1.1),
    );
    const rim = new T.Mesh(
      new T.TorusGeometry(0.205, 0.025, 12, 48),
      this.mat(0x151a1b),
    );
    this.wheel.add(
      rim,
      this.box(0.31, 0.025, 0.025, 0x4b5252),
      this.box(0.035, 0.15, 0.025, 0x4b5252, 0, -0.07, 0),
      this.box(0.085, 0.065, 0.045, 0x242a2c),
    );
    this.wheel.position.set(-0.43, 0.88, 0.69);
    this.wheel.rotation.x = -0.22;
    this.cockpit.add(this.wheel);
    for (const x of [-0.94, 0.94]) {
      const pillar = this.box(0.065, 0.98, 0.075, 0x424b4c, x, 1.43, 1.27);
      pillar.rotation.x = -0.27;
      this.cockpit.add(pillar);
    }
    this.cockpit.add(this.box(1.94, 0.07, 0.1, 0x444b4c, 0, 1.87, 1.43));
    this.mirrorScreen = new T.Mesh(
      new T.PlaneGeometry(0.35, 0.12),
      new T.MeshBasicMaterial({ map: this.mirrorTarget.texture }),
    );
    this.mirrorScreen.rotation.y = Math.PI;
    this.mirrorScreen.position.set(0.13, 1.65, 1.25);
    this.cockpit.add(
      this.box(0.39, 0.155, 0.035, 0x171d20, 0.13, 1.65, 1.27),
      this.mirrorScreen,
    );
  }
  car(kind: string) {
    const group = new T.Group();
    const color =
      kind === "player" ? 0xe6e6df : kind === "van" ? 0xc8ced0 : 0x7a9498;
    group.add(
      this.box(1.73, 0.56, 4.2, color, 0, 0.62, 0),
      this.box(1.5, 0.62, 2.1, color, 0, 1.2, -0.12),
    );
    const glass = new T.MeshStandardMaterial({
      color: 0x416172,
      roughness: 0.23,
      metalness: 0.3,
    });
    const front = new T.Mesh(new T.BoxGeometry(1.42, 0.49, 0.025), glass);
    front.position.set(0, 1.23, 0.95);
    group.add(front);
    const back = front.clone();
    back.position.z = -1.19;
    group.add(back);
    for (const x of [-0.87, 0.87]) {
      const side = new T.Mesh(new T.BoxGeometry(0.02, 0.48, 1.86), glass);
      side.position.set(x * 0.86, 1.23, -0.12);
      group.add(side);
      for (const z of [-1.35, 1.35]) {
        const wheel = new T.Mesh(
          new T.CylinderGeometry(0.31, 0.31, 0.19, 16),
          this.mat(0x171b1b),
        );
        wheel.rotation.z = Math.PI / 2;
        wheel.position.set(x, 0.32, z);
        group.add(wheel);
      }
    }
    for (const x of [-0.58, 0.58])
      group.add(
        this.box(0.39, 0.13, 0.035, 0xe7e6c6, x, 0.77, 2.11),
        this.box(0.32, 0.13, 0.035, 0x9a2420, x, 0.8, -2.11),
      );
    return group;
  }
  person() {
    const p = new T.Group();
    p.add(this.box(0.38, 0.6, 0.23, 0x4d6571, 0, 1.08, 0));
    const head = new T.Mesh(
      new T.SphereGeometry(0.13, 12, 8),
      this.mat(0xc49b7c),
    );
    head.position.y = 1.54;
    p.add(head);
    for (const x of [-0.13, 0.13])
      p.add(this.box(0.12, 0.7, 0.15, 0x333b43, x, 0.43, 0));
    return p;
  }
  setQuality(q: string) {
    this.quality = q;
    this.renderer.setPixelRatio(
      q === "high"
        ? Math.min(devicePixelRatio, 1.75)
        : q === "performance"
          ? 0.8
          : 1,
    );
    this.renderer.shadowMap.enabled = q !== "performance";
    this.environment.setPerformanceProfile(q === "performance");
    if (q === "high" && this.environment.tiles)
      this.environment.tiles.errorTarget = 8;
  }
  enableTiles() {
    this.developmentFallback.visible = false;
    this.environment.start("local");
  }
  enableLiveTiles() {
    this.developmentFallback.visible = false;
    this.environment.start("live");
  }
  disableTiles() {
    this.environment.setFallback();
    this.buildDevelopmentFallback();
    this.developmentFallback.visible = true;
  }
  render(v: Vehicle, c: Control, actors: Actor[], overview = false) {
    if (this.disposed) return;
    this.rig.position.set(v.x, v.y, v.z);
    this.rig.rotation.y = v.yaw;
    this.wheel.rotation.z = -v.steer * 3.7;
    this.cockpit.visible = !overview && this.view === "cockpit";
    this.player.visible =
      overview || this.view === "chase" || this.view === "overhead";
    this.player.position.set(v.x, v.y, v.z);
    this.player.rotation.y = v.yaw;
    for (const a of actors) {
      let mesh = this.vehicles.get(a.id);
      if (!mesh) {
        mesh = a.kind === "pedestrian" ? this.person() : this.car(a.kind);
        this.vehicles.set(a.id, mesh);
        this.scene.add(mesh);
      }
      mesh.position.set(a.x, a.y, a.z);
      mesh.rotation.y = a.yaw;
    }
    const eye = new T.Vector3(-0.43, 1.35, -0.1);
    const lookYaw =
      c.look === "left"
        ? 1.28
        : c.look === "right"
          ? -1.28
          : c.look === "rear"
            ? Math.PI
            : c.look === "mirrorLeft"
              ? 1.05
              : c.look === "mirrorRight"
                ? -1.05
                : 0;
    if (overview) {
      this.camera.position.set(-40, 300, 270);
      this.camera.lookAt(-110, 30, -100);
    } else if (this.view === "chase" || this.view === "overhead") {
      const height = this.view === "overhead" ? 75 : 6;
      const offset = new T.Vector3(
        0,
        height,
        this.view === "overhead" ? -10 : -11,
      ).applyAxisAngle(new T.Vector3(0, 1, 0), v.yaw);
      this.camera.position.set(v.x + offset.x, v.y + offset.y, v.z + offset.z);
      this.camera.lookAt(v.x, v.y + 1, v.z);
    } else {
      if (this.view === "hood") eye.set(0, 1.25, 2);
      eye.applyAxisAngle(new T.Vector3(0, 1, 0), v.yaw);
      this.camera.position.set(v.x + eye.x, v.y + eye.y, v.z + eye.z);
      this.camera.lookAt(
        this.camera.position.x + Math.sin(v.yaw + lookYaw) * 15,
        this.camera.position.y - 0.25,
        this.camera.position.z + Math.cos(v.yaw + lookYaw) * 15,
      );
    }
    this.sun.position.set(v.x + 100, v.y + 230, v.z - 130);
    this.sun.target.position.set(v.x, v.y, v.z);
    this.environment.update(this.renderer, v);
    if (
      !overview &&
      this.view === "cockpit" &&
      this.quality !== "performance" &&
      this.frame++ % (this.quality === "high" ? 2 : 5) === 0
    ) {
      this.cockpit.visible = false;
      this.mirrorCamera.position.set(v.x, v.y + 1.5, v.z);
      this.mirrorCamera.lookAt(
        v.x - Math.sin(v.yaw) * 20,
        v.y + 1.1,
        v.z - Math.cos(v.yaw) * 20,
      );
      this.renderer.setRenderTarget(this.mirrorTarget);
      this.renderer.render(this.scene, this.mirrorCamera);
      this.renderer.setRenderTarget(null);
      this.cockpit.visible = true;
    }
    this.renderer.render(this.scene, this.camera);
  }
  dispose() {
    this.disposed = true;
    this.resizer.disconnect();
    this.environment.stop();
    this.scene.traverse((o) => {
      if (o instanceof T.Mesh) {
        o.geometry.dispose();
        for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
          for (const v of Object.values(m))
            if (v instanceof T.Texture) v.dispose();
          m.dispose();
        }
      }
    });
    this.mirrorTarget.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
