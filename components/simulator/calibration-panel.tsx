"use client";
import { useEffect, useRef, useState } from "react";
import {
  X,
  Check,
  ChevronRight,
  CircleGauge as SteeringWheel,
} from "lucide-react";
import {
  detectBinding,
  value,
  normalize,
  validateCalibration,
  type Calibration,
  type Pad,
  type Action,
} from "../../src/input/input";
const copyPad = (p: Gamepad): Pad => ({
  id: p.id,
  connected: p.connected,
  axes: [...p.axes],
  buttons: p.buttons.map((b) => ({ value: b.value, pressed: b.pressed })),
});
export function CalibrationPanel({
  close,
  onSave,
  tc,
}: {
  close: () => void;
  onSave: (c: Calibration) => void;
  tc: boolean;
}) {
  const [pads, setPads] = useState<Pad[]>([]),
    [index, setIndex] = useState(0),
    [step, setStep] = useState(0),
    [error, setError] = useState(""),
    [bindings, setBindings] = useState<Partial<Calibration>>({
      version: 1,
      buttons: {},
    }),
    [action, setAction] = useState<Action | null>(null);
  const baseline = useRef<Pad | null>(null),
    left = useRef<Pad | null>(null);
  useEffect(() => {
    const id = setInterval(() => {
      const p = Array.from(navigator.getGamepads?.() ?? [])
        .filter((p): p is Gamepad => !!p)
        .map(copyPad);
      setPads(p);
      if (action && p[index]) {
        const i = p[index].buttons.findIndex((b) => b.pressed);
        if (i >= 0) {
          setBindings((v) => ({
            ...v,
            buttons: { ...v.buttons, [action]: i },
          }));
          setAction(null);
        }
      }
    }, 80);
    return () => clearInterval(id);
  }, [index, action]);
  const pad = pads[index],
    steps = tc
      ? [
          "方向盤轉至最左並保持",
          "方向盤轉至最右並保持",
          "方向盤回正並保持",
          "放開油門及其他踏板",
          "踩盡油門並保持",
          "放開煞車及其他踏板",
          "踩盡煞車並保持",
          "設定按鈕並檢查讀數",
        ]
      : [
          "Hold the wheel fully left",
          "Hold the wheel fully right",
          "Centre the steering wheel",
          "Release accelerator and other pedals",
          "Hold accelerator fully pressed",
          "Release brake and other pedals",
          "Hold brake fully pressed",
          "Assign buttons and check live values",
        ];
  const capture = () => {
    if (!pad) return;
    setError("");
    if (step === 0) left.current = structuredClone(pad);
    if (step === 1) {
      const b = detectBinding(left.current!, pad);
      if (!b || b.kind !== "axis") {
        setError("No steering axis movement detected. Restart calibration.");
        return;
      }
      setBindings((v) => ({
        ...v,
        steering: {
          ...b,
          min: Math.min(b.min, b.max),
          max: Math.max(b.min, b.max),
          invert: b.min > b.max,
        },
      }));
    }
    if (step === 2) {
      const b = bindings.steering!,
        center = value(pad, b);
      if (center <= b.min + 0.1 || center >= b.max - 0.1) {
        setError("Centre the wheel before capturing.");
        return;
      }
      setBindings((v) => ({ ...v, steering: { ...b, center } }));
    }
    if (step === 3 || step === 5) baseline.current = structuredClone(pad);
    if (step === 4 || step === 6) {
      const b = detectBinding(baseline.current!, pad);
      if (!b) {
        setError("No pedal movement detected.");
        return;
      }
      if (
        b.kind === bindings.steering?.kind &&
        b.index === bindings.steering?.index
      ) {
        setError("Steering moved. Keep the wheel still.");
        return;
      }
      setBindings((v) => ({ ...v, [step === 4 ? "throttle" : "brake"]: b }));
    }
    setStep((s) => s + 1);
  };
  return (
    <div className="modal-backdrop">
      <section
        className="modal calibration"
        role="dialog"
        aria-modal="true"
        aria-label="G923 calibration"
      >
        <button
          className="close"
          onClick={close}
          aria-label="Close calibration"
        >
          <X />
        </button>
        <p className="eyebrow">LOGITECH G923</p>
        <h2>{tc ? "校準方向盤及踏板" : "Wheel & pedal calibration"}</h2>
        <p>
          {tc
            ? "請接駁方向盤，然後按一下方向盤上的按鈕。"
            : "Connect your wheel, then press a wheel button to expose it to the browser."}
        </p>
        {!pad ? (
          <div className="empty-device">
            <SteeringWheel size={44} />
            <h3>{tc ? "未偵測到控制器" : "No controller detected"}</h3>
            <p>
              {tc
                ? "本頁會自動重新偵測；亦可使用鍵盤。"
                : "Detection refreshes automatically. Keyboard mode is available."}
            </p>
            <button onClick={close}>{tc ? "使用鍵盤" : "Use keyboard"}</button>
          </div>
        ) : (
          <>
            <select
              value={index}
              onChange={(e) => {
                setIndex(+e.target.value);
                setStep(0);
                setBindings({ version: 1, buttons: {} });
              }}
              aria-label="Controller"
            >
              {pads.map((p, i) => (
                <option value={i} key={i}>
                  {p.id}
                </option>
              ))}
            </select>
            <div className="step-title">
              <span>
                {Math.min(step + 1, 8)
                  .toString()
                  .padStart(2, "0")}{" "}
                / 08
              </span>
              <h3>{steps[Math.min(step, 7)]}</h3>
            </div>
            <div className="raw-axes">
              {pad.axes.map((v, i) => (
                <div key={i}>
                  <span>Axis {i}</span>
                  <meter min={-1} max={1} value={v} />
                  <code>{v.toFixed(2)}</code>
                </div>
              ))}
            </div>
            {error && <p className="error">{error}</p>}
            {step < 7 ? (
              <button className="primary" onClick={capture}>
                {tc ? "記錄此位置" : "Capture position"}
                <ChevronRight size={18} />
              </button>
            ) : (
              <>
                <div className="live-pedals">
                  {(["steering", "throttle", "brake"] as const).map((k) => (
                    <label key={k}>
                      {k}
                      <meter
                        min={k === "steering" ? -1 : 0}
                        max={1}
                        value={normalize(
                          value(pad, bindings[k]!),
                          bindings[k]!,
                          k === "steering",
                        )}
                      />
                      <input
                        aria-label={`${k} curve`}
                        type="range"
                        min="0.6"
                        max="2"
                        step="0.1"
                        value={bindings[k]!.curve}
                        onChange={(e) =>
                          setBindings((v) => ({
                            ...v,
                            [k]: { ...v[k]!, curve: +e.target.value },
                          }))
                        }
                      />
                    </label>
                  ))}
                </div>
                <div className="button-mapping">
                  {(
                    [
                      "handbrake",
                      "indicatorLeft",
                      "indicatorRight",
                      "lookLeft",
                      "lookRight",
                      "rear",
                      "mirrorLeft",
                      "mirrorRight",
                      "drive",
                      "reverse",
                      "cancel",
                    ] as Action[]
                  ).map((a) => (
                    <button
                      key={a}
                      className={action === a ? "selected" : ""}
                      onClick={() => setAction(a)}
                    >
                      {a}
                      <span>
                        {action === a
                          ? "Press…"
                          : bindings.buttons?.[a] === undefined
                            ? "Assign"
                            : `B${bindings.buttons[a]}`}
                      </span>
                    </button>
                  ))}
                </div>
                <p className="subtle">
                  {tc
                    ? "必須設定手掣、指揮燈及觀察按鈕。原生 TRUEFORCE 不適用於本網頁。"
                    : "Assign handbrake, indicators and observation buttons. Native TRUEFORCE is not available in this webpage."}
                </p>
                <button
                  className="primary"
                  disabled={(
                    [
                      "handbrake",
                      "indicatorLeft",
                      "indicatorRight",
                      "lookLeft",
                      "lookRight",
                      "rear",
                    ] as Action[]
                  ).some((a) => bindings.buttons?.[a] === undefined)}
                  onClick={() => {
                    const c = { ...bindings, deviceId: pad.id } as Calibration;
                    const problem = validateCalibration(c);
                    if (problem) setError(problem);
                    else onSave(c);
                  }}
                >
                  {tc ? "儲存校準" : "Save calibration"}
                  <Check size={18} />
                </button>
              </>
            )}
            <button
              className="text-button"
              onClick={() => {
                setStep(0);
                setBindings({ version: 1, buttons: {} });
                setError("");
              }}
            >
              {tc ? "重新開始校準" : "Restart calibration"}
            </button>
          </>
        )}
        <p className="subtle">
          {tc
            ? "校準只儲存於這個瀏覽器。"
            : "Calibration is stored only in this browser."}
        </p>
      </section>
    </div>
  );
}
