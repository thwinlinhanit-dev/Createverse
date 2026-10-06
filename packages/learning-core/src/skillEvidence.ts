/**
 * Skill evidence derivation.
 * Source: DATA_MODEL.md §5 — skill level is the sum of recent evidence strengths with
 * time decay, mapped to the skill's configured levels. Pure functions with injected
 * clocks so results are deterministic in tests (TESTING.md §3).
 */

export interface EvidenceItem {
  /** Strength in [0, 1], matching assessment evidence signals (DATA_MODEL.md §2.5). */
  readonly strength: number;
  /** When the evidence happened, epoch milliseconds (UTC). */
  readonly atMs: number;
}

export interface SkillDerivation {
  readonly weightedSum: number;
  readonly level: number;
}

export const DEFAULT_HALF_LIFE_DAYS = 30;
const DAY_MS = 86_400_000;

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

export function weightedEvidenceSum(
  items: readonly EvidenceItem[],
  nowMs: number,
  halfLifeDays: number = DEFAULT_HALF_LIFE_DAYS,
): number {
  if (!Number.isFinite(nowMs)) throw new Error("nowMs must be a finite number");
  if (!(halfLifeDays > 0)) throw new Error("halfLifeDays must be positive");
  let sum = 0;
  for (const item of items) {
    const ageDays = Math.max(0, (nowMs - item.atMs) / DAY_MS);
    const decay = Math.pow(0.5, ageDays / halfLifeDays);
    sum += clamp01(item.strength) * decay;
  }
  return sum;
}

/** Map a weighted sum to the skill's configured levels. 0 = no evidence yet. */
export function skillLevelFromWeight(sum: number, levels: number): number {
  if (!Number.isFinite(sum) || sum <= 0) return 0;
  if (!Number.isInteger(levels) || levels < 1) {
    throw new Error("levels must be a positive integer");
  }
  return Math.min(levels, Math.floor(sum));
}

export function deriveSkillState(
  items: readonly EvidenceItem[],
  nowMs: number,
  levels: number,
  halfLifeDays: number = DEFAULT_HALF_LIFE_DAYS,
): SkillDerivation {
  const weightedSum = weightedEvidenceSum(items, nowMs, halfLifeDays);
  return { weightedSum, level: skillLevelFromWeight(weightedSum, levels) };
}
