import type { ExperienceSpec, Locale, Stage } from "@createverse/shared-types";

/**
 * Experience runtime interface and event types.
 * Spec: EXPERIENCE_RUNTIME.md §2 (interface), §5 (bridge domain), §6 (conditions),
 * §7 (telemetry events), §8 (determinism and snapshots).
 * The runtime knows nothing about accounts, hints, curriculum, AI or the database.
 */

export type RuntimeMode = "interactive" | "headless";

export interface RuntimeContext {
  readonly mode: RuntimeMode;
  readonly locale: Locale;
  readonly stage: Stage;
  /** Selects step_overrides (EXPERIENCE_RUNTIME.md §4). */
  readonly stepId: string;
  readonly reducedMotion: boolean;
  /** Localization for any in-canvas labels. */
  readonly t: (key: string) => string;
  /** Injected clock; simulation itself never reads wall-clock time. */
  readonly now?: () => number;
}

export type PieceType = "plank" | "pillar" | "beam" | "brace";
export type MaterialId = "wood" | "steel";

export type RuntimeCommand =
  | {
      readonly kind: "place_piece";
      readonly pieceType: PieceType;
      readonly material: MaterialId;
      /** Endpoints in grid units (1 unit = 1 grid cell). */
      readonly x1: number;
      readonly y1: number;
      readonly x2: number;
      readonly y2: number;
    }
  | { readonly kind: "remove_piece"; readonly pieceId: string }
  | { readonly kind: "undo" }
  | { readonly kind: "redo" }
  | { readonly kind: "clear" }
  | { readonly kind: "set_vehicle"; readonly vehicleId: string }
  | { readonly kind: "set_tool"; readonly tool: string }
  | { readonly kind: "toggle_force_view" };

/** Serializable design piece (no engine state). */
export interface DesignPiece {
  readonly id: string;
  readonly pieceType: PieceType;
  readonly material: MaterialId;
  readonly x1: number;
  readonly y1: number;
  readonly x2: number;
  readonly y2: number;
}

export interface ForceViewEntry {
  readonly pieceId: string;
  /** Load ratio: measured strain divided by capacity. 0 = unloaded. */
  readonly ratio: number;
  readonly mode: "compression" | "tension" | null;
}

export type RuntimeEventType =
  | "ready"
  | "piece_placed"
  | "piece_removed"
  | "run_started"
  | "run_finished"
  | "design_changed_after_run"
  | "test_log_entry"
  | "force_view_toggled"
  | "bonus_vehicle_crossed"
  | "error";

/** Telemetry contains design and result numbers only — never personal data (§7). */
export interface RuntimeEvent {
  readonly type: RuntimeEventType;
  readonly payload: Readonly<Record<string, string | number | boolean>>;
}

export interface ExperienceSnapshot {
  readonly specId: string;
  readonly specVersion: number;
  readonly design: readonly DesignPiece[];
  /** Simulation steps completed in the current run; 0 = build mode. */
  readonly runStep: number;
  readonly vehicleId: string;
  readonly ui: { readonly forceView: boolean; readonly tool: string };
}

export interface ConditionResult {
  readonly id: string;
  readonly passed: boolean;
  readonly detail?: string;
}

export interface AssessmentResult {
  readonly passed: boolean;
  readonly conditions: readonly ConditionResult[];
}

export interface RunOutcome {
  readonly vehicleId: string;
  readonly crossed: boolean;
  readonly crossedAtStep: number | null;
  readonly heldForSeconds: number;
  readonly vehicleFell: boolean;
  /** Solver instability detected mid-run (§12) — such a run can never pass. */
  readonly unstable: boolean;
  readonly peakLoadRatio: number;
  readonly brokenPieceIds: readonly string[];
  readonly fallenPieceIds: readonly string[];
  readonly totalCost: number;
  readonly steps: number;
}

export type Unsubscribe = () => void;

/** Lightweight draw state handed to the canvas renderer (no engine internals). */
export interface RenderPiece {
  readonly id: string;
  /** Center in grid units. */
  readonly x: number;
  readonly y: number;
  readonly angle: number;
  readonly length: number;
  readonly thickness: number;
  readonly material: MaterialId;
  readonly broken: boolean;
  readonly ratio: number;
  readonly mode: "compression" | "tension" | null;
}

export interface RenderState {
  /** Static bodies as center + size, grid units. */
  readonly banks: readonly { x: number; y: number; w: number; h: number }[];
  readonly waterY: number;
  readonly pieces: readonly RenderPiece[];
  readonly vehicle: { x: number; y: number; width: number; height: number } | null;
}

export interface ExperienceRuntime {
  load(spec: ExperienceSpec, ctx: RuntimeContext): Promise<void>;
  /** `null` in headless mode (EXPERIENCE_RUNTIME.md §2). */
  mount(canvas: HTMLCanvasElement | null): void;
  start(): void;
  reset(): void;
  pause(): void;
  resume(): void;
  dispatch(cmd: RuntimeCommand): void;
  getSnapshot(): ExperienceSnapshot;
  restore(snapshot: ExperienceSnapshot): void;
  evaluate(): AssessmentResult;
  onEvent(cb: (e: RuntimeEvent) => void): Unsubscribe;
  dispose(): void;
}
