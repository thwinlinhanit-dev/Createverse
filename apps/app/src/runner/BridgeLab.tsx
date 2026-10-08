import { useEffect, useRef, useState } from "react";
import type {
  DesignPiece,
  ExperienceRuntime,
  MaterialId,
  PieceType,
  RuntimeEvent,
} from "@createverse/experience-runtime";
import type { ExperienceSpec } from "@createverse/shared-types";
import type { MessageKey } from "@createverse/i18n";
import { useApp } from "../AppContext";
import { useT } from "../i18n";
import { Button } from "../components/ui";
import Icon from "../Icon";
import type { SavedLabDesign, SavedLabPiece } from "../progress/store.ts";
import { asHud, createWebRuntime } from "./labRuntime.ts";

/**
 * Bridge lab: canvas + WebExperienceRuntime + DOM HUD (P1-05 experiment step).
 *
 * Shape (EXPERIENCE_RUNTIME.md §7): the canvas draws the world only; every
 * control is DOM for accessibility and localization. Commands flow app →
 * runtime through `dispatch`; results flow back through `onEvent` and land
 * in the progress store via `onDesignChange` / `onRunFinished` — the lab
 * itself never touches accounts, hints, curriculum or the database.
 *
 * Placement works three ways: tap/click twice on the canvas, or focus the
 * building area and use arrow keys + Enter (keyboard/switch alternative,
 * EXPERIENCE_RUNTIME.md §10), Escape cancels. Snap errors from the domain
 * become calm child-facing messages, never physics jargon.
 */

export interface LabRunResult {
  readonly success: boolean;
  readonly reasons: string;
  readonly vehicle: string;
  readonly cost: number;
  readonly peakLoadRatio: number;
  readonly crossed: boolean;
  readonly heldSeconds: number;
  readonly unstable: boolean;
}

export interface LabProps {
  readonly spec: ExperienceSpec;
  readonly messages: Readonly<Record<string, string>>;
  readonly stepId: string;
  /** "interactive" in the browser; "headless" in jsdom tests (same code path). */
  readonly mode?: "interactive" | "headless";
  /** Injected for tests; production lazy-loads WebExperienceRuntime. */
  readonly runtimeFactory?: () => Promise<ExperienceRuntime> | ExperienceRuntime;
  readonly initialDesign?: SavedLabDesign | null;
  readonly onDesignChange?: (design: SavedLabDesign) => void;
  readonly onRunFinished?: (result: LabRunResult) => void;
}

type Phase = "loading" | "build" | "running" | "done";

const KNOWN_PIECE_TYPES = ["plank", "pillar", "beam", "brace"] as const;
const KNOWN_VEHICLES = ["car", "truck", "train"] as const;
const PIECE_LABELS: Record<string, MessageKey> = {
  plank: "lab.piece.plank",
  pillar: "lab.piece.pillar",
  beam: "lab.piece.beam",
  brace: "lab.piece.brace",
};
const VEHICLE_LABELS: Record<string, MessageKey> = {
  car: "lab.vehicle.car",
  truck: "lab.vehicle.truck",
  train: "lab.vehicle.train",
};
const MATERIAL_LABELS: Record<string, MessageKey> = {
  wood: "lab.material.wood",
  steel: "lab.material.steel",
};
const ERROR_LABELS: Record<string, MessageKey> = {
  no_anchor: "lab.error.no_anchor",
  max_pieces_reached: "lab.error.max_pieces",
  build_disabled: "lab.error.build_disabled",
  overlapping_piece: "lab.error.overlapping_piece",
  too_short: "lab.error.too_short",
  piece_not_allowed: "lab.error.piece_not_allowed",
  material_not_allowed: "lab.error.material_not_allowed",
  run_in_progress: "lab.error.run_in_progress",
  physics_unstable: "lab.error.physics_unstable",
  not_loaded: "lab.error.not_loaded",
};

interface GridPoint {
  readonly x: number;
  readonly y: number;
}

/** Mirror of webRuntime.render() projection so the DOM crosshair and pointer
 * mapping agree with what the canvas draws (viewW = gap + 8, viewH = 7). */
