import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  initialEnvironment,
  environmentState,
  authenticatedTileURL,
  TILESET_URL,
  LOCAL_TILESET_URL,
  localTileURL,
  inspectTileModel,
} from "../../src/render/environment.ts";
test("root API success cannot claim a connected textured environment", () => {
  const s = { ...initialEnvironment(), api: "OK", tilesLoaded: 8 };
  assert.equal(environmentState(s, false, ""), "LOADING");
  assert.equal(
    environmentState({ ...s, texturedTiles: 2 }, false, ""),
    "LOADING",
  );
  assert.equal(
    environmentState(
      { ...s, texturedTiles: 2, visibleTexturedTiles: 1 },
      false,
      "",
    ),
    "CONNECTED",
  );
});
test("local track resources cannot escape the packaged scenery directory", () => {
  assert.equal(
    new URL(localTileURL("tiles/a.b3dm", "https://sim.example")).pathname,
    "/data/landsd-track/tiles/a.b3dm",
  );
  assert.equal(LOCAL_TILESET_URL, "/data/landsd-track/tileset.json");
  assert.throws(() =>
    localTileURL("https://example.org/a.b3dm", "https://sim.example"),
  );
  assert.throws(() =>
    localTileURL("/outside/a.b3dm", "https://sim.example"),
  );
});
test("optimized LandsD package is complete and retains textured official payloads", () => {
  const root = resolve(process.cwd(), "public/data/landsd-track");
  const manifest = JSON.parse(readFileSync(resolve(root, "manifest.json")));
  assert.equal(manifest.product, "LandsD 3D Visualisation Map — Tile-based f2");
  assert.equal(manifest.files.length, 15);
  assert.ok(manifest.totalBytes < 5 * 1024 * 1024);
  for (const record of manifest.files) {
    assert.ok(existsSync(resolve(root, record.file)));
    assert.ok(record.content.meshes > 0);
    assert.ok(record.content.materials > 0);
    assert.ok(record.content.textures > 0);
    assert.ok(record.content.imageTypes.includes("image/ktx2"));
  }
});
test("tile materials and textures are detected without instanceof", () => {
  const texture = { isTexture: true };
  const objects = [
    { isMesh: true, material: { map: texture, normalMap: null } },
    { isMesh: true, material: [{ map: texture }, { emissiveMap: { isTexture: true } }] },
    { isMesh: false, material: { map: { isTexture: true } } },
  ];
  assert.deepEqual(
    inspectTileModel({ traverse: (callback) => objects.forEach(callback) }),
    { meshes: 2, materials: 3, textures: 2 },
  );
});
test("API errors and explicitly selected fallbacks never claim CONNECTED", () => {
  const s = { ...initialEnvironment(), api: "OK", visibleTexturedTiles: 5 };
  assert.equal(environmentState(s, false, "HTTP 403"), "ERROR");
  assert.equal(environmentState(s, true, ""), "FALLBACK");
});
test("f2 credentials stay on the verified official product endpoint", () => {
  const u = new URL(authenticatedTileURL("3/tileset.json", "test-only"));
  assert.equal(u.pathname, "/api/3d-data/3dtiles/f2/3/tileset.json");
  assert.equal(u.searchParams.get("key"), "test-only");
  assert.equal(
    TILESET_URL,
    "https://data.map.gov.hk/api/3d-data/3dtiles/f2/tileset.json",
  );
  assert.throws(() =>
    authenticatedTileURL("https://example.org/resource", "test-only"),
  );
  assert.throws(() =>
    authenticatedTileURL("https://data.map.gov.hk/other/resource", "test-only"),
  );
});
