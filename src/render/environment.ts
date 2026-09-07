export const TILESET_URL =
  "https://data.map.gov.hk/api/3d-data/3dtiles/f2/tileset.json";
export const LOCAL_TILESET_URL = "/data/landsd-track/tileset.json";
// Published example on the official API documentation, verified 2026-09-06.
export const PUBLIC_EXAMPLE_KEY = "3967f8f365694e0798af3e7678509421";
export interface EnvironmentStatus {
  source: string;
  tileset: "f2";
  status: "CONNECTED" | "LOADING" | "ERROR" | "FALLBACK";
  api: "OK" | "ERROR" | "NOT REQUESTED" | "PENDING";
  tilesLoaded: number;
  texturedTiles: number;
  visibleTexturedTiles: number;
  meshesLoaded: number;
  materialsLoaded: number;
  textureReferences: number;
  requests: number;
  failedRequests: number;
  cacheMB: number;
  cacheFull: boolean;
  visualProfile: "STANDARD" | "SMOOTH PERFORMANCE";
  delivery: "LOCAL TRACK PACKAGE" | "LIVE API";
  roadOverlay: boolean;
  physicsRoad: boolean;
  detail: string;
}
export function initialEnvironment(): EnvironmentStatus {
  return {
    source: "LandsD 3D Visualisation Map — Tile-based",
    tileset: "f2",
    status: "LOADING",
    api: "NOT REQUESTED",
    tilesLoaded: 0,
    texturedTiles: 0,
    visibleTexturedTiles: 0,
    meshesLoaded: 0,
    materialsLoaded: 0,
    textureReferences: 0,
    requests: 0,
    failedRequests: 0,
    cacheMB: 0,
    cacheFull: false,
    visualProfile: "STANDARD",
    delivery: "LOCAL TRACK PACKAGE",
    roadOverlay: true,
    physicsRoad: false,
    detail:
      "Waiting for WebGL. Road widths, grades and vertical alignment remain unverified.",
  };
}

export interface TileModelStats {
  meshes: number;
  materials: number;
  textures: number;
}

/** Uses Three.js feature flags so detection also works across duplicated module instances. */
export function inspectTileModel(root: {
  traverse(callback: (object: unknown) => void): void;
}): TileModelStats {
  const stats = { meshes: 0, materials: 0, textures: 0 };
  const textures = new Set<unknown>();
  root.traverse((object) => {
    const mesh = object as { isMesh?: boolean; material?: unknown };
    if (!mesh?.isMesh) return;
    stats.meshes += 1;
    const materials = Array.isArray(mesh.material)
      ? mesh.material
      : mesh.material
        ? [mesh.material]
        : [];
    stats.materials += materials.length;
    for (const material of materials) {
      for (const value of Object.values(material as Record<string, unknown>)) {
        if ((value as { isTexture?: boolean } | null)?.isTexture)
          textures.add(value);
      }
    }
  });
  stats.textures = textures.size;
  return stats;
}
export function environmentState(
  s: EnvironmentStatus,
  fallback: boolean,
  error: string,
): EnvironmentStatus["status"] {
  if (fallback) return "FALLBACK";
  if (error) return "ERROR";
  return s.api === "OK" && s.visibleTexturedTiles > 0 ? "CONNECTED" : "LOADING";
}
export function authenticatedTileURL(url: string, key: string): string {
  const u = new URL(url, TILESET_URL);
  if (
    u.origin !== "https://data.map.gov.hk" ||
    !u.pathname.startsWith("/api/3d-data/3dtiles/f2/")
  )
    throw new Error("Unexpected tileset resource origin or product.");
  u.searchParams.set("key", key);
  return u.href;
}

export function localTileURL(url: string, applicationOrigin: string): string {
  const origin = new URL(applicationOrigin).origin;
  const u = new URL(url, new URL(LOCAL_TILESET_URL, origin));
  if (
    u.origin !== origin ||
    !u.pathname.startsWith("/data/landsd-track/")
  )
    throw new Error("Unexpected local track resource path.");
  return u.href;
}
