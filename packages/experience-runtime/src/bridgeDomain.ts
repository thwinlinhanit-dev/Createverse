import Matter from "matter-js";
import { StepOverrideSchema, type ExperienceSpec } from "@createverse/shared-types";
import {
  ANCHOR_SPACING_UNITS,
  DEFAULT_GAP_UNITS,
  MATERIALS,
  MATERIAL_IDS,
  MAX_RUN_SECONDS,
  PIECE_CAPACITY,
  PIECE_THICKNESS,
  PIECE_TYPES,
  PX_PER_UNIT,
  RIVERBED_TOP_UNITS,
  SNAP_RADIUS_UNITS,
  STEP_MS,
  VEHICLES,
  WATER_Y_UNITS,
} from "./constants.ts";
import type {
  DesignPiece,
  ForceViewEntry,
  MaterialId,
  PieceType,
  RenderState,
  RunOutcome,
} from "./types.ts";

const { Engine, Bodies, Body, Composite, Constraint, Vector } = Matter;

/**
 * Bridge domain (EXPERIENCE_RUNTIME.md §5): grid world, banks, gap, riverbed,
 * pieces connected by constraints, vehicles that drive left to right.
 *
 * Build mode: piece bodies are static (the design is stable while building).
 * Run mode: bodies go dynamic; pieces break when measured strain exceeds
 * capacity (teaching model — strain proxy per §5, constants per §15.2).
 * Determinism: fixed 1/60 s steps, no Math.random(), no Date.now() (§8).
 */

const HOLD_TAIL_SECONDS = 1; // settle time when no holds condition applies
/**
 * Construction clearance per body end: bodies are built 0.05u shorter than the
 * design line so starting faces only touch, never interpenetrate. Matter's
 * positional solver treats even a few pixels of penetration as a hard shove;
 * without clearance, first-run steps teleport pieces and strain explodes.
 * Constraint anchors still hold everything within 1px, so behavior is stable.
 */
const BODY_END_CLEARANCE_UNITS = 0.05;

interface SnapAnchor {
  readonly body: Matter.Body;
  readonly offsetX: number;
  readonly offsetY: number;
  readonly x: number;
  readonly y: number;
}

interface LocalPoint {
  readonly offsetX: number;
  readonly offsetY: number;
}

interface WorldPiece {
  readonly design: DesignPiece;
  readonly body: Matter.Body;
  readonly restLengthPx: number;
  /** Design-pose centre: the design is rebuilt at every run start (resetRun),
   *  so sag is always measured against the drawn pose, never against drift. */
  readonly restCenterY: number;
  readonly end1: LocalPoint;
  readonly end2: LocalPoint;
  readonly constraints: Matter.Constraint[];
  broken: boolean;
  strain: number;
  mode: "compression" | "tension" | null;
}

export type PlaceResult =
  | { readonly ok: true; readonly piece: DesignPiece }
  | { readonly ok: false; readonly code: string };

/**
 * Content-supplied piece ids arrive as plain strings; an unknown id rejects the
 * spec with a clear error rather than silently allowing a piece the domain
 * cannot model (EXPERIENCE_RUNTIME.md §5).
 */
function toPieceTypes(ids: readonly string[]): readonly PieceType[] {
  return ids.map((id) => {
    if (!(PIECE_TYPES as readonly string[]).includes(id)) {
      throw new Error(`unknown piece type "${id}" — spec rejected (EXPERIENCE_RUNTIME.md §5)`);
    }
    return id as PieceType;
  });
}

/** Most anchors considered per drawn endpoint when picking a snap pair. */
const MAX_SNAP_CANDIDATES = 4;
/** Two bodies sitting within this many px count as touching, not overlapping. */
const OVERLAP_EPSILON_PX = 1;
/** Slope below this counts as flat, so left↔right redraws canonicalise alike. */
const FLAT_EPSILON = 1e-6;

/**
 * Design lines are undirected to the player: a deck redrawn right-to-left is
 * the same deck. Canonicalise the drawn direction (dy > 0; flat lines dx > 0)
 * before deriving the face normal, so stroke direction never changes which
 * side of the line the piece occupies (§5 grid model).
 */
function canonicalDirection(dx: number, dy: number): { dx: number; dy: number } {
  if (dy < -FLAT_EPSILON || (Math.abs(dy) <= FLAT_EPSILON && dx < 0)) {
    return { dx: -dx, dy: -dy };
  }
  return { dx, dy };
}

interface PieceGeometry {
  readonly angle: number;
  readonly normalX: number;
  readonly normalY: number;
  readonly centerX: number;
  readonly centerY: number;
  readonly lengthPx: number;
  readonly thicknessPx: number;
  readonly lengthUnits: number;
}

