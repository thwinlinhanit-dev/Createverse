import type { HintLadder, HintLevel } from "@createverse/shared-types";

/**
 * Hint ladder progression — the offline-safe mentor path.
 * Sources: DATA_MODEL.md §2.4, AI_SPEC.md §2 (ask → hint → smaller hint → demonstrate →
 * explain → solution only when justified), TESTING.md §3 (never skips levels, never gives
 * the solution before `solution_allowed_after`).
 */

export interface HintProgress {
  /** How many hint levels have already been shown. 0 = none yet. */
  readonly levelReached: number;
  /** Attempts the child has made on the current step. */
  readonly attemptCount: number;
}

export function validateProgress(progress: HintProgress): void {
  if (!Number.isInteger(progress.levelReached) || progress.levelReached < 0) {
    throw new Error("levelReached must be a non-negative integer");
  }
  if (!Number.isInteger(progress.attemptCount) || progress.attemptCount < 0) {
    throw new Error("attemptCount must be a non-negative integer");
  }
}

/** The next hint level, or null when the ladder is exhausted or the solution is gated. */
export function getNextHint(ladder: HintLadder, progress: HintProgress): HintLevel | null {
  validateProgress(progress);
  const next = ladder.levels[progress.levelReached];
  if (!next) return null; // ladder exhausted
  if (next.type === "solution" && progress.attemptCount < ladder.solution_allowed_after) {
    return null; // solution is not justified yet
  }
  return next;
}

export function isSolutionAllowed(ladder: HintLadder, attemptCount: number): boolean {
  return attemptCount >= ladder.solution_allowed_after;
}

/** Advance after a hint was shown. Levels advance one at a time — never skipped. */
export function advance(progress: HintProgress): HintProgress {
  validateProgress(progress);
  return { levelReached: progress.levelReached + 1, attemptCount: progress.attemptCount };
}
