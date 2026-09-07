"use client";
import type { WorldData } from "../../src/world/types";
import type { Snapshot } from "../../src/world/simulation";
export function MiniMap({
  world,
  state,
  large = false,
}: {
  world: WorldData | null;
  state: Snapshot | null;
  large?: boolean;
}) {
  if (!world) return null;
  return (
    <svg
      viewBox="-440 -620 860 950"
      className={large ? "area-map" : "mini-map"}
      aria-label="Ho Man Tin road map"
    >
      <rect x="-440" y="-620" width="860" height="950" fill="#14252b" />
      {world.buildings.map((b, i) => (
        <path
          key={i}
          d={b.rings
            .map((r) => "M" + r.map((p) => p.join(",")).join("L") + "Z")
            .join("")}
          fill="#23383d"
          stroke="#2b4247"
          strokeWidth="1"
        />
      ))}
      {world.roads.map((r) => (
        <polyline
          key={r.id}
          points={r.points.map((p) => `${p[0]},${p[2]}`).join(" ")}
          fill="none"
          stroke={r.name === "CHUNG YEE STREET" ? "#e4bb66" : "#658187"}
          strokeWidth={large ? 6 : 9}
          strokeLinejoin="round"
        />
      ))}
      <g fill="#ccdad9" fontSize="22">
        <text x="-390" y="-310" transform="rotate(-90 -390 -310)">
          忠孝街
        </text>
        <text x="-235" y="-210">
          孝民街
        </text>
        <text x="-70" y="45" fill="#e4bb66">
          忠義街
        </text>
        <text x="120" y="-330" transform="rotate(-64 120 -330)">
          佛光街
        </text>
      </g>
      {state && (
        <g
          transform={`translate(${state.vehicle.x},${state.vehicle.z}) rotate(${(-state.vehicle.yaw * 180) / Math.PI})`}
        >
          <circle r="20" fill="#e4bb66" opacity=".18" />
          <path
            d="M0,15 L-10,-10 L0,-5 L10,-10 Z"
            fill="#ffe0a3"
            stroke="#14252b"
            strokeWidth="2"
          />
        </g>
      )}
      <text x="340" y="-545" fill="#d3dddb" fontSize="28">
        N ↑
      </text>
    </svg>
  );
}
