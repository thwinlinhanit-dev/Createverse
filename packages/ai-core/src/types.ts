import type { Locale, Stage } from "@createverse/shared-types";

/**
 * AI mentor interfaces.
 * Source: AI_SPEC.md §3 (components and interfaces), SAFETY.md §2 (pipeline).
 * Everything here is optional by design: with no provider configured, the mentor
 * serves pre-written hint ladders and the app stays fully usable (ADR-0005).
 */

export type MaybePromise<T> = T | Promise<T>;

export interface Turn {
  readonly role: "child" | "mentor";
  readonly text: string;
}

export interface HelpContext {
  /** Internal only — never sent to an AI provider (DATA_MODEL.md §6). */
  readonly childId: string;
  readonly stage: Stage;
  readonly locale: Locale;
  readonly stepId: string;
  /** Hint levels already shown. 0 = none used yet. */
  readonly hintLevelReached: number;
  /** Attempts on the current step (feeds the solution gate). */
  readonly attemptCount?: number;
  /** The child's free-text question, if any. Treated as untrusted data (SECURITY.md T6). */
  readonly message?: string;
  /** Short, capped history. */
  readonly recentTurns?: readonly Turn[];
}

export type HelpSource = "precomputed" | "cache" | "live" | "fallback";
export type SafetyStatus = "ok" | "redirected" | "blocked" | "distress";

export interface HelpResult {
  readonly text?: string;
  readonly textKey?: string;
  readonly hintLevel?: number;
  readonly source: HelpSource;
  readonly safety: SafetyStatus;
}

export interface HintEntryView {
  readonly level: number;
  readonly textKey: string;
}

/** Serves pre-written hint ladders (content). The default, free, offline path. */
export interface HintSource {
  next(ctx: HelpContext): MaybePromise<HintEntryView | null>;
}

export interface AIRequest {
  readonly systemPrompt: string;
  readonly userText: string;
  readonly stage: Stage;
  readonly locale: Locale;
  readonly maxTokens: number;
}

export interface AIUsage {
  readonly inputTokens: number;
  readonly outputTokens: number;
}

export interface AIResponse {
  readonly text: string;
  readonly usage: AIUsage;
}

export interface AIProvider {
  readonly id: string;
  complete(req: AIRequest): Promise<AIResponse>;
}

export interface BudgetScope {
  readonly childId: string;
}

/** Budget rules: CREATEVERSE_BUILD_PLAN.md §5 (daily per-child + monthly hard caps). */
export interface BudgetGuard {
  canSpend(estimatedTokens: number, scope: BudgetScope): boolean;
  record(usage: AIUsage, scope: BudgetScope): void;
}

/**
 * `secrets` = asks the mentor to keep something from a parent (SAFETY.md §10 case 6):
 * decline and point to a grown-up; never agree to keep secrets (§5).
 */
export type InputVerdict =
  | "ok"
  | "redirect"
  | "block"
  | "distress"
  | "personal_info"
  | "secrets";
export type OutputVerdict = "ok" | "unsafe" | "off_topic" | "too_hard" | "leaks_answer";

/** SAFETY.md §2: behind an interface so rules, models, or both can be used. */
export interface SafetyLayer {
  checkInput(text: string, ctx: HelpContext): MaybePromise<InputVerdict>;
  checkOutput(text: string, ctx: HelpContext): MaybePromise<OutputVerdict>;
}