/**
 * Shared by placement (overlap test) and world creation: the body sits half a
 * thickness on the +normal side of the design line, so the line itself is one
 * face of the piece — for a deck, its top surface (§5).
 */
function pieceGeometry(design: DesignPiece): PieceGeometry {
  const dx = design.x2 - design.x1;
  const dy = design.y2 - design.y1;
  const lengthUnits = Math.hypot(dx, dy);
  const dir = canonicalDirection(dx, dy);
  const angle = Math.atan2(dir.dy, dir.dx);
  const normalX = -Math.sin(angle);
  const normalY = Math.cos(angle);
  const thickness = PIECE_THICKNESS[design.pieceType];
  const offset = thickness / 2;
  return {
    angle,
    normalX,
    normalY,
    centerX: (design.x1 + design.x2) / 2 + normalX * offset,
    centerY: (design.y1 + design.y2) / 2 + normalY * offset,
    lengthPx: lengthUnits * PX_PER_UNIT - 2 * BODY_END_CLEARANCE_UNITS * PX_PER_UNIT,
    thicknessPx: thickness * PX_PER_UNIT,
    lengthUnits,
  };
}

/** World-space corners (px) of the body a design line produces. */
function pieceCorners(g: PieceGeometry): { x: number; y: number }[] {
  const cx = g.centerX * PX_PER_UNIT;
  const cy = g.centerY * PX_PER_UNIT;
  const dx = Math.cos(g.angle) * (g.lengthPx / 2);
  const dy = Math.sin(g.angle) * (g.lengthPx / 2);
  const nx = g.normalX * (g.thicknessPx / 2);
  const ny = g.normalY * (g.thicknessPx / 2);
  return [
    { x: cx - dx - nx, y: cy - dy - ny },
    { x: cx + dx - nx, y: cy + dy - ny },
    { x: cx + dx + nx, y: cy + dy + ny },
    { x: cx - dx + nx, y: cy - dy + ny },
  ];
}

/**
 * Separating-axis test for two convex polygons (every body here is a
 * rectangle). Bodies closer than OVERLAP_EPSILON_PX are treated as touching:
 * end faces built with BODY_END_CLEARANCE_UNITS must still register as joint.
 */
function polygonsOverlap(
  a: readonly { x: number; y: number }[],
  b: readonly { x: number; y: number }[],
): boolean {
  const axes: { x: number; y: number }[] = [];
  for (const poly of [a, b]) {
    for (let i = 0; i < poly.length; i += 1) {
      const p = poly[i];
      const q = poly[(i + 1) % poly.length];
      if (!p || !q) continue;
      const ex = q.x - p.x;
      const ey = q.y - p.y;
      const len = Math.hypot(ex, ey);
      if (len < 1e-9) continue;
      axes.push({ x: -ey / len, y: ex / len });
    }
  }
  for (const axis of axes) {
    let minA = Infinity;
    let maxA = -Infinity;
    let minB = Infinity;
    let maxB = -Infinity;
    for (const p of a) {
      const d = p.x * axis.x + p.y * axis.y;
      if (d < minA) minA = d;
      if (d > maxA) maxA = d;
    }
    for (const p of b) {
      const d = p.x * axis.x + p.y * axis.y;
      if (d < minB) minB = d;
      if (d > maxB) maxB = d;
    }
    if (maxA <= minB + OVERLAP_EPSILON_PX || maxB <= minA + OVERLAP_EPSILON_PX) return false;
  }
  return true;
}

export interface HistoryChange {
  readonly added: readonly DesignPiece[];
  readonly removed: readonly DesignPiece[];
}

interface HistoryEntry {
  readonly design: readonly DesignPiece[];
  readonly counter: number;
}

export class BridgeDomain {
  readonly gapUnits: number;
  readonly maxPieces: number;
  readonly budget: number;
  readonly allowedPieces: readonly PieceType[];
  readonly allowedVehicles: readonly string[];
  readonly bonusVehicle: string | null;
  readonly buildEnabled: boolean;
  readonly defaultVehicleId: string;

  private readonly engine: Matter.Engine;
  private readonly variables: Readonly<Record<string, number>>;
  private readonly pieces = new Map<string, WorldPiece>();
  private readonly anchors: SnapAnchor[] = [];
  private readonly undoStack: HistoryEntry[] = [];
  private readonly redoStack: HistoryEntry[] = [];
  private readonly allowedMaterials: ReadonlySet<string>;

  private counter = 0;
  private vehicleBody: Matter.Body | null = null;
  private vehicleId = "";
  private running = false;
  private finished = false;
  private runStep = 0;
  private crossed = false;
  private crossedAtStep: number | null = null;
  private vehicleFell = false;
  private holdUntilStep: number | null = null;
  private holdSeconds = 0;
  private peakLoadRatio = 0;
  private unstable = false;
  private targetSpeedPxPerStep = 0;

