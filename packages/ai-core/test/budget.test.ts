import { describe, expect, it } from "vitest";
import { createBudgetGuard, type Clock } from "../src/index.ts";

function fixedClock(startMs: number): Clock & { set(ms: number): void } {
  let now = startMs;
  return {
    now: () => now,
    set(ms: number) {
      now = ms;
    },
  };
}

const JANUARY = Date.UTC(2026, 0, 15, 12, 0, 0);
const NEXT_DAY = JANUARY + 86_400_000;
const NEXT_MONTH = Date.UTC(2026, 1, 15, 12, 0, 0);
const NEXT_YEAR = Date.UTC(2027, 0, 15, 12, 0, 0);

describe("createBudgetGuard", () => {
  it("rejects invalid limits", () => {
    expect(() =>
      createBudgetGuard({ dailyTokensPerChild: 0, monthlyTokensTotal: 100 }),
    ).toThrow();
    expect(() =>
      createBudgetGuard({ dailyTokensPerChild: 100, monthlyTokensTotal: -1 }),
    ).toThrow();
  });

  it("caps spend per child per day", () => {
    const clock = fixedClock(JANUARY);
    const guard = createBudgetGuard(
      { dailyTokensPerChild: 100, monthlyTokensTotal: 10_000 },
      clock,
    );
    expect(guard.canSpend(100, { childId: "c_a" })).toBe(true);
    guard.record({ inputTokens: 60, outputTokens: 40 }, { childId: "c_a" });
    expect(guard.canSpend(1, { childId: "c_a" })).toBe(false);
    // Another child is unaffected by the first child's daily usage.
    expect(guard.canSpend(100, { childId: "c_b" })).toBe(true);
  });

  it("caps total spend across all children per month", () => {
    const clock = fixedClock(JANUARY);
    const guard = createBudgetGuard(
      { dailyTokensPerChild: 1_000, monthlyTokensTotal: 150 },
      clock,
    );
    guard.record({ inputTokens: 100, outputTokens: 50 }, { childId: "c_a" });
    expect(guard.canSpend(1, { childId: "c_b" })).toBe(false);
  });

  it("resets the daily cap on a new day", () => {
    const clock = fixedClock(JANUARY);
    const guard = createBudgetGuard(
      { dailyTokensPerChild: 100, monthlyTokensTotal: 10_000 },
      clock,
    );
    guard.record({ inputTokens: 100, outputTokens: 0 }, { childId: "c_a" });
    expect(guard.canSpend(1, { childId: "c_a" })).toBe(false);
    clock.set(NEXT_DAY);
    expect(guard.canSpend(1, { childId: "c_a" })).toBe(true);
  });

  it("resets the monthly cap on a new month", () => {
    const clock = fixedClock(JANUARY);
    const guard = createBudgetGuard(
      { dailyTokensPerChild: 100, monthlyTokensTotal: 100 },
      clock,
    );
    guard.record({ inputTokens: 100, outputTokens: 0 }, { childId: "c_a" });
    expect(guard.canSpend(1, { childId: "c_b" })).toBe(false);
    clock.set(NEXT_MONTH);
    expect(guard.canSpend(1, { childId: "c_b" })).toBe(true);
  });

  it("does not carry daily usage across months or years incorrectly", () => {
    const clock = fixedClock(JANUARY);
    const guard = createBudgetGuard(
      { dailyTokensPerChild: 100, monthlyTokensTotal: 10_000 },
      clock,
    );
    guard.record({ inputTokens: 100, outputTokens: 0 }, { childId: "c_a" });
    clock.set(NEXT_YEAR);
    expect(guard.canSpend(100, { childId: "c_a" })).toBe(true);
  });

  it("rejects negative estimates instead of silently allowing them", () => {
    const guard = createBudgetGuard({
      dailyTokensPerChild: 100,
      monthlyTokensTotal: 100,
    });
    expect(() => guard.canSpend(-1, { childId: "c_a" })).toThrow();
  });
});
