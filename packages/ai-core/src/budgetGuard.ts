import type { BudgetGuard, BudgetScope, AIUsage } from "./types.ts";

/**
 * Budget guard — CREATEVERSE_BUILD_PLAN.md §5: daily per-child cap plus a hard monthly
 * total cap, so live AI can never exceed the owner's budget. When the cap is reached the
 * mentor falls back to pre-written hints (AI_SPEC.md §13).
 */

export interface BudgetLimits {
  /** Hard daily cap per child, in tokens. */
  readonly dailyTokensPerChild: number;
  /** Hard monthly cap across all children, in tokens. */
  readonly monthlyTokensTotal: number;
}

export interface Clock {
  now(): number;
}

export const systemClock: Clock = { now: () => Date.now() };

function dayKey(ms: number): string {
  const d = new Date(ms);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

function monthKey(ms: number): string {
  const d = new Date(ms);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function createBudgetGuard(
  limits: BudgetLimits,
  clock: Clock = systemClock,
): BudgetGuard {
  if (!(limits.dailyTokensPerChild > 0)) {
    throw new Error("dailyTokensPerChild must be positive");
  }
  if (!(limits.monthlyTokensTotal > 0)) {
    throw new Error("monthlyTokensTotal must be positive");
  }

  /** `${childId}|${dayKey}` → tokens used that day. */
  const daily = new Map<string, number>();
  /** `${monthKey}` → tokens used that month (all children). */
  const monthly = new Map<string, number>();

  const usedToday = (childId: string): number =>
    daily.get(`${childId}|${dayKey(clock.now())}`) ?? 0;
  const usedThisMonth = (): number => monthly.get(monthKey(clock.now())) ?? 0;

  return {
    canSpend(estimatedTokens: number, scope: BudgetScope): boolean {
      if (!(estimatedTokens >= 0)) throw new Error("estimatedTokens must be >= 0");
      return (
        usedToday(scope.childId) + estimatedTokens <= limits.dailyTokensPerChild &&
        usedThisMonth() + estimatedTokens <= limits.monthlyTokensTotal
      );
    },
    record(usage: AIUsage, scope: BudgetScope): void {
      const total = usage.inputTokens + usage.outputTokens;
      if (total < 0) throw new Error("usage must not be negative");
      const dKey = `${scope.childId}|${dayKey(clock.now())}`;
      const mKey = monthKey(clock.now());
      daily.set(dKey, (daily.get(dKey) ?? 0) + total);
      monthly.set(mKey, (monthly.get(mKey) ?? 0) + total);
    },
  };
}
