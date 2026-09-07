import type { WorldData, Vehicle, Control, Actor } from "../world/types";
import { initialEnvironment } from "./environment";
/** Explicit compatibility view for devices without WebGL. Never represented as 3D. */
export class MapScene {
  canvas = document.createElement("canvas");
  context: CanvasRenderingContext2D;
  view = "overhead";
  quality = "performance";
  environmentStatus = {
    ...initialEnvironment(),
    status: "FALLBACK" as const,
    detail:
      "DEVELOPMENT FALLBACK: WebGL2 unavailable. This is a 2D map, not the government 3D environment. f2 was not requested.",
  };
  renderer = { info: { render: { calls: 0, triangles: 0 } } };
  resizer: ResizeObserver;
  constructor(
    public container: HTMLElement,
    public world: WorldData,
  ) {
    this.context = this.canvas.getContext("2d")!;
    container.appendChild(this.canvas);
    this.resizer = new ResizeObserver(() => this.resize());
    this.resizer.observe(container);
    this.resize();
  }
  resize() {
    this.canvas.width = this.container.clientWidth;
    this.canvas.height = this.container.clientHeight;
  }
  setQuality(q: string) {
    this.quality = q;
  }
  enableTiles() {
    this.environmentStatus.detail =
      "WebGL2 is required to render f2. Enable graphics acceleration and reload; API access has not been tested by this browser.";
  }
  disableTiles() {
    // Already an explicitly labelled compatibility fallback.
  }
  render(v: Vehicle, _c: Control, actors: Actor[], overview = false) {
    const ctx = this.context,
      w = this.canvas.width,
      h = this.canvas.height;
    ctx.fillStyle = "#1e343c";
    ctx.fillRect(0, 0, w, h);
    ctx.save();
    ctx.translate(overview ? w * 0.69 : w * 0.5, h * 0.5);
    const scale = overview ? Math.min(w / 950, h / 700) : 4;
    ctx.scale(scale, scale);
    ctx.translate(overview ? 140 : -v.x, overview ? 180 : -v.z);
    for (const b of this.world.buildings) {
      ctx.beginPath();
      for (const ring of b.rings) {
        ring.forEach((p, i) =>
          i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]),
        );
        ctx.closePath();
      }
      ctx.fillStyle = "#354e55";
      ctx.fill("evenodd");
      ctx.strokeStyle = "#4a6266";
      ctx.lineWidth = 0.4;
      ctx.stroke();
    }
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    for (const r of this.world.roads) {
      ctx.beginPath();
      r.points.forEach((p, i) =>
        i ? ctx.lineTo(p[0], p[2]) : ctx.moveTo(p[0], p[2]),
      );
      ctx.lineWidth = r.width + 1;
      ctx.strokeStyle = "#788a89";
      ctx.stroke();
      ctx.lineWidth = r.width;
      ctx.strokeStyle = r.name === "CHUNG YEE STREET" ? "#9b885e" : "#4b5e63";
      ctx.stroke();
      if (r.direction === 1) {
        ctx.lineWidth = 0.12;
        ctx.setLineDash([3, 4]);
        ctx.strokeStyle = "#ded9b9";
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }
    for (const a of [...actors, { ...v, id: -1, kind: "player" }]) {
      ctx.save();
      ctx.translate(a.x, a.z);
      ctx.rotate(-a.yaw);
      ctx.fillStyle =
        a.kind === "pedestrian"
          ? "#f0b0a0"
          : a.id === -1
            ? "#ffe0a3"
            : "#b7c9cf";
      ctx.fillRect(-0.9, -2, 1.8, 4);
      if (a.id === -1) {
        ctx.beginPath();
        ctx.moveTo(0, 5);
        ctx.lineTo(-1.4, 2.2);
        ctx.lineTo(1.4, 2.2);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
    }
    ctx.restore();
  }
  dispose() {
    this.resizer.disconnect();
    this.canvas.remove();
  }
}