  constructor(spec: ExperienceSpec, stepId: string) {
    const rawOverride = spec.step_overrides?.[stepId];
    let override: ReturnType<typeof StepOverrideSchema.parse> | undefined;
    if (rawOverride !== undefined) {
      const parsed = StepOverrideSchema.safeParse(rawOverride);
      if (!parsed.success) {
        throw new Error(
          `invalid step override for "${stepId}": ${parsed.error.issues
            .map((i) => `${i.path.join(".")}: ${i.message}`)
            .join("; ")}`,
        );
      }
      override = parsed.data;
      if (override.preset !== undefined) {
        throw new Error(
          `preset override "${override.preset}" loads content/presets/*.json — not implemented in the P0-07 spike (task P1-20)`,
        );
      }
    }

    const gap = spec.constraints.gap_width ?? DEFAULT_GAP_UNITS;
    this.gapUnits = gap;
    this.maxPieces = override?.max_pieces ?? spec.constraints.max_pieces;
    this.budget = override?.budget ?? spec.constraints.budget;
    this.allowedPieces = toPieceTypes(
      override?.pieces ?? spec.constraints.piece_types ?? PIECE_TYPES,
    );
    this.allowedVehicles =
      override?.vehicles ?? spec.constraints.vehicles ?? Object.keys(VEHICLES);
    this.bonusVehicle = override?.bonus_vehicle ?? null;
    this.buildEnabled = override?.build_enabled ?? true;
    const firstVehicle = this.allowedVehicles[0];
    if (firstVehicle === undefined) {
      throw new Error("spec must allow at least one vehicle");
    }
    this.defaultVehicleId =
      override?.vehicle !== undefined && this.allowedVehicles.includes(override.vehicle)
        ? override.vehicle
        : firstVehicle;
    this.vehicleId = this.defaultVehicleId;
    this.allowedMaterials = new Set(
      Object.keys(spec.constraints.materials ?? MATERIALS),
    );

    this.engine = Engine.create({ enableSleeping: false });
    this.engine.gravity.y = (spec.variables["gravity"] ?? 9.8) / 9.8;
    this.variables = spec.variables;

    this.buildStaticWorld();
  }

  private px(units: number): number {
    return units * PX_PER_UNIT;
  }

  private buildStaticWorld(): void {
    const gap = this.gapUnits;
    const bank = Bodies.rectangle(this.px(-4), this.px(2), this.px(8), this.px(4), {
      isStatic: true,
      friction: 1,
    });
    const rightBank = Bodies.rectangle(
      this.px(gap + 4),
      this.px(2),
      this.px(8),
      this.px(4),
      { isStatic: true, friction: 1 },
    );
    const bed = Bodies.rectangle(
      this.px(gap / 2),
      this.px(RIVERBED_TOP_UNITS + 0.75),
      this.px(gap),
      this.px(1.5),
      { isStatic: true, friction: 1 },
    );
    Composite.add(this.engine.world, [bank, rightBank, bed]);
    this.registerStaticAnchors(bank, rightBank, bed);
  }

  /** Anchor points (§5): banks' top edges and the riverbed under the gap. */
  private registerStaticAnchors(left: Matter.Body, right: Matter.Body, bed: Matter.Body): void {
    const gap = this.gapUnits;
    const along = (from: number, to: number): number[] => {
      const xs: number[] = [];
      const dir = to >= from ? 1 : -1;
      for (let x = from; dir > 0 ? x <= to + 1e-9 : x >= to - 1e-9; x += dir * ANCHOR_SPACING_UNITS) {
        xs.push(Math.round(x * 1000) / 1000);
      }
      return xs;
    };
    for (const x of along(0, -3)) this.addBankAnchor(left, x, 0);
    for (const x of along(gap, gap + 3)) this.addBankAnchor(right, x, 0);
    if (gap > ANCHOR_SPACING_UNITS) {
      for (const x of along(ANCHOR_SPACING_UNITS, gap - ANCHOR_SPACING_UNITS)) {
        this.addBankAnchor(bed, x, RIVERBED_TOP_UNITS);
      }
    }
  }

  private addBankAnchor(body: Matter.Body, x: number, y: number): void {
    this.anchors.push({
      body,
      offsetX: this.px(x) - body.position.x,
      offsetY: this.px(y) - body.position.y,
      x,
      y,
    });
  }

  private nearestAnchor(x: number, y: number): SnapAnchor | null {
    let best: SnapAnchor | null = null;
    let bestDist = SNAP_RADIUS_UNITS;
    for (const anchor of this.anchors) {
      const dist = Math.hypot(anchor.x - x, anchor.y - y);
      if (dist <= bestDist) {
        bestDist = dist;
        best = anchor;
      }
    }
    return best;
  }

