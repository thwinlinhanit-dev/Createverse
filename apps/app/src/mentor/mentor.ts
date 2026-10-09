/**
 * App-side mentor wiring (P1-07).
 *
 * Builds a MentorService (AI_SPEC §3 stack) around content:
 *   1. pre-written hint ladder — content ladders via learning-core
 *      (stage-scoped bundles = age-aware tone offline),
 *   2. response cache (ai-core, no personal data),
 *   3. live AI — gated by the parent switch, kill switch, stage (never
 *      Junior) and budget — but **Phase 1 ships no provider at all**
 *      (ADR-0005, AGENTS.md: live AI needs owner approval),
 *   4. fallback — next pre-written hint or "ask a grown-up".
 *
 * The rule-based safety layer (SAFETY.md §2) wraps every request. The
 * `provider` / `budget` / `cache` options exist for tests only; production
 * callers pass just `stage` + `ladderFor`.
 */
import {
  MentorService,
  createBudgetGuard,
  createResponseCache,
  createRuleBasedSafety,
  type AIProvider,
  type BudgetGuard,
  type HelpContext,
  type ResponseCache,
} from "@createverse/ai-core";
import { getNextHint } from "@createverse/learning-core";
import type { HintLadder, Stage } from "@createverse/shared-types";
import {
  defaultMentorStorage,
  getLiveAiChoice,
  isKillSwitchOn,
  liveAiAllowsStage,
  type MentorStorage,
} from "./settings.ts";

export interface CreateMentorOptions {
  readonly stage: Stage;
  /** Resolves the step's content hint ladder (bundle lookup). */
  readonly ladderFor: (stepId: string) => HintLadder | undefined;
  readonly storage?: MentorStorage;
  /** Test-only: Phase 1 ships no provider (ADR-0005). */
  readonly provider?: AIProvider;
  /** Test-only: production shares the module budget below. */
  readonly budget?: BudgetGuard;
  /** Test-only: production shares the module response cache below. */
  readonly cache?: ResponseCache;
}

/**
 * AI_SPEC §7 example caps (daily per-child tokens; monthly hard cap across
 * children) until the owner confirms the real numbers — live AI is off, so
 * nothing can spend yet.
 */
export const MENTOR_BUDGET_LIMITS = {
  dailyTokensPerChild: 20_000,
  monthlyTokensTotal: 300_000,
} as const;

const sharedBudget = createBudgetGuard(MENTOR_BUDGET_LIMITS);
const sharedCache = createResponseCache();

/** Build a mentor for one request context (settings are read fresh each time). */
export function createMentor(options: CreateMentorOptions): MentorService {
  const storage = options.storage ?? defaultMentorStorage();
  const choice = getLiveAiChoice(storage);
  return new MentorService({
    hints: {
      next(ctx: HelpContext) {
        const ladder = options.ladderFor(ctx.stepId);
        if (!ladder) return null;
        const hint = getNextHint(ladder, {
          levelReached: ctx.hintLevelReached,
          attemptCount: ctx.attemptCount ?? 0,
        });
        return hint ? { level: hint.level, textKey: hint.text_key } : null;
      },
    },
    safety: createRuleBasedSafety(),
    ...(options.provider ? { provider: options.provider } : {}),
    budget: options.budget ?? sharedBudget,
    cache: options.cache ?? sharedCache,
    settings: {
      liveAiEnabled: liveAiAllowsStage(choice, options.stage),
      killSwitch: isKillSwitchOn(storage),
    },
  });
}
