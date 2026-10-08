import { z } from "zod";
import { LocaleSchema, StageSchema } from "./enums.ts";
import { ConceptSchema, InterestSchema, SkillSchema } from "./graph.ts";
import { AssessmentSchema, HintLadderSchema, StepSchema } from "./learning.ts";
import { ExperienceSpecSchema, ProjectSchema } from "./project.ts";
import { BUNDLE_FORMAT, BUNDLE_SCHEMA_VERSION } from "./versions.ts";

/**
 * Compiled content bundle — one per (locale, stage).
 * Sources: ARCHITECTURE.md §7 (ADR-0007), DATA_MODEL.md §2.
 *
 * The compiler (`packages/content-sdk`) writes these files; the app (P1-04)
 * loads them at runtime and re-validates with this schema, so a corrupt or
 * stale bundle is rejected at load with a calm fallback instead of reaching
 * the child. The expected format/version live in `versions.ts` so the app
 * and the compiler cannot drift apart.
 */

export const ContentBundleSchema = z.object({
  format: z.literal(BUNDLE_FORMAT),
  schemaVersion: z.literal(BUNDLE_SCHEMA_VERSION),
  locale: LocaleSchema,
  stage: StageSchema,
  graph: z.object({
    concepts: z.array(ConceptSchema),
    skills: z.array(SkillSchema),
    interests: z.array(InterestSchema),
  }),
  projects: z.array(ProjectSchema),
  steps: z.array(StepSchema),
  ladders: z.array(HintLadderSchema),
  assessments: z.array(AssessmentSchema),
  experiences: z.array(ExperienceSpecSchema),
  messages: z.record(z.string(), z.string()),
});
export type ContentBundle = z.infer<typeof ContentBundleSchema>;
