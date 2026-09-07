import * as T from "three";
import { TilesRenderer } from "3d-tiles-renderer/three";
import { GLTFExtensionsPlugin } from "3d-tiles-renderer/three/plugins";
import { KTX2Loader } from "three/addons/loaders/KTX2Loader.js";
import type { Tile } from "3d-tiles-renderer/core";
import type { WorldData, Vehicle } from "../world/types";
import {
  authenticatedTileURL,
  environmentState,
  initialEnvironment,
  inspectTileModel,
  localTileURL,
  LOCAL_TILESET_URL,
  PUBLIC_EXAMPLE_KEY,
  TILESET_URL,
  tileRequestOptions,
  validateTileResponse,
} from "./environment";
import type { TileModelStats } from "./environment";
import { normalizeLandsDKtx2 } from "./landsd-gltf";

type SpatialTile = Tile & {
  engineData: { boundingVolume: { intersectsSphere(s: T.Sphere): boolean } };
};
type ViewError = { inView: boolean; error: number; distance: number };

/** Photogrammetric scenery only. Never creates or updates a physics collider. */
export class LandsDEnvironment {
  tiles: TilesRenderer | null = null;
  status = initialEnvironment();
  error = "";
  fallback = false;
  localToECEF = new T.Matrix4();
  ecefToLocal = new T.Matrix4();
  loaded = new Map<T.Object3D, TileModelStats>();
  visible = new Set<T.Object3D>();
  ahead = new T.Sphere(new T.Vector3(), 65);
  aoi = new T.Sphere(new T.Vector3(-50, 90, -150), 630);
  private startedAt = 0;
  private lastLoadError = "";
  private performanceProfile = false;
  private ktx2: KTX2Loader | null = null;
  constructor(
    private scene: T.Scene,
    private camera: T.Camera,
    private renderer: T.WebGLRenderer,
    world: WorldData,
  ) {
    const [lonD, latD] = world.originWGS84,
      lon = (lonD * Math.PI) / 180,
      lat = (latD * Math.PI) / 180;
    const n = 6378137 / Math.sqrt(1 - 0.00669437999014 * Math.sin(lat) ** 2);
    const origin = new T.Vector3(
      n * Math.cos(lat) * Math.cos(lon),
      n * Math.cos(lat) * Math.sin(lon),
      n * (1 - 0.00669437999014) * Math.sin(lat),
    );
    this.localToECEF
      .makeBasis(
        new T.Vector3(-Math.sin(lon), Math.cos(lon), 0),
        new T.Vector3(
          Math.cos(lat) * Math.cos(lon),
          Math.cos(lat) * Math.sin(lon),
          Math.sin(lat),
        ),
        new T.Vector3(
          Math.sin(lat) * Math.cos(lon),
          Math.sin(lat) * Math.sin(lon),
          -Math.cos(lat),
        ),
      )
      .setPosition(origin);
    this.ecefToLocal.copy(this.localToECEF).invert();
    this.aoi.applyMatrix4(this.localToECEF);
  }
  start(
    delivery: "local" | "live" = "local",
    key = PUBLIC_EXAMPLE_KEY,
  ) {
    this.stop();
    this.fallback = false;
    this.error = "";
    this.lastLoadError = "";
    this.status = initialEnvironment();
    this.status.api = "PENDING";
    this.status.delivery =
      delivery === "local" ? "LOCAL TRACK PACKAGE" : "LIVE API";
    this.status.source =
      delivery === "local"
        ? "LandsD f2 — optimized Chung Yee corridor"
        : "LandsD 3D Visualisation Map — Tile-based";
    this.status.detail =
      delivery === "local"
        ? "Loading the fixed 4.61 MiB LandsD-derived route package; no procedural city substitution."
        : "Loading live f2 photogrammetric mesh; no procedural city substitution. Vertical alignment is unverified.";
    const applicationOrigin = window.location.origin;
    const tilesetURL =
      delivery === "local"
        ? localTileURL(LOCAL_TILESET_URL, applicationOrigin)
        : authenticatedTileURL(TILESET_URL, key);
    const tiles = new TilesRenderer(tilesetURL);
    this.tiles = tiles;
    tiles.group.matrix.copy(this.ecefToLocal);
    tiles.group.matrixAutoUpdate = false;
    this.scene.add(tiles.group);
    tiles.setCamera(this.camera);
    tiles.errorTarget = 16;
    tiles.loadSiblings = false;
    tiles.lruCache.maxSize = 180;
    tiles.lruCache.minSize = 100;
    tiles.downloadQueue.maxJobsPerOrigin = 3;
    tiles.parseQueue.maxJobs = 1;
    const ktx2 = new KTX2Loader()
      .setTranscoderPath("/basis/")
      .detectSupport(this.renderer);
    this.ktx2 = ktx2;
    // The plugin's v0.5.2 auto-disposer assumes a Draco loader also exists.
    tiles.registerPlugin(
      new GLTFExtensionsPlugin({ ktxLoader: ktx2, autoDispose: false,
        plugins: [(parser) => ({
          name: "LANDSD_KTX2_COMPATIBILITY",
          beforeRoot: async () => { normalizeLandsDKtx2(parser.json); },
        })],
      }),
    );
    this.applyPerformanceProfile(tiles);
    this.startedAt = performance.now();
    tiles.registerPlugin({
      name: "landsd-f2-access-and-aoi",
      preprocessURL: (url: string) =>
        delivery === "local"
          ? localTileURL(url, applicationOrigin)
          : authenticatedTileURL(url, key),
      fetchData: async (url: string, options: RequestInit) => {
        this.status.requests += 1;
        try {
          const response = await fetch(url, tileRequestOptions(delivery, options));
          validateTileResponse(response, url);
          if (this.tiles === tiles) this.status.api = "OK";
          return response;
        } catch (e) {
          if (e instanceof Error && e.name === "AbortError") throw e;
          if (this.tiles !== tiles) throw e;
          this.status.api = "ERROR";
          this.status.failedRequests += 1;
          this.lastLoadError =
            e instanceof TypeError
              ? delivery === "local"
                ? "The packaged Chung Yee scenery could not be read from this site."
                : "LandsD browser fetch failed. Check Network for CORS, connectivity or origin authorization; the browser does not distinguish these here."
              : e instanceof Error
                ? e.message
                : "LandsD request failed.";
          this.error = this.lastLoadError;
          this.status.status = "ERROR";
          this.status.detail = this.error;
          throw new Error(this.lastLoadError);
        }
      },
      calculateTileViewError: (tile: SpatialTile, target: ViewError) => {
        // Bounds are in tileset/ECEF space, not local driving coordinates.
        if (!tile.engineData.boundingVolume.intersectsSphere(this.aoi)) {
          Object.assign(target, {
            inView: false,
            error: 0,
            distance: Infinity,
          });
          return true;
        }
        // Coarse look-ahead preloading; all other in-AOI tiles retain camera SSE/culling.
        if (tile.engineData.boundingVolume.intersectsSphere(this.ahead)) {
          Object.assign(target, {
            inView: true,
            error: Math.max(0, (tile.geometricError / 8) * tiles.errorTarget),
            distance: 65,
          });
          return true;
        }
        return false;
      },
    });
    tiles.addEventListener("load-model", ({ scene }) => {
      if (this.tiles !== tiles) return;
      const stats = inspectTileModel(scene);
      this.loaded.set(scene, stats);
      if (stats.textures > 0) {
        this.error = "";
        this.lastLoadError = "";
      }
    });
    tiles.addEventListener("dispose-model", ({ scene }) => {
      if (this.tiles !== tiles) return;
      this.loaded.delete(scene);
      this.visible.delete(scene);
    });
    tiles.addEventListener("tile-visibility-change", ({ scene, visible }) => {
      if (this.tiles !== tiles) return;
      if (visible) this.visible.add(scene);
      else this.visible.delete(scene);
    });
    tiles.addEventListener("load-error", () => {
      if (this.tiles === tiles) {
        this.lastLoadError ||=
          "f2 resource failed to load or decode. Inspect the browser network and console. No fallback was selected.";
        this.error = this.lastLoadError;
        this.status.status = "ERROR";
        this.status.detail = this.error;
      }
    });
  }
  setPerformanceProfile(enabled: boolean) {
    this.performanceProfile = enabled;
    this.status.visualProfile = enabled ? "SMOOTH PERFORMANCE" : "STANDARD";
    if (this.tiles) this.applyPerformanceProfile(this.tiles);
  }
  private applyPerformanceProfile(tiles: TilesRenderer) {
    const local = this.status.delivery === "LOCAL TRACK PACKAGE";
    this.status.visualProfile = this.performanceProfile
      ? "SMOOTH PERFORMANCE"
      : "STANDARD";
    tiles.errorTarget = this.performanceProfile ? 32 : 16;
    tiles.lruCache.maxSize = local
      ? 24
      : this.performanceProfile
        ? 110
        : 180;
    tiles.lruCache.minSize = local
      ? 15
      : this.performanceProfile
        ? 55
        : 100;
    tiles.lruCache.maxBytesSize = local
      ? 64 * 1024 * 1024
      : this.performanceProfile
        ? 180 * 1024 * 1024
        : 320 * 1024 * 1024;
    tiles.lruCache.minBytesSize = local
      ? 32 * 1024 * 1024
      : this.performanceProfile
        ? 110 * 1024 * 1024
        : 220 * 1024 * 1024;
  }
  update(renderer: T.WebGLRenderer, v: Vehicle) {
    const tiles = this.tiles;
    if (!tiles) return;
    this.ahead.center
      .set(v.x + Math.sin(v.yaw) * 50, v.y + 20, v.z + Math.cos(v.yaw) * 50)
      .applyMatrix4(this.localToECEF);
    tiles.setResolutionFromRenderer(this.camera, renderer);
    tiles.update();
    this.status.tilesLoaded = this.loaded.size;
    const modelStats = [...this.loaded.values()];
    this.status.texturedTiles = modelStats.filter((s) => s.textures > 0).length;
    this.status.visibleTexturedTiles = [...this.visible].filter((s) =>
      Boolean(this.loaded.get(s)?.textures),
    ).length;
    this.status.meshesLoaded = modelStats.reduce((n, s) => n + s.meshes, 0);
    this.status.materialsLoaded = modelStats.reduce(
      (n, s) => n + s.materials,
      0,
    );
    this.status.textureReferences = modelStats.reduce(
      (n, s) => n + s.textures,
      0,
    );
    const cache = tiles.lruCache as typeof tiles.lruCache & {
      cachedBytes: number;
    };
    this.status.cacheMB = Math.round((cache.cachedBytes / 1048576) * 10) / 10;
    this.status.cacheFull = tiles.lruCache.isFull();
    if (this.status.visibleTexturedTiles > 0) {
      this.error = "";
      this.status.api = "OK";
    }
    if (
      performance.now() - this.startedAt >
        (this.status.delivery === "LOCAL TRACK PACKAGE" ? 20000 : 45000) &&
      !this.status.visibleTexturedTiles &&
      !this.error
    ) {
      this.error = this.lastLoadError
        ? `${this.lastLoadError} KTX2 decoder is installed; inspect failed-request and material counters.`
        : `${this.status.delivery === "LOCAL TRACK PACKAGE" ? "Packaged" : "Live"} textured tiles were not visible before the loading deadline. KTX2 decoder is installed; check camera alignment and cache saturation.`;
    }
    this.status.status = environmentState(
      this.status,
      this.fallback,
      this.error,
    );
    if (this.error) this.status.detail = this.error;
    else if (this.status.status === "CONNECTED")
      this.status.detail =
        this.status.delivery === "LOCAL TRACK PACKAGE"
          ? "Optimized LandsD f2 corridor is rendered from local sectors. Driver-view alignment remains unverified."
          : "Textured live f2 tiles are selected for rendering. Driver-view/Open3Dhk comparison and vertical alignment are not yet validated.";
  }
  setFallback() {
    this.stop();
    this.fallback = true;
    this.status.status = "FALLBACK";
    this.status.detail =
      "DEVELOPMENT FALLBACK selected explicitly: procedural buildings, not the LandsD photogrammetric mesh.";
  }
  stop() {
    if (this.tiles) {
      this.scene.remove(this.tiles.group);
      this.tiles.dispose();
      this.tiles = null;
    }
    this.ktx2?.dispose();
    this.ktx2 = null;
    this.loaded.clear();
    this.visible.clear();
    this.status.tilesLoaded = 0;
    this.status.texturedTiles = 0;
    this.status.visibleTexturedTiles = 0;
    this.status.meshesLoaded = 0;
    this.status.materialsLoaded = 0;
    this.status.textureReferences = 0;
    this.status.cacheMB = 0;
    this.status.cacheFull = false;
  }
}
