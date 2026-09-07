# Engineering decisions

## 2026-09-06: real GIS before detailed scenery

Use TD centrelines and LandsD building footprints as the persistent geographic foundation. Explicitly estimate road widths and pavement-derived grades until authoritative detailed road surfaces are accessible. Do not present the resulting scene as surveyed or lane-accurate.

## Automatic vehicle first

A simple fixed-step bicycle model is inspectable and works with the normalized input interface. Rapier sensors supply actor overlap, rather than pretending the current model is a full rigid-body vehicle with suspension. Clutch and haptic abstractions may grow later; native TRUEFORCE is not claimed.

## Historical evidence stays historical

Preserve the supplied form's duplicate printed 62. Flag item 70's illegible term. Use the current official guide only for aggregation that was actually verified; leave detection thresholds and old-form mapping explicitly heuristic. Unimplemented rows are visible but unscored.

## Replay records state

Playback restores captured vehicle, actor and control state. It does not rely on re-running an evolving physics engine. Seeded retry is a separate capability; recorded playback and deterministic retry must not be conflated.

## Explicit compatibility fallback

Remote validation hardware does not expose WebGL. Show an explicitly labelled map view and disable misleading 3D camera choices. Keep this as graceful degradation; it is not evidence that the 3D acceptance criteria or 60 FPS target have been met.
