# Architecture

**Updated visual architecture:** a route-corridor package of official LandsD Tile-based photogrammetric `f2` tiles is now the default visual environment, with separate GIS road overlay/physics. The live API remains optional, and procedural surroundings are an explicitly selected development fallback only. See [the correction audit and acceptance gates](docs/ENVIRONMENT_CORRECTION.md).

React/Vinext provides the interface and Cloudflare-compatible application shell. Simulation runs entirely in the client. No account, driving history or calibration is sent to an application database.

## Modules

| Module | Responsibility |
| --- | --- |
| `src/input` | Common normalized controls, progressive keyboard input, Gamepad calibration and disconnection fallback |
| `src/vehicle` | Fixed-step automatic kinematic bicycle model; steering, braking, slope gravity and handbrake |
| `src/world` | Session lifecycle, actual GIS geometry, seeded actors, route checkpoints, fixed 60 Hz scheduling |
| `src/render` | Three.js world and right-hand cockpit; independent Canvas compatibility renderer |
| `src/exam` | Observation memory, rule events, deduplication, evidence and result aggregation |
| `src/replay` | Immutable 10 Hz recording and binary-search seeking |
| `data/exam_rules` | Versioned historical form and scoring-policy/heuristic separation |
| `scripts/gis` | Download, clip, transform, densify and document official geographic inputs |

Coordinates are local east/up/south metres, with origin HK1980 EPSG:2326 (836720,819145). Positive yaw points east from south; right steering decreases yaw. Ground height uses HKPD where supplied, but road contact elevations are interpolated pavement proxies. Render geometry does not drive vehicle contact: nearest-road projection and estimated widths define the current drivable envelope. Rapier kinematic sensors detect actor overlap. This is not a finished road triangle-mesh collision or suspension model.

The fixed-step accumulator caps catch-up at six steps and bounds a frame delta to 100 ms. It deliberately slows simulation after severe stalls rather than allowing a huge physics jump. React receives snapshots at 10 Hz. Blur, hidden documents and wheel disconnection pause the session. Pause/replay do not advance the exam.

Traffic uses a seeded PRNG and the supplied road polylines. Actors follow left offsets for presumed two-way roads and stop behind nearby actors. Intersection priority and signal compliance are not implemented. The raw travel-direction code interpretation remains provisional. Parked vehicles and the pedestrian currently use fixed positions/timing, so changing seed changes moving traffic only.

Replay stores poses, controls, actor state and a reserved scenario-light state; it plays recorded frames rather than re-running physics. Records stop accepting frames at 18,000 entries (30 minutes at 10 Hz). The current UI exports JSON; importing external records is not exposed. Checkpoint/progress and camera metadata are not fully replayed yet.

## Rendering

The default visible city is a 4.61 MiB, 15-sector route package containing official textured B3DM payloads from the government Tile-based photogrammetric f2 hierarchy. It stops at the approximately 10 m geometric-error level to cap complexity without synthesizing replacement buildings or textures. The custom roads, kerbs and pavement ribbons remain separate and use estimated widths. Government tiles are visual only and still unverified for vertical alignment. Footprint extrusions, procedural facades and estimated terrain are built only after the user explicitly selects DEVELOPMENT FALLBACK. The centre mirror uses a 384×128 render target refreshed every fifth medium-quality frame and is disabled in performance mode; side-mirror keys currently turn the camera rather than rendering independent side mirrors.

Quality settings adjust resolution, shadows, mirror refresh and tile error tolerance without removing photogrammetry. The local package uses a 630 m AOI, 24-tile/64 MiB cache ceiling, three parallel reads and one parse job. Live mode retains camera culling, AOI intersection, look-ahead preloading and larger LRU budgets. Coarse parent tiles can span beyond the AOI. See PERFORMANCE.md for unverified rendering gates.