  /**
   * Snap candidates for one drawn endpoint, nearest first; a `null` entry is
   * the free (unsnapped) fallback and ranks last. Placement tries pairs of
   * these so a piece can fall back to another anchor when the nearest one
   * would drive it through an existing piece.
   */
  private anchorCandidates(
    x: number,
    y: number,
  ): { anchor: SnapAnchor | null; dist: number }[] {
    const found: { anchor: SnapAnchor; dist: number }[] = [];
    for (const anchor of this.anchors) {
      const dist = Math.hypot(anchor.x - x, anchor.y - y);
      if (dist <= SNAP_RADIUS_UNITS) found.push({ anchor, dist });
    }
    found.sort((p, q) => p.dist - q.dist);
    const out: { anchor: SnapAnchor | null; dist: number }[] = found.slice(
      0,
      MAX_SNAP_CANDIDATES,
    );
    out.push({ anchor: null, dist: SNAP_RADIUS_UNITS });
    return out;
  }

  /** True when the design's body would intersect the banks, bed or a piece. */
  private overlapsWorld(design: DesignPiece): boolean {
    const corners = pieceCorners(pieceGeometry(design));
    for (const body of Composite.allBodies(this.engine.world)) {
      if (body === this.vehicleBody) continue;
      if (polygonsOverlap(corners, body.vertices)) return true;
    }
    return false;
  }

  placePiece(cmd: {
    pieceType: PieceType;
    material: MaterialId;
    x1: number;
    y1: number;
    x2: number;
    y2: number;
  }): PlaceResult {
    if (!this.buildEnabled) return { ok: false, code: "build_disabled" };
    if (this.running) return { ok: false, code: "run_in_progress" };
    if (!this.allowedPieces.includes(cmd.pieceType)) {
      return { ok: false, code: "piece_not_allowed" };
    }
    if (!MATERIAL_IDS.includes(cmd.material) || !this.allowedMaterials.has(cmd.material)) {
      return { ok: false, code: "material_not_allowed" };
    }
    if (this.pieces.size >= this.maxPieces) {
      return { ok: false, code: "max_pieces_reached" };
    }
    if (Math.hypot(cmd.x2 - cmd.x1, cmd.y2 - cmd.y1) < 0.5) {
      return { ok: false, code: "too_short" };
    }

    const list1 = this.anchorCandidates(cmd.x1, cmd.y1);
    const list2 = this.anchorCandidates(cmd.x2, cmd.y2);
    const hasAnchor = [...list1, ...list2].some((c) => c.anchor !== null);
    if (!hasAnchor) return { ok: false, code: "no_anchor" };

    const makeDesign = (
      a1: SnapAnchor | null,
      a2: SnapAnchor | null,
    ): DesignPiece => ({
      id: `p${this.counter + 1}`,
      pieceType: cmd.pieceType,
      material: cmd.material,
      x1: a1 ? a1.x : cmd.x1,
      y1: a1 ? a1.y : cmd.y1,
      x2: a2 ? a2.x : cmd.x2,
      y2: a2 ? a2.y : cmd.y2,
    });

    // Try snap pairs cheapest-first. The nearest pair wins unless its body
    // would intersect the world: a pillar drawn down from the deck's top face
    // then re-snaps to the deck's underside instead of being driven through it.
    let chosen: { design: DesignPiece; a1: SnapAnchor | null; a2: SnapAnchor | null } | null =
      null;
    let sawTooShort = false;
    for (const c1 of list1) {
      for (const c2 of list2) {
        const design = makeDesign(c1.anchor, c2.anchor);
        if (Math.hypot(design.x2 - design.x1, design.y2 - design.y1) < 0.5) {
          sawTooShort = true;
          continue;
        }
        if (this.overlapsWorld(design)) continue;
        chosen = { design, a1: c1.anchor, a2: c2.anchor };
        break;
      }
      if (chosen) break;
    }
    if (!chosen) {
      return { ok: false, code: sawTooShort ? "too_short" : "overlapping_piece" };
    }

    this.pushHistory();
    this.pieces.set(chosen.design.id, this.createWorldPiece(chosen.design, chosen.a1, chosen.a2));
    this.counter += 1;
    this.redoStack.length = 0;
    return { ok: true, piece: chosen.design };
  }

