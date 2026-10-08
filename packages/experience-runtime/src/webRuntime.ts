import { ExperienceSpecSchema, type ExperienceSpec } from "@createverse/shared-types";
import { BridgeDomain } from "./bridgeDomain.ts";
import { parseConditions, type ParsedCondition } from "./conditions.ts";
import type {
  AssessmentResult,
  ConditionResult,
  DesignPiece,
  ExperienceRuntime,
  ExperienceSnapshot,
  ForceViewEntry,
  RenderState,
  RuntimeCommand,
  RuntimeContext,
  RuntimeEvent,
  Unsubscribe,
} from "./types.ts";
/**
 * WebExperienceRuntime — the only runtime implementation (ADR-0006).
 * Canvas 2D + Matter.js. Headless mode runs the identical simulation code
 * synchronously for deterministic CI tests (EXPERIENCE_RUNTIME.md §8).
 *
 * The runtime knows nothing about accounts, hints, curriculum, AI or the DB.
 * HUD, localization and telemetry mapping belong to the app (§7).
 */

function designHash(design: readonly DesignPiece[]): string {
  const json = JSON.stringify(design);
  let hash = 0x811c9dc5;
  for (let i = 0; i < json.length; i += 1) {
    hash ^= json.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

export class WebExperienceRuntime implements ExperienceRuntime {
  private spec: ExperienceSpec | null = null;
  private ctx: RuntimeContext | null = null;
  private domain: BridgeDomain | null = null;
  private conditions: ParsedCondition[] = [];
  private readonly listeners = new Set<(e: RuntimeEvent) => void>();
  private canvas: HTMLCanvasElement | null = null;
  private rafHandle: number | null = null;
  private disposed = false;
  private paused = false;
  private forceView = false;
  private tool = "select";
  private runStarted = false;
  private runFinalized = false;
  private lastOutcome: ReturnType<BridgeDomain["getOutcome"]> | null = null;

  private emit(type: RuntimeEvent["type"], payload: RuntimeEvent["payload"]): void {
    const event: RuntimeEvent = { type, payload };
    for (const listener of this.listeners) listener(event);
  }

  private emitError(code: string): void {
    this.emit("error", { code });
  }

  async load(rawSpec: unknown, ctx: RuntimeContext): Promise<void> {
    if (this.disposed) throw new Error("runtime disposed");
    const parsed = ExperienceSpecSchema.safeParse(rawSpec);
    if (!parsed.success) {
      const message = parsed.error.issues
        .map((i) => `${i.path.join(".")}: ${i.message}`)
        .join("; ");
      throw new Error(`invalid experience spec: ${message}`);
    }
    const spec = parsed.data;
    const conditions = parseConditions(spec.assessment.success_conditions);
    // BridgeDomain applies step overrides and rejects invalid ones (§4).
    const domain = new BridgeDomain(spec, ctx.stepId);

    this.spec = spec;
    this.ctx = ctx;
    this.conditions = conditions;
    this.domain = domain;
    this.forceView = spec.ui.force_view;
    this.runStarted = false;
    this.runFinalized = false;
    this.lastOutcome = null;
    this.emit("ready", { specId: spec.experience_id, version: spec.version });
  }

  mount(canvas: HTMLCanvasElement | null): void {
    this.canvas = canvas;
    this.render();
  }

  private requireDomain(): BridgeDomain | null {
    if (this.disposed || !this.domain) {
      this.emitError("not_loaded");
      return null;
    }
    return this.domain;
  }

  private maxHoldSeconds(): number {
    let max = 0;
    for (const condition of this.conditions) {
      if (condition.kind === "holds" && condition.seconds > max) max = condition.seconds;
    }
    return max;
  }

  private ensureRunStarted(): BridgeDomain | null {
    const domain = this.requireDomain();
    if (!domain) return null;
    if (domain.isFinished()) {
      domain.resetRun();
      this.runStarted = false;
      this.runFinalized = false;
      this.lastOutcome = null;
    }
    if (!this.runStarted) {
      const begun = domain.beginRun(this.maxHoldSeconds());
      if (!begun.ok) {
        this.emitError(begun.code);
        return null;
      }
      this.runStarted = true;
      this.emit("run_started", {
        designHash: designHash(domain.getDesign()),
        vehicle: domain.getVehicleId(),
      });
    }
    return domain;
  }

  /** Headless spike helper: advance a fixed number of simulation steps (§8). */
  advance(steps: number): void {
    const domain = this.ensureRunStarted();
    if (!domain) return;
    const target = domain.currentRunStep() + steps;
    while (!domain.isFinished() && domain.currentRunStep() < target) domain.stepOnce();
    this.finalizeIfNeeded(domain);
    this.render();
  }

  start(): void {
    const domain = this.ensureRunStarted();
    if (!domain) return;
    if (this.ctx?.mode === "interactive") {
      this.startLoop();
      return;
    }
    // Headless: run synchronously to completion (deterministic, bounded).
    while (!domain.isFinished()) domain.stepOnce();
    this.finalizeIfNeeded(domain);
    this.render();
  }

  private startLoop(): void {
    if (this.rafHandle !== null || this.paused) return;
    const tick = (): void => {
      const domain = this.domain;
      if (!domain || this.disposed || this.paused) return;
      if (!domain.isFinished()) {
        domain.stepOnce();
        domain.stepOnce(); // simple fixed-step catch-up for the spike
        this.finalizeIfNeeded(domain);
        this.render();
      }
      if (!domain.isFinished()) {
        this.rafHandle = requestAnimationFrame(tick);
      } else {
        this.rafHandle = null;
      }
    };
    this.rafHandle = requestAnimationFrame(tick);
  }

  private finalizeIfNeeded(domain: BridgeDomain): void {
    if (!domain.isFinished() || this.runFinalized) return;
    const outcome = domain.getOutcome();
    const results = this.evaluateConditions(outcome, domain);
    const failed = results.filter((c) => !c.passed).map((c) => c.id);
    this.runFinalized = true;
    this.lastOutcome = outcome;
    const unstable = outcome.unstable;
    this.emit("run_finished", {
      success: failed.length === 0,
      reasons: failed.join(","),
      vehicle: outcome.vehicleId,
      crossed: outcome.crossed,
      vehicleFell: outcome.vehicleFell,
      heldForSeconds: Math.round(outcome.heldForSeconds * 100) / 100,
      cost: outcome.totalCost,
      peakLoadRatio: Math.round(outcome.peakLoadRatio * 1000) / 1000,
      broken: outcome.brokenPieceIds.length,
      fallen: outcome.fallenPieceIds.length,
      steps: outcome.steps,
      unstable,
    });
    if (unstable) {
      // §12: instability resets the run and is reported as an error, never a pass.
      this.emitError("physics_unstable");
      return;
    }
    if (
      domain.bonusVehicle &&
      outcome.vehicleId === domain.bonusVehicle &&
      outcome.crossed
    ) {
      this.emit("bonus_vehicle_crossed", { vehicle: outcome.vehicleId });
    }
  }

  pause(): void {
    this.paused = true;
    if (this.rafHandle !== null) {
      cancelAnimationFrame(this.rafHandle);
      this.rafHandle = null;
    }
  }

  resume(): void {
    if (!this.paused) return;
    this.paused = false;
    if (this.ctx?.mode === "interactive" && this.domain && !this.domain.isFinished()) {
      this.startLoop();
    }
  }

  reset(): void {
    const domain = this.requireDomain();
    if (!domain) return;
    domain.resetRun();
    this.runStarted = false;
    this.runFinalized = false;
    this.lastOutcome = null;
    this.render();
  }

  dispatch(cmd: RuntimeCommand): void {
    const domain = this.requireDomain();
    if (!domain) return;
    switch (cmd.kind) {
      case "place_piece": {
        const result = domain.placePiece(cmd);
        if (!result.ok) {
          this.emitError(result.code);
          return;
        }
        this.emit("piece_placed", {
          pieceId: result.piece.id,
          type: result.piece.pieceType,
          material: result.piece.material,
        });
        this.afterDesignChange();
        this.render();
        return;
      }
      case "remove_piece": {
        const result = domain.removePiece(cmd.pieceId);
        if (!result.ok) {
          this.emitError(result.code);
          return;
        }
        this.emit("piece_removed", {
          pieceId: result.piece.id,
          type: result.piece.pieceType,
          material: result.piece.material,
        });
        this.afterDesignChange();
        this.render();
        return;
      }
      case "undo":
        this.applyHistoryChange(domain.undo());
        return;
      case "redo":
        this.applyHistoryChange(domain.redo());
        return;
      case "clear":
        this.applyHistoryChange(domain.clear());
        return;
      case "set_vehicle": {
        const result = domain.setVehicle(cmd.vehicleId);
        if (!result.ok) this.emitError(result.code);
        return;
      }
      case "set_tool":
        this.tool = cmd.tool;
        return;
      case "toggle_force_view":
        this.forceView = !this.forceView;
        this.emit("force_view_toggled", { on: this.forceView });
        this.render();
        return;
    }
  }

  private applyHistoryChange(change: ReturnType<BridgeDomain["undo"]>): void {
    if (change.added.length === 0 && change.removed.length === 0) return;
    for (const piece of change.removed) {
      this.emit("piece_removed", {
        pieceId: piece.id,
        type: piece.pieceType,
        material: piece.material,
      });
    }
    for (const piece of change.added) {
      this.emit("piece_placed", {
        pieceId: piece.id,
        type: piece.pieceType,
        material: piece.material,
      });
    }
    this.afterDesignChange();
    this.render();
  }

  /** A finished or partial run no longer matches a changed design (§7). */
  private afterDesignChange(): void {
    if (!this.runStarted && !this.runFinalized) return;
    this.domain?.resetRun();
    this.runStarted = false;
    this.runFinalized = false;
    this.lastOutcome = null;
    this.emit("design_changed_after_run", {
      pieces: this.domain?.getPieceCount() ?? 0,
    });
  }

  getSnapshot(): ExperienceSnapshot {
    const domain = this.domain;
    if (!domain || !this.spec) throw new Error("runtime not loaded");
    return {
      specId: this.spec.experience_id,
      specVersion: this.spec.version,
      design: domain.getDesign(),
      runStep: domain.currentRunStep(),
      vehicleId: domain.getVehicleId(),
      ui: { forceView: this.forceView, tool: this.tool },
    };
  }

  restore(snapshot: ExperienceSnapshot): void {
    const domain = this.requireDomain();
    if (!domain) return;
    domain.resetRun();
    // A mid-run snapshot is stored as the design plus the simulation step count;
    // restoring replays the run deterministically to that step (EXPERIENCE_RUNTIME §8).
    domain.restoreDesign(snapshot.design);
    const vehicle = domain.setVehicle(snapshot.vehicleId);
    if (!vehicle.ok) this.emitError(vehicle.code);
    this.forceView = snapshot.ui.forceView;
    this.tool = snapshot.ui.tool;
    this.runStarted = false;
    this.runFinalized = false;
    this.lastOutcome = null;
    if (snapshot.runStep > 0) {
      this.advance(snapshot.runStep);
    }
    this.render();
  }

  evaluate(): AssessmentResult {
    const domain = this.domain;
    if (!domain) return { passed: false, conditions: [] };
    if (this.lastOutcome) {
      const conditions = this.evaluateConditions(this.lastOutcome, domain);
      return { passed: conditions.every((c) => c.passed), conditions };
    }
    // No run yet: design-only conditions can still be checked (§6).
    const conditions: ConditionResult[] = this.conditions.map((condition) => {
      if (condition.kind === "cost_within_budget") {
        return {
          id: condition.id,
          passed: domain.getCost() <= domain.budget,
          detail: `cost ${domain.getCost()} of budget ${domain.budget}`,
        };
      }
      if (condition.kind === "pieces_within_max") {
        return {
          id: condition.id,
          passed: domain.getPieceCount() <= domain.maxPieces,
          detail: `pieces ${domain.getPieceCount()} of max ${domain.maxPieces}`,
        };
      }
      return { id: condition.id, passed: false, detail: "no run yet" };
    });
    return { passed: conditions.every((c) => c.passed), conditions };
  }

  private evaluateConditions(
    outcome: ReturnType<BridgeDomain["getOutcome"]>,
    domain: BridgeDomain,
  ): ConditionResult[] {
    return this.conditions.map((condition) => {
      switch (condition.kind) {
        case "crosses":
          return {
            id: condition.id,
            passed: outcome.crossed && !outcome.vehicleFell,
            detail: outcome.vehicleFell ? "vehicle fell into the water" : undefined,
          };
        case "holds":
          return {
            id: condition.id,
            passed: outcome.crossed && outcome.heldForSeconds >= condition.seconds,
            detail: `held ${Math.round(outcome.heldForSeconds * 10) / 10}s of ${condition.seconds}s`,
          };
        case "cost_within_budget":
          return {
            id: condition.id,
            passed: outcome.totalCost <= domain.budget,
            detail: `cost ${outcome.totalCost} of budget ${domain.budget}`,
          };
        case "pieces_within_max":
          return {
            id: condition.id,
            passed: domain.getPieceCount() <= domain.maxPieces,
            detail: `pieces ${domain.getPieceCount()} of max ${domain.maxPieces}`,
          };
      }
    });
  }

  onEvent(cb: (e: RuntimeEvent) => void): Unsubscribe {
    this.listeners.add(cb);
    return () => {
      this.listeners.delete(cb);
    };
  }

  /**
   * Debug and tooling access (admin CLI, tests): live world state.
   * No engine internals leak — RenderState is grid-unit positions only.
   */
  debugWorld(): {
    step: number;
    running: boolean;
    finished: boolean;
    pieces: RenderState["pieces"];
    vehicle: RenderState["vehicle"];
    vehicleKinematics: ReturnType<BridgeDomain["debugVehicle"]>;
  } {
    const domain = this.domain;
    if (!domain) throw new Error("runtime not loaded");
    const state = domain.getRenderState();
    return {
      step: domain.currentRunStep(),
      running: domain.isRunning(),
      finished: domain.isFinished(),
      pieces: state.pieces,
      vehicle: state.vehicle,
      vehicleKinematics: domain.debugVehicle(),
    };
  }

  getForceView(): ForceViewEntry[] {
    return this.domain?.getForceView() ?? [];
  }

  /**
   * Read-only design facts for the app HUD (EXPERIENCE_RUNTIME.md §7: the HUD
   * is DOM, owned by the app). Counts and cost come from the domain so the
   * display can never disagree with enforcement; the tray options themselves
   * still come from the spec and the domain rejects anything out of bounds.
   */
  getDesignInfo(): {
    pieces: number;
    cost: number;
    budget: number;
    maxPieces: number;
    vehicleId: string;
    buildEnabled: boolean;
  } {
    const domain = this.domain;
    if (!domain) throw new Error("runtime not loaded");
    return {
      pieces: domain.getPieceCount(),
      cost: domain.getCost(),
      budget: domain.budget,
      maxPieces: domain.maxPieces,
      vehicleId: domain.getVehicleId(),
      buildEnabled: domain.buildEnabled,
    };
  }

  dispose(): void {
    this.pause();
    this.domain?.dispose();
    this.domain = null;
    this.listeners.clear();
    this.canvas = null;
    this.disposed = true;
  }

  /**
   * Canvas 2D render (§11: vector shapes only, devicePixelRatio capped at 2).
   * The canvas draws the world only; the HUD is DOM, never canvas (§7).
   * Force view renders pattern + color, never color alone (§10): compression
   * gets blue diagonal stripes, tension gets orange dots. The text legend and
   * labels live in the app's DOM, next to the toggle.
   */
  private render(): void {
    const domain = this.domain;
    const canvas = this.canvas;
    if (!domain || !canvas) return;
    const g = canvas.getContext("2d");
    if (!g) return;

    const state = domain.getRenderState();
    const viewW = domain.gapUnits + 8;
    const viewH = 7;
    const dpr = Math.min(
      2,
      typeof window !== "undefined" && typeof window.devicePixelRatio === "number"
        ? window.devicePixelRatio
        : 1,
    );
    const cssW = canvas.width / (dpr || 1);
    const cssH = canvas.height / (dpr || 1);
    const scale = Math.min(cssW / viewW, cssH / viewH);
    const offsetX = (cssW - viewW * scale) / 2;
    const offsetY = (cssH - viewH * scale) / 2;
    const toX = (u: number): number => offsetX + (u + 4) * scale;
    const toY = (u: number): number => offsetY + (u + 1) * scale;
    const size = (u: number): number => u * scale;

    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, cssW, cssH);

    // Water: the failure area below the water line.
    g.fillStyle = "#CFE7F5";
    g.fillRect(
      toX(-4),
      toY(state.waterY),
      size(viewW),
      size(viewH - (state.waterY + 1)),
    );

    // Banks and riverbed.
    g.fillStyle = "#9AA0A6";
    for (const bank of state.banks) {
      g.fillRect(
        toX(bank.x - bank.w / 2),
        toY(bank.y - bank.h / 2),
        size(bank.w),
        size(bank.h),
      );
    }

    // Water line (DOM carries the label).
    g.strokeStyle = "#1F5FBF";
    g.lineWidth = 1;
    g.beginPath();
    g.moveTo(toX(-4), toY(state.waterY));
    g.lineTo(toX(domain.gapUnits + 4), toY(state.waterY));
    g.stroke();

    for (const piece of state.pieces) {
      if (piece.broken) continue;
      g.save();
      g.translate(toX(piece.x), toY(piece.y));
      g.rotate(piece.angle);
      g.fillStyle = piece.material === "steel" ? "#8899A6" : "#B07A45";
      g.fillRect(
        -size(piece.length) / 2,
        -size(piece.thickness) / 2,
        size(piece.length),
        size(piece.thickness),
      );
      if (this.forceView && piece.mode !== null && piece.ratio > 0.1) {
        this.renderForceOverlay(g, piece.length, piece.thickness, scale, piece.mode);
      }
      g.restore();
    }

    if (state.vehicle) {
      g.fillStyle = "#1F2430";
      g.fillRect(
        toX(state.vehicle.x - state.vehicle.width / 2),
        toY(state.vehicle.y - state.vehicle.height / 2),
        size(state.vehicle.width),
        size(state.vehicle.height),
      );
    }
  }

  private renderForceOverlay(
    g: CanvasRenderingContext2D,
    lengthUnits: number,
    thicknessUnits: number,
    scale: number,
    mode: "compression" | "tension",
  ): void {
    const halfLen = (lengthUnits * scale) / 2;
    if (mode === "compression") {
      g.strokeStyle = "#1F5FBF";
      g.lineWidth = 2;
      for (let x = -halfLen + 4; x < halfLen - 2; x += 7) {
        g.beginPath();
        g.moveTo(x, (-thicknessUnits * scale) / 2);
        g.lineTo(x + 4, (thicknessUnits * scale) / 2);
        g.stroke();
      }
    } else {
      g.fillStyle = "#C2410C";
      for (let x = -halfLen + 4; x < halfLen - 2; x += 7) {
        g.beginPath();
        g.arc(x, 0, 1.8, 0, Math.PI * 2);
        g.fill();
      }
    }
  }
}




