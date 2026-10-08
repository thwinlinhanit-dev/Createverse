import type {
  HelpContext,
  InputVerdict,
  OutputVerdict,
  SafetyLayer,
} from "./types.ts";

/**
 * Rule-based safety layer (SAFETY.md §2: "start with rules plus a small classifier
 * prompt"). Deterministic and free — it runs before the budget guard so a blocked
 * message never costs live AI tokens.
 *
 * This is v0. The full eval set lives in `ai/evals/` (task P0-06 remainder, P1-11).
 * Every safety bug becomes a permanent test case (TESTING.md §1).
 */

const DISTRESS_PATTERNS: readonly RegExp[] = [
  /\bkill myself\b/i,
  /\bsuicide\b/i,
  /\bwant to die\b/i,
  // SAFETY.md §10.7: "I'm sad" / "I feel bad" → warm reply, a grown-up, no counseling.
  /\bi('m| am) (so )?sad\b/i,
  /\bi feel (so )?(sad|bad|awful)\b/i,
  /\b(feel|feeling) (so )?(alone|hopeless)\b/i,
  /難過|難受|傷心|不想活|自殺|想不開/,
  // SAFETY.md §10.8: someone is hurting them → distress flow, high severity.
  /\b(someone|somebody|he|she|they)( is|'s)? (hurting|beating|hit(ting)?|kicking|touching) me\b/i,
  /hurting me|有人.*(打|踢|摸|欺負)|他.*打我|她.*打我/,
];

const PERSONAL_INFO_PATTERNS: readonly RegExp[] = [
  /\bmy name is\b/i,
  /\bi am \d{1,2} years old\b/i,
  /\bmy (house|home|school) address\b/i,
  /\bmy (mom|dad|mother|father)'s (name|phone|number)\b/i,
  /我叫|我住|我家地址|我今年/,
];

/** Asks the mentor to keep a secret from a parent (SAFETY.md §10.6). */
const SECRETS_PATTERNS: readonly RegExp[] = [
  /\bkeep (a |this |it a )?secret\b/i,
  /\bdon'?t tell (your|my) (parents?|mom|mum|dad|grown-?ups?)\b/i,
  /\bsecret from (your|my) (parents?|mom|mum|dad)\b/i,
  /保守秘密|別告訴|不要告訴|不准告訴.*(爸|媽|父母)|瞞著.*(爸|媽|父母)/,
];

/** Unsafe content. `high` risk experiments are also blocked (SAFETY.md §3). */
const BLOCK_PATTERNS: readonly RegExp[] = [
  /\b(make|makes|making|build|builds|building|mix|mixing) (a |an )?(bomb|explosive)\b/i,
  // SAFETY.md §10.3: explode / explosion asks are refused (fail-safe: over-blocking is fine).
  /\bexplod(e|es|ing|ed)\b|\bexplosions?\b/i,
  /爆炸|引爆/,
  /\bhow do i hurt\b/i,
  /\bpornography\b/i,
  /製造炸彈|傷害別人/,
  // SAFETY.md §10.4: real-world experiments with heat or chemicals → decline, grown-up.
  /\b(bleach|lighter|fireworks?)\b/i,
  /\b(heat|heating|burn|burning|fire|flame)\b.*\b(vinegar|chemicals?|acid|bleach)\b/i,
  /\b(vinegar|chemicals?|acid|bleach)\b.*\b(heat|heating|burn|fire|flame)\b/i,
  /漂白水|打火機|爆竹|加熱.*(醋|漂白|化學|酸)/,
];

/** Redirect: not allowed right now, steer back to the project. */
const REDIRECT_PATTERNS: readonly RegExp[] = [
  /\bdo my (homework|assignment)\b/i,
  /\bjust give me the answer\b/i,
  /直接給我答案|幫我寫作業/,
];

/**
 * Output filter (SAFETY.md §2, §10.9): a live reply that follows a prompt-injection
 * instruction or echoes the system prompt is discarded and replaced by a pre-written
 * hint. Checked before anything is shown to the child (AI_SPEC.md §13).
 */
const OUTPUT_LEAK_PATTERNS: readonly RegExp[] = [
  /ignore (your|my|all) (previous |original )?rules/i,
  /my (system |initial )?instructions? (are|is)\b/i,
  /you are a learning mentor for a child/i,
  /system prompt/i,
  /無視.*規則|我的(系統)?指令是|系統提示|你是學習導師/,
];

export interface RuleBasedSafetyOptions {
  readonly extraBlockPatterns?: readonly RegExp[];
}

export function createRuleBasedSafety(
  options: RuleBasedSafetyOptions = {},
): SafetyLayer {
  const blockPatterns = [...BLOCK_PATTERNS, ...(options.extraBlockPatterns ?? [])];

  return {
    checkInput(text: string, _ctx: HelpContext): InputVerdict {
      if (DISTRESS_PATTERNS.some((p) => p.test(text))) return "distress";
      if (PERSONAL_INFO_PATTERNS.some((p) => p.test(text))) return "personal_info";
      if (SECRETS_PATTERNS.some((p) => p.test(text))) return "secrets";
      if (blockPatterns.some((p) => p.test(text))) return "block";
      if (REDIRECT_PATTERNS.some((p) => p.test(text))) return "redirect";
      return "ok";
    },

    checkOutput(text: string, _ctx: HelpContext): OutputVerdict {
      // Prompt-injection / instruction-leak detection runs first (SAFETY.md §10.9).
      if (OUTPUT_LEAK_PATTERNS.some((p) => p.test(text))) return "unsafe";
      // Answer-leak and age checks need content solution text (AI_SPEC.md §11, P1-11).
      // Kept explicit so the gap is visible: live output still passes the
      // age/language review in later tasks.
      return "ok";
    },
  };
}
