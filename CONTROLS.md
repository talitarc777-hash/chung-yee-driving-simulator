# Controls

| Action | Default |
| --- | --- |
| Accelerator / brake | W / S, or Up / Down |
| Steer left / right | A / D, or Left / Right |
| Toggle handbrake | Space |
| Look left / right | Q / E |
| Look behind | R |
| Look toward left / right mirror | 1 / 2 |
| Left / right / cancel indicator | Z / X / C |
| Drive / reverse / neutral | 3 / 4 / 5 |
| Pause / resume | Escape |

Steering and pedals ramp progressively. A duplicate custom key swaps the previous assignment; arrow aliases remain available. Observation is based on deliberate held input, never inferred from steering or eye tracking. The current dwell is 0.35 seconds, remembered for five seconds; both are training heuristics.

## G923 and other Gamepad devices

Connect the wheel and press a button so the browser exposes it. Select the device and capture full left, full right and centre. Release all pedals, capture accelerator release/full press, then brake release/full press. The wizard discovers whichever axis or analogue button changes; no fixed device layout is assumed. Bind distinct buttons for handbrake, indicators and observations, inspect live normalized values, then save. Calibration stays in localStorage for that browser.

Descending pedal axes, asymmetric steering travel and inverted steering are handled. Conflicting pedal channels and duplicated action buttons are rejected. Device ID is matched on use. Disconnecting pauses practice and applies a safe brake input. Reconnect to resume, or explicitly switch to keyboard.

The input abstraction accepts optional clutch data but the current automatic-car wizard does not calibrate it. Physical G923 hardware, Windows drivers, browser axis exposure and paddle/gear mapping require hardware validation. Two synthetic layouts are covered by automated tests; they are not a claim that a real wheel has been tested. The haptic interface currently reports unsupported. Native TRUEFORCE is not provided.