  private createWorldPiece(
    design: DesignPiece,
    anchor1: SnapAnchor | null,
    anchor2: SnapAnchor | null,
  ): WorldPiece {
    const lengthUnits = Math.hypot(design.x2 - design.x1, design.y2 - design.y1);
    const g = pieceGeometry(design);
    const body = Bodies.rectangle(
      this.px(g.centerX),
      this.px(g.centerY),
      g.lengthPx,
      g.thicknessPx,
      { angle: g.angle, friction: 1, restitution: 0 },
    );
    // Static via setStatic (not the `isStatic` option): Matter only records the
    // body's finite mass into `_original` through setStatic(true), and
    // beginRun() later re-enables dynamics via setStatic(false). Setting
    // isStatic in the options leaves `_original` unset and enabling dynamics
    // afterwards corrupts the body with NaN on the next Engine.update.
    Body.setStatic(body, true);

    const restLengthPx = this.px(lengthUnits);
    const toLocal = (x: number, y: number): LocalPoint => {
      const dx = this.px(x) - body.position.x;
      const dy = this.px(y) - body.position.y;
      return {
        offsetX: dx * Math.cos(g.angle) + dy * Math.sin(g.angle),
        offsetY: -dx * Math.sin(g.angle) + dy * Math.cos(g.angle),
      };
    };

    const piece: WorldPiece = {
      design,
      body,
      restLengthPx,
      restCenterY: body.position.y,
      end1: toLocal(design.x1, design.y1),
      end2: toLocal(design.x2, design.y2),
      constraints: [],
      broken: false,
      strain: 0,
      mode: null,
    };

    for (const [anchor, end] of [
      [anchor1, piece.end1],
      [anchor2, piece.end2],
    ] as const) {
      if (anchor) {
        // length: 1px slack — Matter's solver divides by constraint length, so an
        // exact 0 corrupts bodies with NaN. Anchors still hold within 0.03 units.
        const constraint = Constraint.create({
          bodyA: anchor.body,
          pointA: { x: anchor.offsetX, y: anchor.offsetY },
          bodyB: body,
          pointB: { x: end.offsetX, y: end.offsetY },
          length: 1,
          stiffness: 0.6,
          damping: 0.15,
        });
        piece.constraints.push(constraint);
        Composite.add(this.engine.world, constraint);
      }
    }

    // Anchors on BOTH faces of the piece (§5: "attachment points on banks and
    // on existing pieces"): the design line itself, plus the opposite face one
    // thickness along the normal. A deck offers its top (deck-to-deck seams sit
    // on one line) and its underside, so a pillar dropped under the deck snaps
    // flush to the underside instead of being driven up through the deck.
    const thickness = PIECE_THICKNESS[design.pieceType];
    const samples: number[] = [];
    for (let t = 0; t <= lengthUnits + 1e-9; t += ANCHOR_SPACING_UNITS) samples.push(t);
    if (samples[samples.length - 1] !== lengthUnits) samples.push(lengthUnits);
    for (const faceOffset of [0, thickness]) {
      for (const t of samples) {
        const f = lengthUnits === 0 ? 0 : t / lengthUnits;
        const ax = design.x1 + (design.x2 - design.x1) * f + g.normalX * faceOffset;
        const ay = design.y1 + (design.y2 - design.y1) * f + g.normalY * faceOffset;
        const local = toLocal(ax, ay);
        this.anchors.push({ body, offsetX: local.offsetX, offsetY: local.offsetY, x: ax, y: ay });
      }
    }

    Composite.add(this.engine.world, body);
    return piece;
  }

  removePiece(pieceId: string): PlaceResult {
    if (this.running) return { ok: false, code: "run_in_progress" };
    const piece = this.pieces.get(pieceId);
    if (!piece) return { ok: false, code: "piece_not_found" };
    this.pushHistory();
    this.destroyPiece(piece);
    this.pieces.delete(pieceId);
    this.dropAnchors(piece.body);
    this.redoStack.length = 0;
    return { ok: true, piece: piece.design };
  }

  private destroyPiece(piece: WorldPiece): void {
    Composite.remove(this.engine.world, piece.body);
    for (const constraint of piece.constraints) {
      Composite.remove(this.engine.world, constraint);
    }
  }

  private dropAnchors(body: Matter.Body): void {
    for (let i = this.anchors.length - 1; i >= 0; i -= 1) {
      if (this.anchors[i]?.body === body) this.anchors.splice(i, 1);
    }
  }

  private snapshotHistory(): HistoryEntry {
    return { design: this.getDesign(), counter: this.counter };
  }

  private pushHistory(): void {
    this.undoStack.push(this.snapshotHistory());
  }

