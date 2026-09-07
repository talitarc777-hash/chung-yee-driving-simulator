import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { Texture } from "three";
import { normalizeLandsDKtx2 } from "../../src/render/landsd-gltf.ts";

test("actual LandsD payloads select KTX2 loader and attach material maps", async () => {
  const root = new URL("../../public/data/landsd-track/", import.meta.url);
  const manifest = JSON.parse(readFileSync(new URL("manifest.json", root)));
  // GLTFLoader uses self.URL for embedded buffer-view images.
  const previous = globalThis.self;
  globalThis.self = globalThis;
  try {
    for (const record of manifest.files) {
      const b = readFileSync(new URL(record.file, root));
      const offset = 28 + [12, 16, 20, 24].reduce((n, p) => n + b.readUInt32LE(p), 0);
      const glb = b.buffer.slice(b.byteOffset + offset, b.byteOffset + b.length);
      let decoded = 0;
      const loader = new GLTFLoader();
      // Spy at the decoder boundary; does not claim GPU transcoding validation.
      loader.setKTX2Loader({ load: (_url, done) => { decoded++; done(new Texture()); } });
      loader.register(parser => ({ name: "LANDSD_KTX2_COMPATIBILITY",
        beforeRoot: () => { normalizeLandsDKtx2(parser.json); },
      }));
      const result = await loader.parseAsync(glb, "");
      let mapped = 0;
      result.scene.traverse(o => { if (o.isMesh && o.material.map?.isTexture) mapped++; });
      assert.ok(decoded > 0, `${record.file}: KTX2 decoder selected`);
      assert.ok(mapped > 0, `${record.file}: texture attached to material`);
    }
  } finally { globalThis.self = previous; }
});

test("adapter is idempotent and leaves normal images alone", () => {
  const json = { images: [{ mimeType: "image/ktx2" }, { mimeType: "image/png" }],
    textures: [{ source: 0 }, { source: 1 }] };
  assert.equal(normalizeLandsDKtx2(json), 1);
  assert.equal(normalizeLandsDKtx2(json), 0);
  assert.equal(json.textures[1].extensions, undefined);
});