function viewMetrics(canvas: HTMLCanvasElement, gap: number): {
  cssW: number;
  cssH: number;
  viewW: number;
  scale: number;
  offsetX: number;
  offsetY: number;
} {
  const dpr =
    Math.min(
      2,
      typeof window !== "undefined" && typeof window.devicePixelRatio === "number"
        ? window.devicePixelRatio
        : 1,
    ) || 1;
  const cssW = canvas.width / dpr;
  const cssH = canvas.height / dpr;
  const viewW = gap + 8;
  const viewH = 7;
  const scale = Math.min(cssW / viewW, cssH / viewH);
  return {
    cssW,
    cssH,
    viewW,
    scale,
    offsetX: (cssW - viewW * scale) / 2,
    offsetY: (cssH - viewH * scale) / 2,
  };
}

export function gridToPercent(
  canvas: HTMLCanvasElement,
  gap: number,
  point: GridPoint,
): { left: string; top: string } {
  const m = viewMetrics(canvas, gap);
  const left = ((m.offsetX + (point.x + 4) * m.scale) / m.cssW) * 100;
  const top = ((m.offsetY + (point.y + 1) * m.scale) / m.cssH) * 100;
  return { left: `${left}%`, top: `${top}%` };
}

function clientToGrid(
  canvas: HTMLCanvasElement,
  gap: number,
  clientX: number,
  clientY: number,
): GridPoint {
  const rect = canvas.getBoundingClientRect();
  const m = viewMetrics(canvas, gap);
  const fx = rect.width > 0 ? (clientX - rect.left) / rect.width : 0;
  const fy = rect.height > 0 ? (clientY - rect.top) / rect.height : 0;
  return {
    x: Math.round(((fx * m.cssW - m.offsetX) / m.scale - 4) * 2) / 2,
    y: Math.round(((fy * m.cssH - m.offsetY) / m.scale - 1) * 2) / 2,
  };
}

function clampCursor(point: GridPoint, gap: number): GridPoint {
  const snap = (v: number, min: number, max: number): number =>
    Math.min(max, Math.max(min, Math.round(v * 2) / 2));
  return { x: snap(point.x, -3, gap + 3), y: snap(point.y, -1, 4.5) };
}

/** Resume guard: only well-formed saved pieces re-enter the runtime. */
function isPieceType(value: string): value is PieceType {
  return (KNOWN_PIECE_TYPES as readonly string[]).includes(value);
}

function isMaterialId(value: string): value is MaterialId {
  return value === "wood" || value === "steel";
}

function toDesignPieces(pieces: readonly SavedLabPiece[]): DesignPiece[] {
  const out: DesignPiece[] = [];
  for (const p of pieces) {
    if (!isPieceType(p.pieceType) || !isMaterialId(p.material)) continue;
    out.push({
      id: p.id,
      pieceType: p.pieceType,
      material: p.material,
      x1: p.x1,
      y1: p.y1,
      x2: p.x2,
      y2: p.y2,
    });
  }
  return out;
}

