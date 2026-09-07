# Examination rules and limits

## Sources

The user supplied a photograph titled `driving test form(1).jpg`, containing an example test date of 1 January 2018. Its 73 rows are transcribed into `data/exam_rules/historical-form.json`. English text is an editorial translation. The original image is not committed because it includes personal form fields.

The photo prints **62 twice** and has no printed 63. Internal ID `62b` preserves the second row without silently changing the source. The final Chinese term in item 70 could not be read reliably and is explicitly flagged. Other text should be checked against a higher-resolution source before treating the transcription as archival-quality.

The [Transport Department private-car/light-goods-vehicle test guide, November 2025](https://www.td.gov.hk/filemanager/en/publication/guide%20to%20pc%20%26%20lgv%20driving%20test_eng_202511.pdf) was checked on 6 September 2026. It supports failure for one serious fault and escalation after three minor faults under one item. `policy.json` records those aggregation rules separately from simulator thresholds. It does not establish that the old form's numbering remains current.

## Enabled automatic detectors

| Historical item | Detector | Evidence | Severity used here |
| --- | --- | --- | --- |
| 21 | First move-off observation | Recorded rear/right looks, dwell and timestamps | Minor |
| 35 | Sustained speed above limit plus grace | Speed, source limit, elapsed episode | Serious |
| 39 | No move-off signal | Indicator state at first move-off | Minor |
| 41 | Actor overlap or estimated road-edge contact | Rapier actor ID or centreline offset/estimated width | Serious |
| 58 | Junction observation | Left/right look recency on selected practice checkpoints | Minor |

These detector conditions and severity assignments are **simulator heuristics**, not official automated rules. Speed grace (2 km/h), duration (2 s), observation dwell (0.35 s) and recency (5 s) are adjustable in JSON. A continuing speeding episode creates one event until the driver slows down. Repeated identical event IDs are ignored. The third separate minor event for the same item escalates to serious.

The other 68 form rows are reference-only and shown as unscored in the interface. No detector currently evaluates stop lines, traffic-signal compliance, priority gaps, pedestrian yielding, parallel parking, turnabout, blind-spot relevance by manoeuvre, or the full Part B/C curriculum. Steering toward an object does not count as looking at it.

A route ended early receives `incomplete`, never pass. Completing the provisional itinerary yields a training pass/fail based only on implemented detectors. That result is not evidence of readiness for a real test. Current official Part B/C manoeuvre structure and the entire latest marking scheme still require a fuller mapping before a stable training release.
