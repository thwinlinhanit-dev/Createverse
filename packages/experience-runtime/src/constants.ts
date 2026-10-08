import type { MaterialId, PieceType } from "./types.ts";

/**
 * Bridge domain constants (EXPERIENCE_RUNTIME.md §5, §11, §15.2).
 * Coordinates are grid units (1 unit = 1 grid cell); physics runs in pixels.
 * Capacity constants are provisional teaching-model values tuned with the §8
 * fixtures — EXPERIENCE_RUNTIME.md §15.2 lists this as an open tuning decision.
 * They are data-shaped so content can override them later without code changes.
 */

export const PX_PER_UNIT = 32;
/** Fixed physics step: 1/60 s (§5: no wall-clock or frame-rate dependence). */
export const STEP_MS = 1000 / 60;
export const SNAP_RADIUS_UNITS = 0.75;
/** Snap points sit this far apart along banks and pieces (grid-friendly). */
export const ANCHOR_SPACING_UNITS = 0.5;
export const DEFAULT_GAP_UNITS = 3;
/** Water surface in grid units; below this line is the failure area. */
export const WATER_Y_UNITS = 3.6;
/** Riverbed top; pillars stand on it. */
export const RIVERBED_TOP_UNITS = 4.0;
/** Hard cap so a stuck simulation cannot run forever (20 s of sim time). */
export const MAX_RUN_SECONDS = 20;

export const MATERIALS: Readonly<Record<MaterialId, { cost: number; strength: number }>> = {
  wood: { cost: 1, strength: 1 },
  steel: { cost: 2, strength: 1.6 },
};

/** Max strain (sag or end-shortening per unit length) before a piece breaks. */
export const PIECE_CAPACITY: Readonly<Record<PieceType, number>> = {
  plank: 0.09,
  pillar: 0.3,
  beam: 0.13,
  brace: 0.16,
};

export const PIECE_THICKNESS: Readonly<Record<PieceType, number>> = {
  plank: 0.35,
  pillar: 0.45,
  beam: 0.5,
  brace: 0.3,
};

export interface VehicleSpec {
  readonly mass: number;
  readonly width: number;
  readonly height: number;
  /** Units per second, left to right (§5). */
  readonly speed: number;
}

export const VEHICLES: Readonly<Record<string, VehicleSpec>> = {
  car: { mass: 2, width: 1.2, height: 0.6, speed: 3 },
  truck: { mass: 6, width: 1.8, height: 0.9, speed: 2.6 },
  train: { mass: 10, width: 2.6, height: 0.9, speed: 2.2 },
};

export const PIECE_TYPES: readonly PieceType[] = ["plank", "pillar", "beam", "brace"];
export const MATERIAL_IDS: readonly MaterialId[] = ["wood", "steel"];
