import { z } from "zod";

/**
 * Primitive enums and shared value schemas.
 * Sources: PRODUCT_SPEC.md §2, ARCHITECTURE.md §12, DATA_MODEL.md §2.7, SAFETY.md §3.
 */

export const STAGES = ["junior", "explorer", "maker"] as const;
export const StageSchema = z.enum(STAGES);
export type Stage = z.infer<typeof StageSchema>;

/** Stages that must exist as a lane in every project (DATA_MODEL.md §2.7). */
export const CONFIGURED_STAGES = STAGES;

export const LOCALES = ["en", "zh-Hant"] as const;
export const LocaleSchema = z.enum(LOCALES);
export type Locale = z.infer<typeof LocaleSchema>;

export const RiskClassSchema = z.enum(["low", "medium", "high"]);
export type RiskClass = z.infer<typeof RiskClassSchema>;

export const HintTypeSchema = z.enum([
  "ask",
  "hint",
  "smaller_hint",
  "demonstrate",
  "explain",
  "solution",
]);
export type HintType = z.infer<typeof HintTypeSchema>;

export const StepTypeSchema = z.enum([
  "intro",
  "learn",
  "activity",
  "experiment",
  "challenge",
  "reflection",
]);
export type StepType = z.infer<typeof StepTypeSchema>;

/** SAFETY.md §13: content reaches the child only after owner + native-speaker review. */
export const ContentStatusSchema = z.enum(["draft", "reviewed", "approved"]);
export type ContentStatus = z.infer<typeof ContentStatusSchema>;

/** DATA_MODEL.md §5: concept level is 0 (unseen) to 4 (explained). */
export const ConceptLevelSchema = z.number().int().min(0).max(4);
export const CONCEPT_MAX_LEVEL = 4;

/** DATA_MODEL.md §3: children.stage may later include creator, inventor, researcher. */
export const AllStagesSchema = z.enum([
  "junior",
  "explorer",
  "maker",
  "creator",
  "inventor",
  "researcher",
]);
export type AllStage = z.infer<typeof AllStagesSchema>;
