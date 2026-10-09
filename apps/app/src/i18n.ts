import { useMemo } from "react";
import {
  createTranslator,
  type Locale,
  type MessageKey,
  type Translator,
} from "@createverse/i18n";
import { useApp } from "./AppContext";

/**
 * App-side binding for packages/i18n (ADR-0008, task P1-02).
 *
 * The translator is bound to the language on the child's profile — the only
 * locale source in the app (no Accept-Language sniffing, API_SPEC §1). Every
 * component calls `const t = useT()` and renders `t("key")`; raw UI strings
 * are blocked by the `cv/no-raw-text` ESLint rule.
 */

/** Stage values the shell knows (child profile + the parent stand-in). */
export type ShellStage = "junior" | "explorer" | "maker" | "parent";

const STAGE_KEYS: Record<ShellStage, MessageKey> = {
  junior: "stage.junior",
  explorer: "stage.explorer",
  maker: "stage.maker",
  parent: "stage.parent",
};

const STAGE_AGE_KEYS: Record<ShellStage, MessageKey> = {
  junior: "stageAge.junior",
  explorer: "stageAge.explorer",
  maker: "stageAge.maker",
  parent: "stageAge.parent",
};

/** Catalog key for a stage's short label (nav chips, "About me"). */
export function stageKey(stage: ShellStage): MessageKey {
  return STAGE_KEYS[stage];
}

/** Catalog key for a stage label with its age range (parent-facing copy). */
export function stageAgeKey(stage: ShellStage): MessageKey {
  return STAGE_AGE_KEYS[stage];
}

/** Translator bound to the current child-profile language (+ simple mode). */
export function useT(): Translator {
  const { profile } = useApp();
  const locale = profile.language satisfies Locale;
  // Simple-language mode (DESIGN_SYSTEM §8, P1-13): the profile flag switches
  // every t(key) call to the shorter `<key>.simple` variant when the catalogs
  // ship one — the hook for shorter text in any stage preset.
  const simple = profile.simpleLanguage;
  return useMemo(() => createTranslator(locale, undefined, { simple }), [locale, simple]);
}
