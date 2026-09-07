# Visual environment correction — 7 September 2026

## Audit before changes

| Question | Observed implementation before correction |
| --- | --- |
| Exact default environment | Three.js building-footprint extrusions, procedural facades, estimated ground, road and pavement ribbons |
| LandsD data? | Yes, footprint geometry and base/top heights; not the final photogrammetric visual product |
| Which product? | The LandsD building GIS service listed in DATA_SOURCES.md; rendered by our own extrusion code |
| Individualised / Non-textured / Tile-based / 3D-BIT00? | None of those 3D model products supplied the default visible buildings. This was a custom GIS reconstruction. |
| Runtime | Three.js; optional `3d-tiles-renderer/three` for f2 |
| Was f2 requested? | Only after selecting the experimental scenery switch; off by default |
| Government texture imagery visible? | Not verified. Procedural facade textures must not be mistaken for aerial texture imagery. |
| Fallback in use? | Yes: procedural 3D by default on WebGL devices; explicitly labelled Canvas map when WebGL was unavailable |
| Why? | Previous implementation treated the government tile stream as an optional experiment rather than the required main environment. |

## Verified official source

- [LandsD 3D Mapping](https://www.landsd.gov.hk/en/survey-mapping/mapping/3d-mapping.html) describes Tile-based models as meshes generated from oblique aerial images.
- [Official API documentation](https://portal.csdi.gov.hk/csdi-webpage/apidoc/3d-visualisation-map-api) identifies Cesium 3D Tiles/WGS84 and still documents `https://data.map.gov.hk/api/3d-data/3dtiles/f2/tileset.json?key=[key]`.
- On 6 September 2026, GET with the documented public example key returned HTTP 200, a 3D Tiles 1.1 root and child tileset references. An origin-header check also returned `Access-Control-Allow-Origin` matching the existing private Site origin. These are HTTP checks, not proof of browser texture rendering or access to every child resource.
- The public example key is not a private credential. A dedicated free API key can be requested from LandsD if the service later rejects the example key. No private key is currently required by the observed root response.

## Corrected architecture

1. **Visible surroundings:** a same-origin, 4.61 MiB route package of 15 official LandsD Tile-based photogrammetric `f2` B3DM files, enabled automatically. It preserves the government KTX2 texture maps and approximately 10–82 m geometric-error hierarchy. Live f2 streaming remains selectable for diagnosis and comparison. No procedurally generated city is automatically substituted after an error.
2. **Custom road overlay:** the existing separate GIS-derived asphalt/kerb/pavement/marking group remains enabled. Estimated widths and pavement-derived gradients are still unvalidated. This change does not make them exact.
3. **Physics road:** the existing road projection and Rapier actor contacts remain independent of streamed scenery. No photogrammetry collider is created.
4. **Dynamic scene:** learner car, traffic, pedestrian and cockpit remain separate from both road data and government scenery.
5. **Development fallback:** procedural buildings/terrain are hidden unless selected explicitly in Settings. A device without WebGL reports DEVELOPMENT FALLBACK and displays its existing 2D compatibility map, with API NOT REQUESTED rather than a false API failure.

`scripts/landsd/build_track_tiles.mjs` reproducibly prunes the official hierarchy to the route AOI, downloads the selected payloads and validates that every B3DM contains meshes, materials and KTX2 textures. This is a packaging and LOD selection step, not a hand-modelled city and not a physics mesh. `src/render/landsd-environment.ts` owns tile loading, ECEF-to-local placement, failures, counters and loading bounds. `environment.ts` contains the endpoints and testable status policy. The panel requires successful access AND a textured model selected for rendering before CONNECTED. That label means resource/render-selection readiness, not a passed visual comparison. Decode errors and the absence of visible textured tiles remain explicit; reconnection is manual.

## Loading budget

- Small 630 m radius AOI around the existing Ho Man Tin practice loop. Tiles whose bounding volumes do not intersect it are excluded; ancestors spanning a wider area can still be needed for traversal.
- Main camera far plane: 650 m; camera frustum/SSE controls refinement inside the AOI.
- SSE targets: high 8, medium 16, performance 32.
- Coarse preloading in a 65 m radius region centred 50 m ahead of the car; refinement target about 8 m geometric error. This is local look-ahead preloading, not full-route high-resolution preloading.
- Same-origin package: 15 payloads, 4.61 MiB total, 24-tile / 64 MiB cache ceiling, three concurrent reads and one parse job.
- Live mode: no sibling prefetch; standard cache 180 tiles / 320 MB, performance cache 110 tiles / 180 MB.
- Quality modes retain the photogrammetric stream. They never switch to boxes to satisfy an FPS target.

## KTX2 texture correction and lightweight profile

Inspection of an official f2 B3DM payload confirmed that it contains an embedded
`image/ktx2` image and uses `KHR_materials_unlit`. The earlier renderer registered no
KTX2/Basis transcoder, so tile geometry could complete while the photographic texture
failed to decode. The runtime now registers `KTX2Loader` through
`GLTFExtensionsPlugin` and serves the required Basis worker locally.

Material diagnostics now use Three.js capability flags (`isMesh`, `isTexture`) rather
than `instanceof`, which is unreliable when different packages resolve separate Three.js
module instances. The panel reports mesh, material, texture-reference, request, failure,
and cache counters.

The mobile default is **SMOOTH PERFORMANCE**. It uses the coarser meshes already
present in LandsD's official 3D Tiles LOD hierarchy, reduced pixel density, disabled
dynamic shadows and no rendered centre mirror. Menu/result rendering is capped at 20 FPS;
driving and replay retain continuous rendering with fixed 60 Hz physics. Procedural terrain
and building meshes are not constructed unless the fallback is explicitly selected. This
is a simplified LandsD-derived view, not a procedural replacement. The custom road and
Rapier physics surface remain independent.

## Why this follows racing-game practice

Web racing scenes are normally authored as bounded track sectors rather than loading an
entire city at maximum detail. Their main tools are offline asset preparation, spatial
sectors, multiple LODs, compressed GPU textures, frustum/distance culling, small draw and
memory budgets, and a simple dedicated collision surface. This implementation applies
those principles while retaining the official LandsD photographic texture and geometry:
same-origin route sectors, existing f2 LODs, KTX2/Basis decoding, camera SSE/culling, a
bounded cache, and the independent custom physics road.

The project does **not** yet run a lossy mesh-decimation/retexture pass. That would require
measured triangle, UV-seam and visual-comparison results on target hardware. Selecting the
official coarse LOD is currently the lower-risk simplification because it preserves source
materials and geographic form.

## Acceptance gates still open

Automated tests verify package completeness, path confinement, KTX2/material detection and status policy. TypeScript, lint and production-build checks are required before each commit. The available automated preview reports WebGL2 unavailable, so it cannot establish driver-view appearance or GPU frame time. Therefore no Open3Dhk comparison or 60 FPS acceptance is claimed here.

Driver-eye comparison with Open3Dhk is required at Chung Yee Street, Hau Man Street junction and the next route section. Check buildings, retaining walls, vegetation, texture detail and road placement. Actual WGS84 vertical datum to HKPD registration remains unvalidated; the existing local transform has no claimed surveyed vertical correction. Road masking/compositing where the mesh road occludes the custom road must be validated after that alignment; this patch does not pretend to solve it by rendering roads through buildings.

Do not mark the environment visually complete until a WebGL2 run actually shows the textured surroundings and passes that comparison. Do not claim 60 FPS without a target-machine frame-time capture. HTTP 200, loaded tile counts, passing unit tests and the 2D fallback are not substitutes.

## GitHub

Repository write access was restored on 7 September 2026. The project source is mirrored at [talitarc777-hash/chung-yee-driving-simulator](https://github.com/talitarc777-hash/chung-yee-driving-simulator); publication of a new Site version remains a separate explicit action.
