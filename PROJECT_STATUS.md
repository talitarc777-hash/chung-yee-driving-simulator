# Project status — development preview

## Tile-based environment correction

The default is now LandsD Tile-based `f2`, with explicit source/API/loaded-texture diagnostics and a separately selected development fallback. Root endpoint and origin-header checks succeeded with the documented public example key. Driver-eye texture appearance, Open3Dhk comparison, vertical alignment and 60 FPS remain unverified. See `docs/ENVIRONMENT_CORRECTION.md`. The GitHub write retry again failed with HTTP 403; no GitHub save is claimed.

This is an initial working foundation, not completion of the full requested simulator. No stable release is claimed.

| Area | Implemented | Remaining acceptance work |
| --- | --- | --- |
| GIS | Official street centrelines, building footprints/heights, clipped asset and repeatable script | Surveyed road boundaries, carriageway heights, lane geometry, authoritative direction codes and field alignment |
| Driving | Automatic bicycle model, progressive keyboard, handbrake, slope gravity, actor overlap | Suspension/road contact mesh, full vehicle dynamics, lane/kerb validation, stopping-distance calibration |
| Controller | Discovered axes, steering limits/centre, pedals, curves, action mapping, persistence, disconnect pause | Physical G923, optional clutch wizard, reliable paddle/gear mapping, saturation settings, haptics |
| Visuals | Three.js right-hand cockpit, buildings, roads, player/traffic cars, centre mirror, camera modes | Actual WebGL visual QA, side mirrors, optimized geometry, recognizable facade details, verified 3D-tile alignment |
| Traffic | Seeded cars, basic following, parked obstacles, crossing pedestrian | Signals and priority, safe gap decisions, verified control positions, variable parking/hazards, robust network navigation |
| Exam | Five automatic fault items, evidence, aggregation, incomplete result, Learn/Mock separation | Full manoeuvre curriculum and current form mapping; other rows remain reference-only |
| Replay | 10 Hz recorded state, seek, play/pause, evidence jump, JSON export, same seed retry | Import validation/UI, complete recorded route state, storage-limit notice, richer evidence overlays |
| Interface | Traditional Chinese/English main screens, settings, form reference, explicit map fallback | Translate evidence/corrections and all binding labels; accessibility and mobile refinements |
| Performance | Fixed-step scheduling, mirror/tile budgets, quality options, diagnostics | 1080p/60 FPS measurements, long-session memory, full driving-loop QA |

## Validation

20 automated tests pass. TypeScript checks pass. Browser evidence covers keyboard movement and missing-signal feedback in the explicit Canvas fallback, plus controller-absent handling. Production build and lint pass. The browser also confirms an incomplete result, item-level evidence and the replay screen. All browser checks used Canvas compatibility mode; no 3D acceptance or stable-release claim is made.

## Next work in priority order

1. Recover detailed authoritative road boundary/spot-height data and verify travel-direction codes. Validate against current street observations before enabling lane-specific scoring.
2. Run the actual 3D build on WebGL2 hardware and a physical G923; correct spatial/cockpit/grade/collision issues before visual polish.
3. Implement validated signal, junction, pedestrian and parked-vehicle scenarios using explicit state machines and additional evidence tests.
4. Expand current private-car assessment coverage, stopping/parking/turnabout tasks, fault events and replay fidelity.
5. Optimize against measured frame-time and memory profiles; complete bilingual/accessibility work.

Do not merge or label a stable milestone solely because core unit tests pass. Review the known limitations in the feature pull request. Missing data, unavailable WebGL and unavailable physical wheel hardware are concrete acceptance blockers.

## Persistence blocker

On 6 September 2026, the connected GitHub integration returned HTTP 403 `Resource not accessible by integration` when creating the initial README in `talitarc777-hash/chung-yee-driving-simulator`. No GitHub changes or pull request were created. The feature-branch source is preserved with the private Sites preview, pending restored GitHub Contents write access. GitHub remains the intended source of truth; the Sites copy is a temporary preservation measure.
