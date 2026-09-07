/**
 * Build a fixed, low-detail Chung Yee Street scenery package from LandsD f2.
 *
 * The output deliberately stops at the approximately 10 m geometric-error LOD.
 * It preserves the official textured B3DM payloads and does not create physics.
 *
 * Usage: node scripts/landsd/build_track_tiles.mjs [API_KEY]
 */
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { basename, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const OUTPUT = resolve(ROOT, "public/data/landsd-track");
const SOURCE =
  "https://data.map.gov.hk/api/3d-data/3dtiles/f2/11/Data/temp0/Tile_15_7_L4.json";
const PUBLIC_EXAMPLE_KEY = "3967f8f365694e0798af3e7678509421";
const KEY = process.argv[2] || PUBLIC_EXAMPLE_KEY;
const TILESET_TRANSLATION = [-2387000, 5407000, 2388000];
const MAX_DEPTH = 3;
const RADIUS = 630;

function localSphereInTileset([lonDegrees, latDegrees]) {
  const lon = (lonDegrees * Math.PI) / 180;
  const lat = (latDegrees * Math.PI) / 180;
  const e2 = 0.00669437999014;
  const n = 6378137 / Math.sqrt(1 - e2 * Math.sin(lat) ** 2);
  const origin = [
    n * Math.cos(lat) * Math.cos(lon),
    n * Math.cos(lat) * Math.sin(lon),
    n * (1 - e2) * Math.sin(lat),
  ];
  const east = [-Math.sin(lon), Math.cos(lon), 0];
  const up = [
    Math.cos(lat) * Math.cos(lon),
    Math.cos(lat) * Math.sin(lon),
    Math.sin(lat),
  ];
  const south = [
    Math.sin(lat) * Math.cos(lon),
    Math.sin(lat) * Math.sin(lon),
    -Math.cos(lat),
  ];
  const local = [-50, 90, -150];
  return origin.map(
    (value, i) =>
      value +
      east[i] * local[0] +
      up[i] * local[1] +
      south[i] * local[2] -
      TILESET_TRANSLATION[i],
  );
}

function intersectsSphere(box, center) {
  if (!box?.box) return false;
  const values = box.box;
  const boxCenter = values.slice(0, 3);
  const axes = [values.slice(3, 6), values.slice(6, 9), values.slice(9, 12)];
  const delta = center.map((value, i) => value - boxCenter[i]);
  let distanceSquared = 0;
  for (const axis of axes) {
    const length = Math.hypot(...axis);
    const projection = delta.reduce(
      (sum, value, i) => sum + value * (axis[i] / length),
      0,
    );
    const excess = Math.max(0, Math.abs(projection) - length);
    distanceSquared += excess ** 2;
  }
  return distanceSquared <= RADIUS ** 2;
}

function authenticated(url) {
  const parsed = new URL(url);
  parsed.searchParams.set("key", KEY);
  return parsed;
}

async function fetchChecked(url) {
  const response = await fetch(authenticated(url));
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}: ${url}`);
  return response;
}

function inspectB3dm(bytes) {
  const buffer = Buffer.from(bytes);
  if (buffer.subarray(0, 4).toString() !== "b3dm")
    throw new Error("Expected b3dm payload.");
  const glbOffset =
    28 +
    buffer.readUInt32LE(12) +
    buffer.readUInt32LE(16) +
    buffer.readUInt32LE(20) +
    buffer.readUInt32LE(24);
  if (buffer.subarray(glbOffset, glbOffset + 4).toString() !== "glTF")
    throw new Error("B3DM payload does not contain GLB content.");
  let offset = glbOffset + 12;
  while (offset < buffer.length) {
    const length = buffer.readUInt32LE(offset);
    const type = buffer.readUInt32LE(offset + 4);
    if (type === 0x4e4f534a) {
      const gltf = JSON.parse(
        buffer.subarray(offset + 8, offset + 8 + length).toString(),
      );
      return {
        meshes: gltf.meshes?.length || 0,
        materials: gltf.materials?.length || 0,
        textures: gltf.textures?.length || 0,
        imageTypes: [...new Set((gltf.images || []).map((image) => image.mimeType))],
      };
    }
    offset += 8 + length;
  }
  throw new Error("GLB JSON chunk not found.");
}

async function main() {
  const world = JSON.parse(await readFile(resolve(ROOT, "public/data/world.json")));
  const center = localSphereInTileset(world.originWGS84);
  const sourceResponse = await fetchChecked(SOURCE);
  const source = await sourceResponse.json();
  const downloads = [];

  function prune(tile, depth = 0) {
    if (!intersectsSphere(tile.boundingVolume, center)) return null;
    const result = {
      boundingVolume: tile.boundingVolume,
      geometricError: tile.geometricError,
      refine: tile.refine || "REPLACE",
    };
    if (tile.content?.uri?.endsWith(".b3dm")) {
      const remote = new URL(tile.content.uri, SOURCE).href;
      const filename = basename(new URL(remote).pathname);
      result.content = { uri: `tiles/${filename}` };
      downloads.push({ filename, remote, geometricError: tile.geometricError });
    }
    if (depth < MAX_DEPTH) {
      const children = (tile.children || []).map((child) => prune(child, depth + 1)).filter(Boolean);
      if (children.length) result.children = children;
    }
    return result;
  }

  const root = prune(source.root);
  if (!root || !downloads.length) throw new Error("No LandsD tiles intersect the configured AOI.");
  root.transform = [
    1, 0, 0, 0,
    0, 1, 0, 0,
    0, 0, 1, 0,
    ...TILESET_TRANSLATION, 1,
  ];
  await mkdir(resolve(OUTPUT, "tiles"), { recursive: true });

  const records = [];
  for (let offset = 0; offset < downloads.length; offset += 4) {
    const group = downloads.slice(offset, offset + 4);
    records.push(
      ...(await Promise.all(
        group.map(async ({ filename, remote, geometricError }) => {
          const bytes = new Uint8Array(await (await fetchChecked(remote)).arrayBuffer());
          const content = inspectB3dm(bytes);
          if (!content.textures || !content.imageTypes.includes("image/ktx2"))
            throw new Error(`${filename} has no KTX2 photographic texture.`);
          await writeFile(resolve(OUTPUT, "tiles", filename), bytes);
          return {
            file: `tiles/${filename}`,
            bytes: bytes.byteLength,
            sha256: createHash("sha256").update(bytes).digest("hex"),
            source: remote,
            geometricError,
            content,
          };
        }),
      )),
    );
  }

  const tileset = {
    asset: {
      version: "1.0",
      tilesetVersion: "Chung Yee corridor / LandsD f2 / coarse LOD",
      copyright: "The Government of the Hong Kong SAR, Lands Department",
    },
    geometricError: source.geometricError,
    root,
  };
  const manifest = {
    product: "LandsD 3D Visualisation Map — Tile-based f2",
    sourceTileset: SOURCE,
    aoiRadiusMetres: RADIUS,
    maximumDepth: MAX_DEPTH,
    geometricErrorRangeMetres: [
      Math.min(...records.map((record) => record.geometricError)),
      Math.max(...records.map((record) => record.geometricError)),
    ],
    files: records,
    totalBytes: records.reduce((sum, record) => sum + record.bytes, 0),
    note: "Photogrammetric visual scenery only. Custom GIS road remains the physics surface.",
  };
  await writeFile(resolve(OUTPUT, "tileset.json"), `${JSON.stringify(tileset)}\n`);
  await writeFile(resolve(OUTPUT, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`${records.length} tiles, ${(manifest.totalBytes / 1048576).toFixed(2)} MiB`);
}

await main();
