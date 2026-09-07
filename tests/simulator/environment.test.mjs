import test from "node:test";
import assert from "node:assert/strict";
import {
  initialEnvironment,
  environmentState,
  authenticatedTileURL,
  TILESET_URL,
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