  private rebuildDesign(design: readonly DesignPiece[], counter: number): HistoryChange {
    const current = this.getDesign();
    const before = new Set(current.map((p) => p.id));
    const after = new Set(design.map((p) => p.id));

    for (const piece of this.pieces.values()) this.destroyPiece(piece);
    this.pieces.clear();
    this.anchors.length = 0;
    this.rebuildStaticAnchors();
    this.counter = counter;
    for (const entry of design) {
      // Snap points are recomputed exactly as during placement: design coordinates
      // were already snapped, so previously connected pieces reconnect identically.
      this.pieces.set(
        entry.id,
        this.createWorldPiece(
          entry,
          this.nearestAnchor(entry.x1, entry.y1),
          this.nearestAnchor(entry.x2, entry.y2),
        ),
      );
    }
    return {
      added: design.filter((p) => !before.has(p.id)),
      removed: current.filter((p) => !after.has(p.id)),
    };
  }

  /** Re-register only bank and riverbed anchors after a full rebuild. */
  private rebuildStaticAnchors(): void {
    const bodies = Composite.allBodies(this.engine.world);
    const left = bodies[0];
    const right = bodies[1];
    const bed = bodies[2];
    if (!left || !right || !bed) throw new Error("static world missing");
    this.registerStaticAnchors(left, right, bed);
  }

  undo(): HistoryChange {
    if (this.running) return { added: [], removed: [] };
    const previous = this.undoStack.pop();
    if (!previous) return { added: [], removed: [] };
    this.redoStack.push(this.snapshotHistory());
    return this.rebuildDesign(previous.design, previous.counter);
  }

  redo(): HistoryChange {
    if (this.running) return { added: [], removed: [] };
    const next = this.redoStack.pop();
    if (!next) return { added: [], removed: [] };
    this.undoStack.push(this.snapshotHistory());
    return this.rebuildDesign(next.design, next.counter);
  }

  clear(): HistoryChange {
    if (this.running || this.pieces.size === 0) return { added: [], removed: [] };
    this.pushHistory();
    this.redoStack.length = 0;
    return this.rebuildDesign([], this.counter);
  }

  getDesign(): DesignPiece[] {
    return [...this.pieces.values()].map((p) => ({ ...p.design }));
  }

  getPieceCount(): number {
    return this.pieces.size;
  }

  getVehicleId(): string {
    return this.vehicleId;
  }

  setVehicle(vehicleId: string): { ok: true } | { ok: false; code: string } {
    if (this.running) return { ok: false, code: "run_in_progress" };
    if (!this.allowedVehicles.includes(vehicleId)) {
      return { ok: false, code: "vehicle_not_allowed" };
    }
    this.vehicleId = vehicleId;
    return { ok: true };
  }

  isRunning(): boolean {
    return this.running;
  }

  /** Test/debug access to the live vehicle body (grid units, px/step). */
  debugVehicle(): {
    x: number;
    y: number;
    vx: number;
    vy: number;
    angle: number;
    angularVelocity: number;
  } | null {
    const body = this.vehicleBody;
    if (!body) return null;
    return {
      x: body.position.x / PX_PER_UNIT,
      y: body.position.y / PX_PER_UNIT,
      vx: body.velocity.x,
      vy: body.velocity.y,
      angle: body.angle,
      angularVelocity: body.angularVelocity,
    };
  }

  isFinished(): boolean {
    return this.finished;
  }

  currentRunStep(): number {
    return this.runStep;
  }

  beginRun(holdSeconds: number): { ok: true } | { ok: false; code: string } {
    if (this.running) return { ok: false, code: "run_in_progress" };
    this.resetRun();
    this.unstable = false;
    const vehicle = VEHICLES[this.vehicleId];
    if (!vehicle) return { ok: false, code: "vehicle_unknown" };

    this.running = true;
    this.holdSeconds = holdSeconds;
    for (const piece of this.pieces.values()) {
      if (!piece.broken) Body.setStatic(piece.body, false);
    }

    const body = Bodies.rectangle(
      this.px(-1.6),
      this.px(-(vehicle.height / 2 + 0.05)),
      this.px(vehicle.width),
      this.px(vehicle.height),
      { friction: 0.9, frictionStatic: 1, restitution: 0 },
    );
    Body.setMass(body, this.variables[`mass.${this.vehicleId}`] ?? vehicle.mass);
    Body.setAngle(body, 0);
    Composite.add(this.engine.world, body);
    // Matter velocity is pixels per fixed step (1000/60 ms); cruiseControl()
    // re-asserts it after every step so friction cannot stop the vehicle.
    this.targetSpeedPxPerStep = (vehicle.speed * PX_PER_UNIT) / 60;
    Body.setVelocity(body, { x: this.targetSpeedPxPerStep, y: 0 });
    this.vehicleBody = body;
    return { ok: true };
  }

