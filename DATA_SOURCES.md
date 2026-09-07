# Geographic sources and accuracy

All baseline named street centrelines and building footprints originate in Hong Kong government GIS, not hand-drawn imitation streets. The processed asset is `public/data/world.json`; URLs, retrieval metadata and checksums are in `data/metadata/sources.json`.

| Input | Official service | Use and limitation |
| --- | --- | --- |
| TD Road Network | `https://portal.csdi.gov.hk/server/rest/services/common/td_rcd_1638949160594_2844/MapServer` | Layer 10 centrelines, layer 2 speed records, layer 12 intersections. Codes and joins need field validation. |
| LandsD buildings | `https://portal.csdi.gov.hk/server/rest/services/common/landsd_rcd_1637211194312_35158/FeatureServer/0` | Footprints, BaseHeight and TopHeight; facade textures are procedural. |
| LandsD 3D pedestrian network | `https://portal.csdi.gov.hk/server/rest/services/common/landsd_rcd_1637222018065_52265/FeatureServer/0` | Outdoor named-street footpath height samples only; pavement elevations are not carriageway surveys. |
| LandsD 3D Visualisation Map API | https://portal.csdi.gov.hk/csdi-webpage/apidoc/3d-visualisation-map-api | Source of the default optimized Tile-based f2 route package; live f2 remains optional. Vertical alignment and driver-view result are unverified. |

AOI is EPSG:2326 `(836300,818850)` to `(837040,819720)`, restricted to Chung Yee, Hau Man, Chung Hau, Carmel Village and Fat Kwong streets. Output contains 49 road polylines and 271 buildings. Road polylines are sampled about every three metres. Six-neighbour inverse-distance interpolation supplies approximate height, followed by a nine-sample smoothing window. The centreline ELEVATION attribute is not used as metres because it represents a structural layer.

Widths are **estimated** (7.2 m, or 10.5 m on Fat Kwong Street). Kerbs, centre dashes and pavement geometry follow those estimates. Detailed iB1000 downloads attempted from the official service returned HTTP 502; survey road boundaries and authoritative road spot heights have not been recovered. No exact lane-level claim is made. Travel-direction codes 1/3 are currently interpreted by geometric inference, not a verified source dictionary; do not enforce authoritative one-way penalties until that is resolved.

Limits are joined by road-route ID when available, otherwise a labelled default of 50 km/h is stored. The join and physical signage need manual checking. Traffic-light, stop/give-way and crossing locations have not been placed as authoritative real-world controls. The itinerary is a practice loop, not an official test route.

## Reproduce

```sh
python -m venv .venv
.venv/bin/pip install -r scripts/gis/requirements.txt
.venv/bin/python scripts/gis/build_world.py
```

Raw responses are cached in ignored `data/raw`; `--refresh` fetches anew. The downloader refuses server errors, exceeded transfer limits and missing height samples. Inspect changes to official geometry and source hashes before committing. The pipeline has only been exercised on this clipped area, not arbitrary ArcGIS layers.

`node scripts/landsd/build_track_tiles.mjs [API_KEY]` reproducibly selects a 630 m Chung Yee Street AOI from the official f2 hierarchy and writes `public/data/landsd-track`. The checked-in package contains 15 official textured B3DM payloads (4.61 MiB total), each validated for a mesh, material and KTX2 texture. It is a delivery/LOD optimization, not a newly authored substitute city and not a physics collider.

Local delivery avoids API round trips, CORS and authorization during play. Camera culling, screen-space error and a bounded cache still apply. Ellipsoid/HKPD alignment remains unverified. Keep photogrammetry enabled for final visual/performance acceptance; procedural fallback tests do not count. See docs/ENVIRONMENT_CORRECTION.md and THIRD_PARTY_LICENSES.md.
