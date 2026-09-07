"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  ChevronRight,
  Settings2,
  Maximize,
  Pause,
  Play,
  RotateCcw,
  Keyboard,
  Volume2,
  VolumeX,
  MapPin,
  Flag,
  Eye,
  AlertTriangle,
  Download,
  X,
  Route,
  CircleGauge as SteeringWheel,
  Monitor,
} from "lucide-react";
import type { Simulation, Snapshot } from "../src/world/simulation";
import {
  DEFAULT_KEYS,
  validateCalibration,
  type Calibration,
  type Action,
} from "../src/input/input";
import { MiniMap } from "../components/simulator/mini-map";
import { CalibrationPanel } from "../components/simulator/calibration-panel";
import examForm from "../data/exam_rules/historical-form.json";
import type { WorldData } from "../src/world/types";
import { EnvironmentPanel } from "../components/simulator/environment-panel";
const time = (n: number) =>
  `${Math.floor(n / 60)
    .toString()
    .padStart(2, "0")}:${Math.floor(n % 60)
    .toString()
    .padStart(2, "0")}`;
function saved<T>(key: string, fallback: T): T {
  try {
    return JSON.parse(localStorage.getItem(key) || "null") ?? fallback;
  } catch {
    return fallback;
  }
}
export default function Simulator() {
  const host = useRef<HTMLDivElement>(null),
    sim = useRef<Simulation | null>(null);
  const [world, setWorld] = useState<WorldData | null>(null),
    [state, setState] = useState<Snapshot | null>(null),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true),
    [webgl, setWebgl] = useState(true),
    [tc, setTC] = useState(true),
    [control, setControl] = useState<"keyboard" | "wheel">("keyboard"),
    [mode, setMode] = useState("learn"),
    [seed, setSeed] = useState("HK-0042"),
    [calibrating, setCalibrating] = useState(false),
    [cal, setCal] = useState<Calibration | null>(null),
    [settings, setSettings] = useState(false),
    [rules, setRules] = useState(false),
    [map, setMap] = useState(false),
    [help, setHelp] = useState(false),
    [quality, setQuality] = useState("medium"),
    [audio, setAudio] = useState(false),
    [debug, setDebug] = useState(false),
    [keymap, setKeymap] = useState({ ...DEFAULT_KEYS }),
    [bind, setBind] = useState<Action | null>(null),
    [replayPlaying, setReplayPlaying] = useState(false),
    [view, setView] = useState("cockpit");
  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const [data, module] = await Promise.all([
          fetch("/data/world.json").then((r) => {
            if (!r.ok) throw new Error("Road data could not be loaded.");
            return r.json() as Promise<WorldData>;
          }),
          import("../src/world/simulation"),
        ]);
        if (!alive || !host.current) return;
        setCal(saved("cy-calibration", null));
        setKeymap(saved("cy-keys", { ...DEFAULT_KEYS }));
        setWorld(data);
        const s = new module.Simulation(host.current, data, (v) => {
          if (alive) setState(v);
        });
        sim.current = s;
        setWebgl(s.webgl);
        const compactDevice =
          window.innerWidth <= 900 ||
          window.matchMedia("(pointer: coarse)").matches;
        const selectedQuality = compactDevice ? "performance" : "medium";
        setQuality(selectedQuality);
        s.scene.setQuality(selectedQuality);
        s.keyboard.bindings = saved("cy-keys", { ...DEFAULT_KEYS });
        await s.initPhysics();
        if (alive) setLoading(false);
      } catch (e) {
        if (alive) {
          setError(e instanceof Error ? e.message : "Unable to start 3D view");
          setLoading(false);
        }
      }
    })();
    return () => {
      alive = false;
      sim.current?.dispose();
      sim.current = null;
    };
  }, []);
  useEffect(() => {
    if (!bind) return;
    const listener = (e: KeyboardEvent) => {
      e.preventDefault();
      const conflicting = (Object.keys(keymap) as Action[]).find(
        (a) => a !== bind && keymap[a] === e.code,
      );
      const next = {
        ...keymap,
        [bind]: e.code,
        ...(conflicting ? { [conflicting]: keymap[bind] } : {}),
      };
      setKeymap(next);
      if (sim.current) sim.current.keyboard.bindings = next;
      localStorage.setItem("cy-keys", JSON.stringify(next));
      setBind(null);
    };
    window.addEventListener("keydown", listener, { once: true });
    return () => window.removeEventListener("keydown", listener);
  }, [bind, keymap]);
  const phase = state?.phase ?? "ready",
    driving = ["driving", "paused", "replay"].includes(phase);
  const start = () => {
    const s = sim.current;
    if (!s) return;
    if (control === "wheel") {
      if (!cal || validateCalibration(cal)) {
        setCalibrating(true);
        return;
      }
      s.chooseWheel(cal);
    } else s.chooseKeyboard();
    s.start(mode, seed);
    setView("cockpit");
    (document.activeElement as HTMLElement)?.blur();
  };
  const pause = () => {
    sim.current?.pause();
    (document.activeElement as HTMLElement)?.blur();
  };
  const camera = (v: string) => {
    setView(v);
    if (sim.current) sim.current.scene.view = v;
  };
  const exportReplay = () => {
    if (!sim.current) return;
    const u = URL.createObjectURL(
        new Blob([sim.current.recorder.serialize()], {
          type: "application/json",
        }),
      ),
      a = document.createElement("a");
    a.href = u;
    a.download = `chung-yee-${seed.replace(/[^a-z0-9-]/gi, "-")}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(u), 1000);
  };
  return (
    <main className="simulator">
      <div className="scene" ref={host} />
      <div
        className={"scene-shade " + (phase === "ready" ? "home-shade" : "")}
      />
      {!webgl && (
        <div className="compatibility">
          {tc
            ? "3D 場景未能啟動：開發後備地圖模式。請查看環境面板的原因；此畫面並非實景模型。"
            : "3D initialization unavailable: DEVELOPMENT FALLBACK map. See the environment panel for the cause; this is not the photogrammetric mesh."}
        </div>
      )}
      <header className="topbar">
        <Link className="brand" href="/">
          <span className="brand-symbol">
            <Route size={23} />
          </span>
          <div>
            <strong>忠義街</strong>
            <span>CHUNG YEE · DRIVING PRACTICE</span>
          </div>
        </Link>
        <div className="top-actions">
          <span className="beta">
            {tc ? "道路練習 · 測試版" : "ROAD PRACTICE · PREVIEW"}
          </span>
          <button onClick={() => setTC((v) => !v)} aria-label="Change language">
            {tc ? "EN" : "繁"}
          </button>
          <button
            aria-label="Settings"
            onClick={() => {
              if (phase === "driving") sim.current?.pause();
              setSettings(true);
            }}
          >
            <Settings2 size={19} />
          </button>
          <button
            aria-label="Fullscreen"
            onClick={() => {
              if (document.fullscreenElement) void document.exitFullscreen();
              else void document.documentElement.requestFullscreen();
            }}
          >
            <Maximize size={19} />
          </button>
        </div>
      </header>
      {error ? (
        <section className="start-panel">
          <AlertTriangle />
          <h1>{tc ? "未能啟動模擬器" : "Unable to start simulator"}</h1>
          <p>{error}</p>
          <button onClick={() => location.reload()}>
            {tc ? "重新載入" : "Reload"}
          </button>
        </section>
      ) : phase === "ready" ? (
        <>
          <section className="start-panel">
            <p className="eyebrow">
              <span className="tiny-line" /> HO MAN TIN, HONG KONG
            </p>
            <h1>
              {tc ? (
                <>
                  熟悉每個路口。
                  <br />
                  <span>從容上路。</span>
                </>
              ) : (
                <>
                  Know the road.
                  <br />
                  <span>Drive with confidence.</span>
                </>
              )}
            </h1>
            <p className="intro">
              {tc
                ? "在忠義街及何文田的真實道路網絡上，練習觀察、車輛控制與路口判斷。"
                : "Practise observation, vehicle control and junction decisions on the real Chung Yee Street road network."}
            </p>
            <div className="section-label">
              <span>01</span>
              {tc ? "選擇練習模式" : "CHOOSE YOUR SESSION"}
            </div>
            <div className="mode-list">
              {[
                [
                  "learn",
                  "熟習路線",
                  "Learn the roads",
                  "路線提示 · 即時錯誤回饋",
                  "Route guidance · immediate feedback",
                ],
                [
                  "exam",
                  "模擬路試",
                  "Mock road test",
                  "考官指示 · 完成後檢討",
                  "Examiner directions · post-drive review",
                ],
              ].map(([id, zh, en, zh2, en2]) => (
                <button
                  key={id}
                  className={mode === id ? "mode selected" : "mode"}
                  onClick={() => setMode(id)}
                >
                  {id === "learn" ? <Route size={22} /> : <Flag size={22} />}
                  <div>
                    <strong>{tc ? zh : en}</strong>
                    <span>{tc ? zh2 : en2}</span>
                  </div>
                  <span className="radio" />
                </button>
              ))}
            </div>
            <div className="section-label">
              <span>02</span>
              {tc ? "選擇控制方式" : "CHOOSE YOUR CONTROLS"}
            </div>
            <div className="controls-choice">
              <button
                className={control === "keyboard" ? "selected" : ""}
                onClick={() => setControl("keyboard")}
              >
                <Keyboard size={25} />
                <strong>{tc ? "鍵盤" : "Keyboard"}</strong>
                <small>{tc ? "即時開始" : "Ready to drive"}</small>
              </button>
              <button
                className={control === "wheel" ? "selected" : ""}
                onClick={() => {
                  setControl("wheel");
                  if (!cal) setCalibrating(true);
                }}
              >
                <SteeringWheel size={25} />
                <strong>Logitech G923</strong>
                <small>
                  {cal
                    ? tc
                      ? "已儲存校準"
                      : "Calibration saved"
                    : tc
                      ? "接駁及校準"
                      : "Connect & calibrate"}
                </small>
              </button>
            </div>
            <button
              className="primary start-button"
              disabled={loading}
              onClick={start}
            >
              {loading
                ? tc
                  ? "正在準備道路…"
                  : "Preparing the roads…"
                : tc
                  ? "開始駕駛練習"
                  : "Start driving"}
              <ArrowRight size={20} />
            </button>
            <div className="start-links">
              <button onClick={() => setHelp(true)}>
                <Keyboard size={15} />
                {tc ? "操作說明" : "Controls"}
              </button>
              <button onClick={() => setMap(true)}>
                <MapPin size={15} />
                {tc ? "查看練習範圍" : "Practice area"}
              </button>
            </div>
            <p className="accuracy-note">
              {tc
                ? "真實街道中心線及建築輪廓；路闊、路面高度、交通設施仍待核實。"
                : "Real street centrelines and building footprints; widths, road levels and traffic controls remain unverified."}
            </p>
          </section>
          <aside className="location-card">
            <MapPin size={19} />
            <div>
              <strong>
                {tc ? "忠義街・何文田" : "Chung Yee Street · Ho Man Tin"}
              </strong>
              <span>
                {tc
                  ? "地政總署及運輸署空間數據"
                  : "Lands Department & Transport Department data"}
              </span>
            </div>
            <button aria-label="Open practice map" onClick={() => setMap(true)}>
              <ChevronRight size={20} />
            </button>
          </aside>
          <div className="weather-card">
            <span className="sun-icon">☀</span>
            <span>{tc ? "日間 · 乾燥路面" : "DAYLIGHT · DRY ROAD"}</span>
          </div>
        </>
      ) : null}
      {driving && state && (
        <>
          <div className="exam-direction">
            <ArrowRight color="#e5ba69" />
            <div>
              <small>
                {phase === "replay"
                  ? "DRIVE REPLAY"
                  : mode === "exam"
                    ? tc
                      ? "模擬考官"
                      : "VIRTUAL EXAMINER"
                    : tc
                      ? "路線提示"
                      : "ROUTE GUIDANCE"}
              </small>
              <strong>{tc ? state.instructionTC : state.instruction}</strong>
            </div>
            <span>{time(state.t)}</span>
          </div>
          {(mode === "learn" || phase === "replay") && (
            <aside className="driving-map">
              <MiniMap world={world} state={state} />
              <div>
                <MapPin size={14} />
                {tc ? state.roadTC : state.road}
              </div>
              <div className="progress-line">
                <span style={{ width: `${state.progress * 100}%` }} />
              </div>
            </aside>
          )}
          {mode === "learn" &&
            state.faults.length > 0 &&
            state.t - state.faults.at(-1)!.t < 6 &&
            phase !== "replay" && (
              <div className="fault-toast">
                <AlertTriangle size={18} />
                <div>
                  <strong>
                    {tc ? state.faults.at(-1)!.tc : state.faults.at(-1)!.en}
                  </strong>
                  <span>
                    {tc ? "訓練偵測 · 表格項目" : "Training detector · item"}{" "}
                    {state.faults.at(-1)!.item}
                  </span>
                </div>
              </div>
            )}
          <div className="instruments">
            <div
              className={
                "indicator " + (state.control.indicator === -1 ? "on" : "")
              }
            >
              <ArrowLeft size={24} />
            </div>
            <div className="speed">
              <strong>{Math.round(Math.abs(state.vehicle.speed) * 3.6)}</strong>
              <span>km/h</span>
            </div>
            <div className="gear">
              <strong>{state.control.gear}</strong>
              <span className={state.control.handbrake ? "brake-on" : ""}>
                {state.control.handbrake ? "( P )" : "AUTO"}
              </span>
            </div>
            <div
              className={
                "indicator " + (state.control.indicator === 1 ? "on" : "")
              }
            >
              <ArrowRight size={24} />
            </div>
          </div>
          <div className="drive-toolbar">
            <div className="view-control">
              <Monitor size={17} />
              <select
                disabled={!webgl}
                aria-label="Camera view"
                value={webgl ? view : "map"}
                onChange={(e) => camera(e.target.value)}
              >
                {!webgl && (
                  <option value="map">
                    {tc ? "俯視地圖模式" : "Top-down map mode"}
                  </option>
                )}
                <option value="cockpit">{tc ? "駕駛座視角" : "Cockpit"}</option>
                <option value="hood">{tc ? "車頭視角" : "Hood"}</option>
                {(mode === "learn" || phase === "replay") && (
                  <option value="chase">{tc ? "車尾視角" : "Chase"}</option>
                )}
                {phase === "replay" && (
                  <option value="overhead">
                    {tc ? "俯視重播" : "Overhead"}
                  </option>
                )}
              </select>
            </div>
            <span className="look-state">
              <Eye size={17} />
              {state.control.look === "forward"
                ? tc
                  ? "向前觀察"
                  : "Looking ahead"
                : state.control.look}
            </span>
            <button
              onClick={() => {
                setAudio(!audio);
                if (sim.current) {
                  sim.current.audioEnabled = !audio;
                  if (!audio) sim.current.startAudio();
                }
              }}
              aria-label="Toggle sound"
            >
              {audio ? <Volume2 size={18} /> : <VolumeX size={18} />}
            </button>
            <button
              disabled={phase === "replay"}
              onClick={pause}
              aria-label="Pause driving"
            >
              <Pause size={18} />
            </button>
            <button
              disabled={phase === "replay"}
              onClick={() => sim.current?.finish(false)}
            >
              {tc ? "結束練習" : "End session"}
            </button>
          </div>
          {mode === "learn" && phase === "driving" && state.t < 12 && (
            <div className="quick-tip">
              {tc
                ? "先觀察後方及右方 → 打指揮燈 → 按 Space 放手掣 → W 前進"
                : "Check rear & right → indicate → Space releases handbrake → W accelerates"}
            </div>
          )}
          {phase === "paused" && (
            <div className="modal-backdrop">
              <section className="modal pause-panel">
                <p className="eyebrow">SESSION PAUSED</p>
                <h2>
                  {!state.deviceConnected
                    ? tc
                      ? "方向盤已斷線"
                      : "Wheel disconnected"
                    : tc
                      ? "稍作休息"
                      : "Take a moment"}
                </h2>
                <p>
                  {tc
                    ? "繼續前，確認控制器已接駁並保持車輛安全。"
                    : "Check your controller and vehicle before continuing."}
                </p>
                <button
                  className="primary"
                  disabled={!state.deviceConnected}
                  onClick={pause}
                >
                  <Play size={18} />
                  {tc ? "繼續駕駛" : "Resume driving"}
                </button>
                <button
                  onClick={() => {
                    sim.current?.chooseKeyboard();
                    setControl("keyboard");
                    sim.current?.pause();
                  }}
                >
                  {tc ? "改用鍵盤繼續" : "Continue with keyboard"}
                </button>
                <button onClick={() => sim.current?.finish(false)}>
                  {tc ? "結束及檢討" : "End & review"}
                </button>
              </section>
            </div>
          )}
          {phase === "replay" && (
            <div className="replay-bar">
              <button
                onClick={() => {
                  if (sim.current) {
                    sim.current.replayPlaying = !replayPlaying;
                    setReplayPlaying(!replayPlaying);
                  }
                }}
                aria-label="Play replay"
              >
                {replayPlaying ? <Pause size={18} /> : <Play size={18} />}
              </button>
              <span>{time(state.t)}</span>
              <input
                aria-label="Replay timeline"
                type="range"
                min="0"
                max={state.replayDuration || 1}
                step="0.1"
                value={state.t}
                onChange={(e) => {
                  if (sim.current) sim.current.replayTime = +e.target.value;
                }}
              />
              <span>{time(state.replayDuration)}</span>
              <button
                onClick={() => {
                  if (sim.current) sim.current.phase = "result";
                }}
              >
                {tc ? "返回檢討" : "Back to review"}
              </button>
            </div>
          )}
        </>
      )}
      {phase === "result" && state && (
        <section className="results-panel">
          <p className="eyebrow">SESSION REVIEW · {seed}</p>
          <h1>
            {state.result === "incomplete"
              ? tc
                ? "練習已結束"
                : "Session ended"
              : state.result === "pass"
                ? tc
                  ? "訓練評估：合格"
                  : "Training result: pass"
                : tc
                  ? "訓練評估：不合格"
                  : "Training result: fail"}
          </h1>
          <p>
            {state.result === "incomplete"
              ? tc
                ? "尚未完成指定路線，因此不作合格／不合格判定。"
                : "The route was not completed, so no pass/fail result is issued."
              : tc
                ? "本結果只反映已實作的訓練偵測，並非官方考試評核。"
                : "This result covers implemented training detectors only; it is not an official assessment."}
          </p>
          <div className="result-stats">
            {[
              [time(state.t), tc ? "駕駛時間" : "Drive time"],
              [
                (state.vehicle.distance / 1000).toFixed(2) + " km",
                tc ? "駕駛距離" : "Distance",
              ],
              [
                state.faults.filter((f) => f.severity === "minor").length,
                tc ? "輕微錯誤" : "Minor faults",
              ],
              [
                state.faults.filter((f) => f.severity === "serious").length,
                tc ? "嚴重錯誤" : "Serious faults",
              ],
            ].map(([v, l]) => (
              <div key={l}>
                <strong>{v}</strong>
                <span>{l}</span>
              </div>
            ))}
          </div>
          <h3>{tc ? "逐項檢討" : "Review the evidence"}</h3>
          <div className="fault-list">
            {state.faults.length ? (
              state.faults.map((f) => (
                <article key={f.id}>
                  <div className={"fault-number " + f.severity}>{f.item}</div>
                  <div>
                    <strong>{tc ? f.tc : f.en}</strong>
                    <p>{f.evidence}</p>
                    <p>{f.correction}</p>
                    <span>
                      {f.severity} · {tc ? "模擬器判斷" : "simulator heuristic"}
                    </span>
                  </div>
                  <button
                    onClick={() => {
                      sim.current?.replay(Math.max(0, f.t - 3));
                      camera("overhead");
                      setReplayPlaying(false);
                    }}
                  >
                    <Play size={14} />
                    {time(f.t)}
                  </button>
                </article>
              ))
            ) : (
              <p>
                {tc
                  ? "本次沒有觸發已實作的錯誤偵測。"
                  : "No implemented fault detector was triggered."}
              </p>
            )}
          </div>
          <div className="result-actions">
            <button className="primary" onClick={start}>
              <RotateCcw size={17} />
              {tc ? "重試相同情境" : "Retry same scenario"}
            </button>
            <button
              disabled={!state.replayDuration}
              onClick={() => {
                sim.current?.replay();
                camera("cockpit");
                setReplayPlaying(false);
              }}
            >
              <Play size={17} />
              {tc ? "重播" : "Replay"}
            </button>
            <button onClick={exportReplay} aria-label="Download replay">
              <Download size={17} />
            </button>
            <button
              onClick={() => {
                setSeed(
                  "HK-" +
                    Math.floor(Math.random() * 100000)
                      .toString()
                      .padStart(5, "0"),
                );
                if (sim.current) sim.current.phase = "ready";
              }}
            >
              {tc ? "新情境" : "New scenario"}
            </button>
          </div>
        </section>
      )}
      <footer className="footnote">
        <span>
          {tc
            ? "僅供訓練・非運輸署官方評核"
            : "FOR TRAINING ONLY · NOT AN OFFICIAL TD ASSESSMENT"}
        </span>
        <a href="https://portal.csdi.gov.hk/" target="_blank" rel="noreferrer">
          © 香港特別行政區政府 · LandsD / TD
        </a>
      </footer>
      {settings && (
        <div className="modal-backdrop">
          <section
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-label="Settings"
          >
            <button
              className="close"
              onClick={() => setSettings(false)}
              aria-label="Close settings"
            >
              <X />
            </button>
            <p className="eyebrow">PREFERENCES</p>
            <h2>{tc ? "駕駛設定" : "Driving settings"}</h2>
            <label className="field">
              {tc ? "畫質" : "Graphics"}
              <select
                value={quality}
                onChange={(e) => {
                  setQuality(e.target.value);
                  sim.current?.scene.setQuality(e.target.value);
                }}
              >
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="performance">
                  Performance · simplified LandsD LOD
                </option>
              </select>
            </label>
            <label className="field">
              {tc ? "情境編號（下次練習）" : "Scenario seed (next drive)"}
              <input
                value={seed}
                onChange={(e) => setSeed(e.target.value)}
                maxLength={40}
              />
            </label>
            <button
              disabled={!webgl}
              className="setting-row"
              onClick={() => {
                sim.current?.scene.enableTiles();
              }}
            >
              <span>
                {tc
                  ? "重新連接地政總署 Tile-based 實景（f2）"
                  : "Reconnect LandsD Tile-based mesh (f2)"}
              </span>
              <span>{state?.environment.status}</span>
            </button>
            <button
              disabled={!webgl}
              className="setting-row"
              onClick={() => sim.current?.scene.disableTiles()}
            >
              {tc
                ? "選用開發後備場景（非實景模型）"
                : "Use DEVELOPMENT FALLBACK (not the real mesh)"}
            </button>
            <p className="subtle">
              {tc
                ? "預設載入 Tile-based 攝影測量模型。後備場景必須手動選用；API 錯誤不會自動切換成方塊建築。道路精度及垂直對齊仍待核實。"
                : "Tile-based photogrammetry loads by default. Procedural scenery is an explicit development fallback, never an automatic substitute for API errors. Road accuracy and vertical alignment remain unverified."}
            </p>
            <button
              className="setting-row"
              onClick={() => {
                setSettings(false);
                setCalibrating(true);
              }}
            >
              <SteeringWheel size={19} />
              {tc ? "校準 G923" : "Calibrate G923"}
            </button>
            <button
              className="setting-row"
              onClick={() => {
                localStorage.removeItem("cy-calibration");
                setCal(null);
                setControl("keyboard");
                sim.current?.chooseKeyboard();
              }}
            >
              {tc ? "重設方向盤校準" : "Reset wheel calibration"}
            </button>
            <button className="setting-row" onClick={() => setDebug((v) => !v)}>
              {tc ? "開發者資訊" : "Developer diagnostics"}
              <span>{debug ? "On" : "Off"}</span>
            </button>
            <button
              className="setting-row"
              onClick={() => {
                setSettings(false);
                setRules(true);
              }}
            >
              {tc
                ? "考試表格參考（歷史版本）"
                : "Test form reference (historical)"}
            </button>
            <h3>{tc ? "自訂鍵盤按鍵" : "Keyboard bindings"}</h3>
            <div className="key-bindings">
              {(Object.keys(keymap) as Action[]).map((a) => (
                <button key={a} onClick={() => setBind(a)}>
                  <span>{a}</span>
                  <kbd>
                    {bind === a
                      ? "Press key…"
                      : keymap[a].replace("Key", "").replace("Digit", "")}
                  </kbd>
                </button>
              ))}
            </div>
          </section>
        </div>
      )}
      {rules && (
        <div className="modal-backdrop">
          <section
            className="modal info-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Test form reference"
          >
            <button
              className="close"
              aria-label="Close test form"
              onClick={() => setRules(false)}
            >
              <X />
            </button>
            <p className="eyebrow">HISTORICAL REFERENCE</p>
            <h2>{tc ? "駕駛考試表格" : "Driving test form"}</h2>
            <p>
              {tc
                ? "以下為你提供的歷史表格，共 73 行。原圖重複印上「62」，第 70 項有字樣未能清楚辨認。英文為本專案譯文，並非官方譯文。"
                : "73 rows from the supplied historical form. The image prints 62 twice; part of item 70 is unclear. English text is an editorial translation."}
            </p>
            <p>
              {tc
                ? "「參考」項目尚未有自動偵測。已實作項目亦只屬訓練判斷。"
                : "Reference items have no automatic detector. Implemented detectors are training heuristics."}
            </p>
            <div className="form-reference">
              {examForm.items.map((item) => (
                <article key={item.id}>
                  <span>{item.id}</span>
                  <div>
                    <small>{tc ? item.categoryTC : item.categoryEN}</small>
                    <strong>{tc ? item.tc : item.en}</strong>
                    <small>
                      {item.detector
                        ? tc
                          ? "訓練偵測"
                          : "Training detector"
                        : tc
                          ? "參考・未自動評分"
                          : "Reference · not scored"}
                    </small>
                  </div>
                </article>
              ))}
            </div>
          </section>
        </div>
      )}
      {calibrating && (
        <CalibrationPanel
          tc={tc}
          close={() => {
            setCalibrating(false);
            if (!cal) setControl("keyboard");
          }}
          onSave={(c) => {
            setCal(c);
            localStorage.setItem("cy-calibration", JSON.stringify(c));
            setCalibrating(false);
            setControl("wheel");
          }}
        />
      )}
      {(map || help) && (
        <div className="modal-backdrop">
          <section
            className="modal info-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Practice information"
          >
            <button
              className="close"
              aria-label="Close information"
              onClick={() => {
                setMap(false);
                setHelp(false);
              }}
            >
              <X />
            </button>
            <p className="eyebrow">BEFORE YOU DRIVE</p>
            <h2>
              {map
                ? tc
                  ? "何文田練習範圍"
                  : "Ho Man Tin practice area"
                : tc
                  ? "駕駛操作"
                  : "Driving controls"}
            </h2>
            {map ? (
              <>
                <MiniMap world={world} state={state} large />
                <p>
                  {tc
                    ? "忠義街 → 孝民街 → 迦密村街 → 忠孝街。此路線是練習安排，並非已核實的官方考試路線。"
                    : "Chung Yee Street → Hau Man Street → Carmel Village Street → Chung Hau Street. A practice itinerary, not a verified official test route."}
                </p>
                <p>
                  {tc
                    ? "街道中心線和建築位置來自官方空間數據。路闊、路面坡度、標記及交通情境仍屬近似重建。"
                    : "Official GIS supplies street centrelines and buildings. Road widths, gradients, markings and traffic scenarios are approximate reconstructions."}
                </p>
              </>
            ) : (
              <>
                <div className="controls-table">
                  {[
                    ["W / ↑", "油門", "Accelerator"],
                    ["S / ↓", "煞車", "Brake"],
                    ["A D / ← →", "轉向", "Steer"],
                    ["Space", "手掣", "Handbrake"],
                    ["Q / E", "望左 / 望右", "Look left / right"],
                    ["R", "觀察後方", "Look behind"],
                    [
                      "1 / 2",
                      "左 / 右鏡方向",
                      "Look towards left / right mirror",
                    ],
                    [
                      "Z / X / C",
                      "左 / 右 / 取消指揮燈",
                      "Left / right / cancel indicator",
                    ],
                    [
                      "3 / 4 / 5",
                      "前進 / 倒車 / 空檔",
                      "Drive / reverse / neutral",
                    ],
                    ["Esc", "暫停", "Pause"],
                  ].map(([key, zh, en]) => (
                    <div key={key}>
                      <kbd>{key}</kbd>
                      <span>{tc ? zh : en}</span>
                    </div>
                  ))}
                </div>
                <p>
                  {tc
                    ? "觀察方向保持至少約半秒。手掣預設拉起；開行前先觀察、打指揮燈並放手掣。"
                    : "Hold each observation for about half a second. The handbrake starts engaged; observe, indicate and release it before moving off."}
                </p>
              </>
            )}
          </section>
        </div>
      )}
      {state && <EnvironmentPanel status={state.environment} tc={tc} />}
      {debug && state && (
        <pre className="debug-panel">
          {JSON.stringify(
            {
              fps: state.fps,
              frameMs: 1000 / state.fps,
              drawCalls: state.drawCalls,
              triangles: state.triangles,
              position: state.vehicle,
              control: state.control,
              environment: state.environment,
              physics: "Rapier sensor contacts + bicycle model",
              faults: state.faults.length,
            },
            null,
            2,
          )}
        </pre>
      )}
    </main>
  );
}