export default function BridgeLab(props: LabProps) {
  const { profile } = useApp();
  const t = useT();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const runtimeRef = useRef<ExperienceRuntime | null>(null);
  const [phase, setPhase] = useState<Phase>("loading");
  const [loadFailed, setLoadFailed] = useState(false);
  const [info, setInfo] = useState<{
    pieces: number;
    cost: number;
    budget: number;
    maxPieces: number;
    vehicleId: string;
    buildEnabled: boolean;
  } | null>(null);
  const [vehicle, setVehicle] = useState<string>(
    props.spec.constraints.vehicles?.[0] ?? "car",
  );
  const [pieceType, setPieceType] = useState<string>(
    props.spec.constraints.piece_types?.[0] ?? "plank",
  );
  const [material, setMaterial] = useState<string>("wood");
  const [pendingFirst, setPendingFirst] = useState<GridPoint | null>(null);
  const [cursor, setCursor] = useState<GridPoint>({ x: 0, y: 0 });
  const [cursorOn, setCursorOn] = useState(false);
  const [forceView, setForceView] = useState(props.spec.ui.force_view);
  const [errorKey, setErrorKey] = useState<MessageKey | null>(null);
  const [result, setResult] = useState<LabRunResult | null>(null);
  const [log, setLog] = useState<
    readonly { n: number; vehicle: string; success: boolean; cost: number }[]
  >([]);
  const [announcement, setAnnouncement] = useState("");
  const onRunFinishedRef = useRef(props.onRunFinished);
  onRunFinishedRef.current = props.onRunFinished;
  const onDesignChangeRef = useRef(props.onDesignChange);
  onDesignChangeRef.current = props.onDesignChange;

  const gap = props.spec.constraints.gap_width ?? 3;
  const allowedPieces = props.spec.constraints.piece_types ?? [...KNOWN_PIECE_TYPES];
  // Provisional UI policy (P1-20 owns steel): the tray offers the materials
  // the spec lists; without a materials map the lane is wood-only
  // (EXPERIENCE_RUNTIME.md §5) and no cost is shown. The domain still
  // enforces whatever the spec allows.
  const offeredMaterials =
    props.spec.constraints.materials !== undefined
      ? Object.keys(props.spec.constraints.materials)
      : ["wood"];
  const allowedVehicles = props.spec.constraints.vehicles ?? [...KNOWN_VEHICLES];
  const showBudget = props.spec.constraints.materials !== undefined;
  const showForceToggle = props.spec.ui.force_view;
  const showTestLog = props.spec.ui.test_log;

  useEffect(() => {
    let live = true;
    let runtime: ExperienceRuntime | null = null;
    setPhase("loading");
    setLoadFailed(false);

    async function init(): Promise<void> {
      try {
        runtime =
          props.runtimeFactory !== undefined
            ? await props.runtimeFactory()
            : await createWebRuntime();
        if (!live) {
          runtime.dispose();
          return;
        }
        runtimeRef.current = runtime;
        const unsub = runtime.onEvent((event: RuntimeEvent) => {
          if (live) handleEvent(event);
        });
        await runtime.load(props.spec, {
          mode: props.mode ?? "interactive",
          locale: profile.language,
          stage: profile.stage === "parent" ? "explorer" : profile.stage,
          stepId: props.stepId,
          reducedMotion:
            typeof window !== "undefined" &&
            typeof window.matchMedia === "function" &&
            window.matchMedia("(prefers-reduced-motion: reduce)").matches,
          t: (key: string) => key,
        });
        if (!live) {
          unsub();
          runtime.dispose();
          return;
        }
        runtime.mount(canvasRef.current);
        const saved = props.initialDesign;
        if (
          saved &&
          saved.specId === props.spec.experience_id &&
          saved.specVersion === props.spec.version
        ) {
          runtime.restore({
            specId: saved.specId,
            specVersion: saved.specVersion,
            design: toDesignPieces(saved.design),
            runStep: 0,
            vehicleId: saved.vehicleId,
            ui: { forceView: saved.forceView, tool: saved.tool },
          });
          setForceView(saved.forceView);
        }
        refreshInfo();
        setPhase("build");
        return;
      } catch {
        if (live) setLoadFailed(true);
      }
    }

    function handleEvent(event: RuntimeEvent): void {
      const rt = runtimeRef.current;
      if (!rt) return;
      switch (event.type) {
        case "piece_placed":
        case "piece_removed": {
          const hud = asHud(rt).getDesignInfo();
          setInfo(hud);
          setPhase("build");
          setResult(null);
          setErrorKey(null);
          setAnnouncement(t("lab.announce.placed", { count: hud.pieces }));
          persistDesign();
          break;
        }
        case "run_started":
          setPhase("running");
          setErrorKey(null);
          break;
        case "run_finished": {
          const payload = event.payload;
          const finished: LabRunResult = {
            success: payload["success"] === true,
            reasons: typeof payload["reasons"] === "string" ? payload["reasons"] : "",
            vehicle:
              typeof payload["vehicle"] === "string" ? payload["vehicle"] : vehicle,
            cost: typeof payload["cost"] === "number" ? payload["cost"] : 0,
            peakLoadRatio:
              typeof payload["peakLoadRatio"] === "number" ? payload["peakLoadRatio"] : 0,
            crossed: payload["crossed"] === true,
            heldSeconds:
              typeof payload["heldForSeconds"] === "number" ? payload["heldForSeconds"] : 0,
            unstable: payload["unstable"] === true,
          };
          setResult(finished);
          setPhase("done");
          setLog((prev) => [
            ...prev,
            {
              n: prev.length + 1,
              vehicle: finished.vehicle,
              success: finished.success,
              cost: finished.cost,
            },
          ]);
          setAnnouncement(
            t(finished.success ? "lab.announce.success" : "lab.announce.fail"),
          );
          onRunFinishedRef.current?.(finished);
          break;
        }
        case "force_view_toggled":
          setForceView(event.payload["on"] === true);
          persistDesign();
          break;
        case "design_changed_after_run":
          setResult(null);
          break;
        case "error": {
          const code = typeof event.payload["code"] === "string" ? event.payload["code"] : "";
          setErrorKey(ERROR_LABELS[code] ?? "lab.fail.generic");
          break;
        }
        default:
          break;
      }
    }

    function refreshInfo(): void {
      if (runtimeRef.current) setInfo(asHud(runtimeRef.current).getDesignInfo());
    }

    function persistDesign(): void {
      const rt = runtimeRef.current;
      const save = onDesignChangeRef.current;
      if (!rt || !save) return;
      try {
        const hud = asHud(rt).getDesignInfo();
        const snapshot = rt.getSnapshot();
        save({
          specId: snapshot.specId,
          specVersion: snapshot.specVersion,
          design: snapshot.design.map((p) => ({ ...p })),
          vehicleId: hud.vehicleId,
          forceView: forceViewRef.current,
          tool: snapshot.ui.tool,
        });
      } catch {
        // Best effort: a failed save must never break the lab session.
      }
    }

    void init();
    return () => {
      live = false;
      runtimeRef.current = null;
      runtime?.dispose();
    };
    // Re-create only when the step or spec changes; selection state lives above.
    // exhaustive-deps: init/props.* intentionally omitted (props object identity
    // changes every render and must not restart the runtime).
  }, [props.spec.experience_id, props.stepId, props.mode]);

  const forceViewRef = useRef(forceView);
  forceViewRef.current = forceView;

  if (loadFailed) {
    return (
      <section className="cv-lab-error" data-testid="lab-load-error">
        <p className="cv-page-empty">{t("runner.loadError.body")}</p>
        <div className="cv-page-actions">
          <Button label={t("runner.retry")} onClick={() => setLoadFailed(false)} />
        </div>
      </section>
    );
  }

  const piecesLeft = info ? Math.max(0, info.maxPieces - info.pieces) : 0;

  function placeAt(point: GridPoint): void {
    const rt = runtimeRef.current;
    if (!rt || phase === "running") return;
    if (!pendingFirst) {
      setPendingFirst(point);
      setAnnouncement(t("lab.place.second"));
      return;
    }
    const first = pendingFirst;
    setPendingFirst(null);
    rt.dispatch({
      kind: "place_piece",
      pieceType: (KNOWN_PIECE_TYPES as readonly string[]).includes(pieceType)
        ? (pieceType as (typeof KNOWN_PIECE_TYPES)[number])
        : "plank",
      material: material === "steel" ? "steel" : "wood",
      x1: first.x,
      y1: first.y,
      x2: point.x,
      y2: point.y,
    });
  }

  function onCanvasClick(clientX: number, clientY: number): void {
    const canvas = canvasRef.current;
    if (!canvas) return;
    placeAt(clientToGrid(canvas, gap, clientX, clientY));
  }

  function onKeyDown(key: string): void {
    const step = 0.5;
    if (key === "ArrowLeft") setCursor((c) => clampCursor({ x: c.x - step, y: c.y }, gap));
    else if (key === "ArrowRight") setCursor((c) => clampCursor({ x: c.x + step, y: c.y }, gap));
    else if (key === "ArrowUp") setCursor((c) => clampCursor({ x: c.x, y: c.y - step }, gap));
    else if (key === "ArrowDown") setCursor((c) => clampCursor({ x: c.x, y: c.y + step }, gap));
    else if (key === "Enter") placeAt(cursor);
    else if (key === "Escape") {
      setPendingFirst(null);
      setCursorOn(false);
    }
  }

  function changeVehicle(next: string): void {
    setVehicle(next);
    runtimeRef.current?.dispatch({ kind: "set_vehicle", vehicleId: next });
    const rt = runtimeRef.current;
    if (rt) {
      setInfo(asHud(rt).getDesignInfo());
      persistSoon();
    }
  }

  function persistSoon(): void {
    // Vehicle changes emit no runtime event; persist on the next tick so the
    // domain has applied the dispatch first.
    window.setTimeout(() => {
      const rt = runtimeRef.current;
      const save = onDesignChangeRef.current;
      if (!rt || !save) return;
      try {
        const hud = asHud(rt).getDesignInfo();
        const snapshot = rt.getSnapshot();
        save({
          specId: snapshot.specId,
          specVersion: snapshot.specVersion,
          design: snapshot.design.map((p) => ({ ...p })),
          vehicleId: hud.vehicleId,
          forceView: forceViewRef.current,
          tool: snapshot.ui.tool,
        });
      } catch {
        // Best effort (see persistDesign).
      }
    }, 0);
  }

  function failMessage(): string | null {
    if (!result || result.success) return null;
    if (result.unstable) return t("lab.fail.unstable");
    const failed = result.reasons.split(",").map((s) => s.trim());
    if (failed.some((id) => id === "cost<=budget")) return t("lab.fail.budget");
    if (failed.some((id) => id === "pieces<=max")) return t("lab.fail.pieces");
    if (failed.some((id) => id === "vehicle_crosses" || id === "car_crosses"))
      return t("lab.fail.cross");
    if (failed.some((id) => id.startsWith("bridge_holds_"))) return t("lab.fail.hold");
    return t("lab.fail.generic");
  }

  const crosshair =
    cursorOn && canvasRef.current
      ? gridToPercent(canvasRef.current, gap, cursor)
      : null;

  return (
    <section className="cv-lab" aria-label={props.messages[props.spec.mission.title_key] ?? t("lab.go")}>
      <p className="cv-page-lead" data-testid="lab-objective">
        {props.messages[props.spec.mission.objective_key] ?? props.spec.mission.objective_key}
      </p>

      <div
        className="cv-lab-canvas-wrap"
        data-testid="lab-canvas-wrap"
        tabIndex={0}
        role="group"
        aria-label={t("lab.canvas.label")}
        onKeyDown={(e) => {
          if (
            e.key === "ArrowLeft" ||
            e.key === "ArrowRight" ||
            e.key === "ArrowUp" ||
            e.key === "ArrowDown" ||
            e.key === "Enter" ||
            e.key === "Escape"
          ) {
            e.preventDefault();
            onKeyDown(e.key);
          }
        }}
        onFocus={() => setCursorOn(true)}
        onBlur={() => setCursorOn(false)}
      >
        <canvas
          ref={canvasRef}
          className="cv-lab-canvas"
          data-testid="lab-canvas"
          width={640}
          height={448}
          onClick={(e) => onCanvasClick(e.clientX, e.clientY)}
        />
        {crosshair ? (
          <span
            className="cv-lab-crosshair"
            data-testid="lab-crosshair"
            style={{ left: crosshair.left, top: crosshair.top }}
            aria-hidden="true"
          />
        ) : null}
        {pendingFirst && canvasRef.current ? (
          <span
            className="cv-lab-crosshair cv-lab-crosshair--pending"
            data-testid="lab-pending"
            style={{
              ...gridToPercent(canvasRef.current, gap, pendingFirst),
            }}
            aria-hidden="true"
          />
        ) : null}
      </div>
      <p className="cv-page-empty-small">
        {pendingFirst ? t("lab.place.second") : t("lab.place.first")} {t("lab.keyboard")}
      </p>

      {info && info.buildEnabled ? (
        <div className="cv-lab-tray" role="group" aria-label={t("lab.tray")}>
          {allowedPieces.map((type) => (
            <button
              key={type}
              type="button"
              data-testid={`lab-tray-${type}`}
              className={`cv-chip${pieceType === type ? " cv-chip--selected" : ""}`}
              aria-pressed={pieceType === type}
              onClick={() => setPieceType(type)}
            >
              {t(PIECE_LABELS[type] ?? "lab.tray")}
              {PIECE_LABELS[type] === undefined ? ` (${type})` : null}
            </button>
          ))}
          {offeredMaterials.length > 1 ? (
            <span className="cv-lab-materials" role="group" aria-label={t("lab.material")}>
              {offeredMaterials.map((name) => (
                <button
                  key={name}
                  type="button"
                  data-testid={`lab-material-${name}`}
                  className={`cv-chip${material === name ? " cv-chip--selected" : ""}`}
                  aria-pressed={material === name}
                  onClick={() => setMaterial(name)}
                >
                  {t(MATERIAL_LABELS[name] ?? "lab.material")}
                  {MATERIAL_LABELS[name] === undefined ? ` (${name})` : null}
                </button>
              ))}
            </span>
          ) : null}
        </div>
      ) : null}

      <div className="cv-lab-vehicles" role="group" aria-label={t("lab.vehicle")}>
        {allowedVehicles.map((id) => (
          <button
            key={id}
            type="button"
            data-testid={`lab-vehicle-${id}`}
            className={`cv-chip${vehicle === id ? " cv-chip--selected" : ""}`}
            aria-pressed={vehicle === id}
            onClick={() => changeVehicle(id)}
          >
            {t(VEHICLE_LABELS[id] ?? "lab.vehicle")}
            {VEHICLE_LABELS[id] === undefined ? ` (${id})` : null}
          </button>
        ))}
      </div>

      <div className="cv-page-actions">
        <button
          type="button"
          data-testid="lab-go"
          className="cv-button"
          disabled={phase === "loading" || phase === "running"}
          onClick={() => runtimeRef.current?.start()}
        >
          <Icon name="play" />
          {t(phase === "running" ? "lab.testing" : "lab.go")}
        </button>
        <button
          type="button"
          data-testid="lab-reset"
          className="cv-button cv-button--secondary"
          disabled={phase === "loading" || phase === "running"}
          onClick={() => {
            runtimeRef.current?.reset();
            setResult(null);
            setPhase("build");
          }}
        >
          {t("lab.reset")}
        </button>
      </div>

      <div className="cv-page-actions">
        <button
          type="button"
          data-testid="lab-undo"
          className="cv-button cv-button--secondary"
          disabled={phase === "loading"}
          aria-label={t("lab.undo")}
          onClick={() => runtimeRef.current?.dispatch({ kind: "undo" })}
        >
          <Icon name="undo" />
          {t("lab.undo")}
        </button>
        <button
          type="button"
          data-testid="lab-redo"
          className="cv-button cv-button--secondary"
          disabled={phase === "loading"}
          aria-label={t("lab.redo")}
          onClick={() => runtimeRef.current?.dispatch({ kind: "redo" })}
        >
          <Icon name="redo" />
          {t("lab.redo")}
        </button>
        <button
          type="button"
          data-testid="lab-clear"
          className="cv-button cv-button--secondary"
          disabled={phase === "loading"}
          onClick={() => runtimeRef.current?.dispatch({ kind: "clear" })}
        >
          {t("lab.clear")}
        </button>
        {showForceToggle ? (
          <button
            type="button"
            data-testid="lab-force"
            className={`cv-button cv-button--secondary${forceView ? " cv-button--active" : ""}`}
            aria-pressed={forceView}
            disabled={phase === "loading"}
            onClick={() => runtimeRef.current?.dispatch({ kind: "toggle_force_view" })}
          >
            {t("lab.force")}
          </button>
        ) : null}
      </div>

      <p className="cv-page-empty" data-testid="lab-pieces">
        {t("lab.piecesLeft", { count: piecesLeft })}
        {showBudget && info ? ` · ${t("lab.cost", { cost: info.cost, budget: info.budget })}` : null}
      </p>

      {showForceToggle && forceView ? (
        <p className="cv-page-empty" data-testid="lab-force-legend">
          {t("lab.force.legend")}
        </p>
      ) : null}

      {errorKey ? (
        <p className="cv-lab-error-text" role="alert" data-testid="lab-error">
          {t(errorKey)}
        </p>
      ) : null}

      {result && result.success ? (
        <section className="cv-lab-result cv-lab-result--success" data-testid="lab-result-success">
          <h3>
            <Icon name="check" /> {t("lab.success.title")}
          </h3>
          <p>{t("lab.success.body")}</p>
        </section>
      ) : null}
      {result && !result.success ? (
        <section className="cv-lab-result cv-lab-result--fail" data-testid="lab-result-fail">
          <h3>
            <Icon name="warning" /> {t("lab.fail.title")}
          </h3>
          <p>{failMessage()}</p>
        </section>
      ) : null}

      {showTestLog ? (
        <section className="cv-lab-log" aria-label={t("lab.testlog")}>
          <h3>{t("lab.testlog")}</h3>
          {log.length === 0 ? (
            <p className="cv-page-empty">{t("lab.testlog.empty")}</p>
          ) : (
            <ol>
              {log.map((entry) => (
                <li key={entry.n} data-testid={`lab-log-${entry.n}`}>
                  {t("lab.tries", { count: entry.n })}
                  {": "}
                  {entry.success ? t("lab.success.title") : t("lab.fail.title")}
                </li>
              ))}
            </ol>
          )}
        </section>
      ) : null}

      <p role="status" aria-live="polite" className="cv-sr-only" data-testid="lab-live">
        {announcement}
      </p>
    </section>
  );
}
