# 忠義街 · Chung Yee Driving Practice

**Visual correction:** the main environment now requests LandsD Tile-based photogrammetric **f2** automatically. Procedural city geometry is a labelled development fallback, not the intended final environment. See [environment audit, implementation and open visual acceptance tests](docs/ENVIRONMENT_CORRECTION.md).

Browser driving-practice prototype for Chung Yee Street, Ho Man Tin, Hong Kong. It uses official street centrelines and building footprints, with a Three.js cockpit, progressive keyboard input, configurable Gamepad calibration, training fault evidence and session replay.

**Status: development preview, not a geographically validated or official driving-test simulator.** Road widths and road elevations remain approximations. Traffic controls, full assessment coverage, physical G923 testing and the 1080p/60 FPS target are not yet verified. Read [PROJECT_STATUS.md](PROJECT_STATUS.md) before relying on a practice result.

## Run

Use Node 24 LTS (minimum 22.13):

```sh
npm ci
npm run dev
```

Open the local URL Vite prints. In ChatGPT Work use the managed Sites preview. The main photogrammetric environment needs internet access and WebGL2. The committed road asset can support explicitly selected development fallback practice offline after loading. Chrome/Edge with WebGL2 is the intended target; a labelled top-down Canvas fallback is provided when 3D rendering is unavailable.

```sh
npm test
npm run typecheck
npm run lint
npm run build
```

## Practice

Choose Learn or Mock mode, then keyboard or a calibrated controller. The car starts in automatic Drive with the handbrake engaged. Check rear and right, indicate, release Space, then accelerate with W. End a session to inspect fault evidence and replay it. An unfinished route always receives an incomplete result.

Mock mode removes the route map, initial hints and immediate fault messages. Both modes currently use the same provisional practice itinerary; this is not a verified Transport Department test route. The only enabled automatic fault items are 21, 35, 39, 41 and 58. A pass covers only those implemented detectors.

## Documentation

- [Controls and calibration](CONTROLS.md)
- [Architecture and boundaries](ARCHITECTURE.md)
- [GIS sources, processing and accuracy](DATA_SOURCES.md)
- [Historical form and current scoring policy](EXAM_RULES.md)
- [Performance evidence and hardware test procedure](PERFORMANCE.md)
- [Third-party data and software](THIRD_PARTY_LICENSES.md)
- [Project status and next work](PROJECT_STATUS.md)
- [Engineering decisions](docs/DECISIONS.md)

The GitHub repository is the source of truth. Work happens on focused feature branches; production deployment and the private Sites source mirror must refer to the same committed source. No private data or credentials are needed for baseline practice.