  stepOnce(): void {
    if (!this.running || this.finished) return;
    Engine.update(this.engine, STEP_MS);
    this.runStep += 1;
    // EXPERIENCE_RUNTIME §12: physics instability (NaN, runaway bodies) resets
    // the run and reports an error instead of corrupting results.
    if (this.scanInstability()) {
      this.unstable = true;
      this.finish();
      return;
    }
    this.measureStrain();
    this.cruiseControl();

    const vehicle = this.vehicleBody;
    if (vehicle) {
      const waterY = this.px(WATER_Y_UNITS);
      if (
        !this.crossed &&
        vehicle.position.x > this.px(this.gapUnits + 0.1) &&
        vehicle.position.y < waterY
      ) {
        this.crossed = true;
        this.crossedAtStep = this.runStep;
        const hold = this.holdSeconds > 0 ? this.holdSeconds : HOLD_TAIL_SECONDS;
        this.holdUntilStep = this.runStep + Math.ceil(hold * 60);
      }
      if (vehicle.position.y > waterY) this.vehicleFell = true;
    }

    if (this.vehicleFell) {
      this.finish();
      return;
    }
    if (this.holdUntilStep !== null && this.runStep >= this.holdUntilStep) {
      this.finish();
      return;
    }
    if (this.runStep >= MAX_RUN_SECONDS * 60) this.finish();
  }

  private finish(): void {
    this.finished = true;
    this.running = false;
  }

