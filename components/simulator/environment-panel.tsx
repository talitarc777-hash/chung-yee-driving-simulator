import type { EnvironmentStatus } from "../../src/render/environment";
export function EnvironmentPanel({
  status: s,
  tc,
}: {
  status: EnvironmentStatus;
  tc: boolean;
}) {
  return (
    <details
      className={"environment-panel env-" + s.status.toLowerCase()}
      open={s.status !== "CONNECTED"}
    >
      <summary>
        {s.status === "FALLBACK"
          ? "DEVELOPMENT FALLBACK"
          : `LandsD f2 · ${s.status}`}
      </summary>
      <dl>
        <dt>Environment source</dt>
        <dd>{s.source}</dd>
        <dt>Tileset</dt>
        <dd>{s.tileset}</dd>
        <dt>Delivery</dt>
        <dd>{s.delivery}</dd>
        <dt>Status</dt>
        <dd>{s.status}</dd>
        <dt>Tiles loaded</dt>
        <dd>{s.tilesLoaded}</dd>
        <dt>Textured / visible tiles</dt>
        <dd>
          {s.texturedTiles} / {s.visibleTexturedTiles}
        </dd>
        <dt>Mesh / material / texture</dt>
        <dd>
          {s.meshesLoaded} / {s.materialsLoaded} / {s.textureReferences}
        </dd>
        <dt>Requests / failed</dt>
        <dd>
          {s.requests} / {s.failedRequests}
        </dd>
        <dt>Tile cache</dt>
        <dd>
          {s.cacheMB} MB{s.cacheFull ? " · FULL" : ""}
        </dd>
        <dt>Visual profile</dt>
        <dd>{s.visualProfile}</dd>
        <dt>API</dt>
        <dd>{s.api}</dd>
        <dt>Custom road overlay</dt>
        <dd>{s.roadOverlay ? "ON" : "OFF"}</dd>
        <dt>Physics road</dt>
        <dd>{s.physicsRoad ? "ON" : "INITIALIZING"}</dd>
      </dl>
      <p>{s.detail}</p>
      <small>
        {tc
          ? "道路闊度、坡度及實景對齊未經驗證；不代表視覺驗收完成。"
          : "Road widths, grades and mesh alignment unverified; this is not visual acceptance."}
      </small>
    </details>
  );
}
