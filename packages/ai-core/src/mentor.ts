import type {
  AIProvider,
  BudgetGuard,
  HelpContext,
  HelpResult,
  HintSource,
  InputVerdict,
  OutputVerdict,
  SafetyLayer,
  SafetyStatus,
} from "./types.ts";

/**
 * MentorService — AI_SPEC.md §3:
 *   1. pre-written hint ladder (content)  → default, free, offline
 *   2. response cache                     → added in P1-07 (no personal data)
 *   3. live AI                            → only if allowed, capped and safe
 *   4. fallback                           → next pre-written hint or "ask a grown-up"
 *
 * SAFETY.md §7 / decision 2: Junior has no live AI chat.
 * Errors, timeouts and uncertainty always fall back — never blocking the learning flow
 * (AI_SPEC.md §13). The child is never shown an error.
 */

export interface MentorSettings {
  /** Parent switch (`child_settings.ai_mentor_enabled`). Default: off. */
  readonly liveAiEnabled?: boolean;
  /** SECURITY.md kill switch: turns live AI off instantly. */
  readonly killSwitch?: boolean;
  /** Estimated tokens for one live call (budget pre-check). Default 500. */
  readonly maxLiveTokens?: number;
}

export interface MentorOptions {
  readonly hints: HintSource;
  readonly safety: SafetyLayer;
  readonly provider?: AIProvider;
  readonly budget?: BudgetGuard;
  readonly settings?: MentorSettings;
}

export const DEFAULT_LIVE_ESTIMATE_TOKENS = 500;
export const FALLBACK_TEXT_KEY = "safety.ask_grownup";

function mapInputVerdict(verdict: InputVerdict): {
  safety: SafetyStatus;
  textKey: string;
} {
  switch (verdict) {
    case "redirect":
      return { safety: "redirected", textKey: "safety.cant_help_that" };
    case "block":
      return { safety: "blocked", textKey: "safety.cant_help_that" };
    case "personal_info":
      return { safety: "blocked", textKey: "safety.private_info" };
    case "distress":
      return { safety: "distress", textKey: "safety.tell_grownup_now" };
    case "ok":
      return { safety: "ok", textKey: FALLBACK_TEXT_KEY };
  }
}

function mapOutputVerdict(verdict: OutputVerdict): SafetyStatus {
  return verdict === "unsafe" || verdict === "leaks_answer" ? "blocked" : "redirected";
}

function systemPromptFor(ctx: HelpContext): string {
  return [
    "You are a learning mentor for a child. Guide thinking; never do the child's work.",
    `Stage: ${ctx.stage}. Reply in: ${ctx.locale}. Current step: ${ctx.stepId}.`,
    "Order: ask, hint, smaller hint, demonstrate, explain. Never give the final solution early.",
    "Never keep secrets, never pretend to be a friend, never give medical, legal or emergency advice.",
    "If something could be unsafe, suggest asking a grown-up.",
  ].join(" ");
}

export class MentorService {
  private readonly hints: HintSource;
  private readonly safety: SafetyLayer;
  private readonly provider?: AIProvider;
  private readonly budget?: BudgetGuard;
  private readonly settings: MentorSettings;

  constructor(options: MentorOptions) {
    this.hints = options.hints;
    this.safety = options.safety;
    this.provider = options.provider;
    this.budget = options.budget;
    this.settings = options.settings ?? {};
  }

  async getHelp(ctx: HelpContext): Promise<HelpResult> {
    if (ctx.message !== undefined && this.canGoLive(ctx)) {
      const verdict = await this.safety.checkInput(ctx.message, ctx);
      if (verdict !== "ok") {
        const mapped = mapInputVerdict(verdict);
        return { source: "fallback", safety: mapped.safety, textKey: mapped.textKey };
      }

      try {
        const response = await this.provider!.complete({
          systemPrompt: systemPromptFor(ctx),
          userText: ctx.message,
          stage: ctx.stage,
          locale: ctx.locale,
          maxTokens: this.settings.maxLiveTokens ?? DEFAULT_LIVE_ESTIMATE_TOKENS,
        });

        const outputVerdict = await this.safety.checkOutput(response.text, ctx);
        if (outputVerdict !== "ok") {
          // Discard the output, serve the next pre-written hint (AI_SPEC.md §13).
          return this.hintOrFallback(ctx, mapOutputVerdict(outputVerdict));
        }

        this.budget?.record(response.usage, { childId: ctx.childId });
        return { source: "live", safety: "ok", text: response.text };
      } catch {
        // Provider error or timeout: next pre-written hint, silently (AI_SPEC.md §13).
        return this.hintOrFallback(ctx, "ok");
      }
    }

    return this.hintOrFallback(ctx, "ok");
  }

  private canGoLive(ctx: HelpContext): boolean {
    if (!this.provider) return false;
    if (this.settings.killSwitch === true) return false;
    if (this.settings.liveAiEnabled !== true) return false;
    if (ctx.stage === "junior") return false; // SAFETY.md §13 decision 2
    const estimate = this.settings.maxLiveTokens ?? DEFAULT_LIVE_ESTIMATE_TOKENS;
    if (this.budget && !this.budget.canSpend(estimate, { childId: ctx.childId })) {
      return false;
    }
    return true;
  }

  private async hintOrFallback(
    ctx: HelpContext,
    safety: SafetyStatus,
  ): Promise<HelpResult> {
    const hint = await this.hints.next(ctx);
    if (hint) {
      return {
        source: "precomputed",
        safety,
        textKey: hint.textKey,
        hintLevel: hint.level,
      };
    }
    return { source: "fallback", safety, textKey: FALLBACK_TEXT_KEY };
  }
}