  /** Non-finite positions mean the solver blew up; quarantine the body. */
  private scanInstability(): boolean {
    for (const piece of this.pieces.values()) {
      if (piece.broken) continue;
      const { x, y } = piece.body.position;
      if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(piece.body.angle)) {
        this.logNaN(`piece ${piece.design.id}`);
        piece.broken = true;
        this.destroyPiece(piece);
        this.dropAnchors(piece.body);
      }
    }
    const vehicle = this.vehicleBody;
    if (!vehicle) return false;
    const unstable =
      !Number.isFinite(vehicle.position.x) ||
      !Number.isFinite(vehicle.position.y) ||
      !Number.isFinite(vehicle.angle);
    if (unstable) this.logNaN("vehicle");
    return unstable;
  }

  /** Temporary P0-07 instrument: gated behind CV_DEBUG, read by tune.test.ts. */
  private logNaN(which: string): void {
    if (process.env["CV_DEBUG"] !== "1") return;
    const bodies = Composite.allBodies(this.engine.world).map((b) => ({
      label: b.label,
      pos: [b.position.x, b.position.y],
      angle: b.angle,
      static: b.isStatic,
      mass: b.mass,
      speed: b.speed,
    }));
    const constraints = Composite.allConstraints(this.engine.world).map((c) => ({
      hasA: c.bodyA !== undefined,
      hasB: c.bodyB !== undefined,
      length: c.length,
      stiffness: c.stiffness,
    }));
    console.info(
      `NaN at step ${this.runStep} (${which}):`,
      JSON.stringify({ bodies, constraintCount: constraints.length, constraints }),
    );
  }

  private measureStrain(): void {
    for (const piece of this.pieces.values()) {
      if (piece.broken) continue;
      const center = piece.body.position;
      const angle = piece.body.angle;
      const worldEnd = (end: LocalPoint): { x: number; y: number } =>
        Vector.add(center, Vector.rotate({ x: end.offsetX, y: end.offsetY }, angle));
      const w1 = worldEnd(piece.end1);
      const w2 = worldEnd(piece.end2);
      const endDist = Vector.magnitude(Vector.sub(w2, w1));
      const endDelta = (piece.restLengthPx - endDist) / piece.restLengthPx;
      const lengthUnits = piece.restLengthPx / PX_PER_UNIT;
      const sagUnits = (center.y - piece.restCenterY) / PX_PER_UNIT;
      const sagRatio = sagUnits / lengthUnits;
      const strain = Math.max(sagRatio, Math.abs(endDelta));

      piece.strain = strain;
      piece.mode =
        endDelta > 1e-4
          ? "compression"
          : endDelta < -1e-4
            ? "tension"
            : sagRatio > 1e-4
              ? "compression"
              : null;

      const capacity =
        PIECE_CAPACITY[piece.design.pieceType] *
        MATERIALS[piece.design.material].strength;
      const ratio = strain / capacity;
      if (ratio > this.peakLoadRatio) this.peakLoadRatio = ratio;
      if (ratio > 1) {
        piece.broken = true;
        this.destroyPiece(piece);
        this.dropAnchors(piece.body);
      }
    }
  }

  getCost(): number {
    let cost = 0;
    for (const piece of this.pieces.values()) {
      const length = Math.hypot(
        piece.design.x2 - piece.design.x1,
        piece.design.y2 - piece.design.y1,
      );
      cost += MATERIALS[piece.design.material].cost * length;
    }
    return Math.round(cost * 100) / 100;
  }

  getOutcome(): RunOutcome {
    const pieces = [...this.pieces.values()];
    const waterY = this.px(WATER_Y_UNITS);
    return {
      vehicleId: this.vehicleId,
      crossed: this.crossed && !this.unstable,
      crossedAtStep: this.crossedAtStep,
      heldForSeconds:
        this.crossed && this.crossedAtStep !== null
          ? Math.max(0, (this.runStep - this.crossedAtStep) / 60)
          : 0,
      vehicleFell: this.vehicleFell,
      unstable: this.unstable,
      peakLoadRatio: this.peakLoadRatio,
      brokenPieceIds: pieces.filter((p) => p.broken).map((p) => p.design.id),
      fallenPieceIds: pieces
        .filter((p) => !p.broken && p.body.position.y > waterY)
        .map((p) => p.design.id),
      totalCost: this.getCost(),
      steps: this.runStep,
    };
  }

  getForceView(): ForceViewEntry[] {
    return [...this.pieces.values()]
      .filter((p) => !p.broken)
      .map((p) => {
        const capacity =
          PIECE_CAPACITY[p.design.pieceType] * MATERIALS[p.design.material].strength;
        return {
          pieceId: p.design.id,
          ratio: Math.round((p.strain / capacity) * 1000) / 1000,
          mode: p.mode,
        };
      });
  }

  resetRun(): void {
    if (this.vehicleBody) {
      Composite.remove(this.engine.world, this.vehicleBody);
      this.vehicleBody = null;
    }
    this.unstable = false;
    const design = this.getDesign();
    this.rebuildDesign(design, this.counter);
    this.running = false;
    this.finished = false;
    this.runStep = 0;
    this.crossed = false;
    this.crossedAtStep = null;
    this.vehicleFell = false;
    this.holdUntilStep = null;
    this.holdSeconds = 0;
    this.peakLoadRatio = 0;
  }

  restoreDesign(design: readonly DesignPiece[]): HistoryChange {
    let counter = 0;
    for (const entry of design) {
      const parsed = Number.parseInt(entry.id.replace(/^p/, ""), 10);
      if (Number.isFinite(parsed) && parsed > counter) counter = parsed;
    }
    this.undoStack.length = 0;
    this.redoStack.length = 0;
    return this.rebuildDesign(design, counter);
  }

  getRenderState(): RenderState {
    const gap = this.gapUnits;
    const vehicle = VEHICLES[this.vehicleId];
    return {
      banks: [
        { x: -4, y: 2, w: 8, h: 4 },
        { x: gap + 4, y: 2, w: 8, h: 4 },
        { x: gap / 2, y: RIVERBED_TOP_UNITS + 0.75, w: gap, h: 1.5 },
      ],
      waterY: WATER_Y_UNITS,
      pieces: [...this.pieces.values()].map((piece) => {
        const capacity =
          PIECE_CAPACITY[piece.design.pieceType] *
          MATERIALS[piece.design.material].strength;
        return {
          id: piece.design.id,
          x: piece.body.position.x / PX_PER_UNIT,
          y: piece.body.position.y / PX_PER_UNIT,
          angle: piece.body.angle,
          length: piece.restLengthPx / PX_PER_UNIT,
          thickness: PIECE_THICKNESS[piece.design.pieceType],
          material: piece.design.material,
          broken: piece.broken,
          ratio: Math.round((piece.strain / capacity) * 1000) / 1000,
          mode: piece.mode,
        };
      }),
      vehicle:
        this.vehicleBody && vehicle
          ? {
              x: this.vehicleBody.position.x / PX_PER_UNIT,
              y: this.vehicleBody.position.y / PX_PER_UNIT,
              width: vehicle.width,
              height: vehicle.height,
            }
          : null,
    };
  }

  /**
   * Vehicles drive left to right at a fixed speed (§5). Re-assert the target
   * velocity after each physics step so friction never stops the car — the
   * speed is data (spec), not physics luck. Yaw is locked too: the vehicle is
   * a scripted driver with no wheel model, and ground friction otherwise torques
   * the sliding box end-over-end (spike decision, RUNTIME_SPIKE.md §Tuning).
   * Deterministic: no randomness.
   */
  private cruiseControl(): void {
    const vehicle = this.vehicleBody;
    if (!vehicle) return;
    Body.setAngle(vehicle, 0);
    Body.setAngularVelocity(vehicle, 0);
    if (this.targetSpeedPxPerStep === 0) return;
    Body.setVelocity(vehicle, { x: this.targetSpeedPxPerStep, y: vehicle.velocity.y });
  }

  dispose(): void {
    Composite.clear(this.engine.world, false);
    this.pieces.clear();
    this.anchors.length = 0;
    this.vehicleBody = null;
    this.running = false;
    this.finished = false;
  }
}





