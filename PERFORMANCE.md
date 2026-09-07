# Performance and validation

Target: Chrome/Edge on a modern Windows gaming PC, 1920×1080, stable 60 FPS. **This target has not been measured or met as an acceptance claim.** The available remote browser has WebGL disabled, so it could test only the Canvas compatibility view and React/session flow.

Implemented budgets: fixed 60 Hz physics, 10 Hz React snapshots, 10 Hz replay (maximum 18,000 frames), 384×128 centre mirror refreshed every fourth medium-quality frame, capped render pixel ratio, low-quality shadows disabled, optional 3D tile cache maximum 180 entries and limited loading concurrency. Snapshot diagnostics show sampled FPS, draw calls, triangle counts, position and controls. FPS on a Canvas fallback is not 3D performance evidence.

## Evidence recorded during development

- 20 automated core tests: coordinate transforms, GIS identity/finite coordinates, progressive keyboard input, steering sign, hill hold/rollback, service brake, two synthetic wheel layouts, disconnect fallback, calibration conflicts, observation memory, missing-signal numbering, speed-episode deduplication, repeated-minor escalation, incomplete outcomes, replay immutability/seek, seeded randomness, form row preservation.
- Type checking passed after the compatibility-renderer DOM typing repair.
- Browser: absent-controller handling, start, handbrake release, vehicle motion and fault feedback checked in the Canvas fallback. The remaining review/replay checks are recorded in PROJECT_STATUS.md.
- Production build and lint pass. The minified simulation chunk is about 3.57 MB (before transfer compression); its size warning remains an optimization item, especially for first load.

## Required hardware run before a stable release

Use an actual Windows PC and G923. Record CPU/GPU, driver, browser version, viewport and renderer. Warm for 30 seconds, then drive the whole practice loop three times using a fixed seed at each quality setting. Collect median, p95 and p99 frame times; a 60 FPS target means a 16.7 ms frame budget, not merely an average FPS label. Repeat with traffic, mirror and streaming settings changed independently. Inspect memory over 30 minutes and retry/reset cycles. Check load-time failures and context loss.

Validate cockpit right-hand position, steering direction, centre and side mirror orientation, road/building alignment, hill transitions, collision boundaries, replay cameras, indicator state, and actual hardware calibration. Measure latency from a pedal change to simulation state and a rendered frame. Do not label the build performant until these measurements exist.
