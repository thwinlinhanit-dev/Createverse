import { z } from "zod";
import { ContentStatusSchema, HintTypeSchema, StepTypeSchema } from "./enums.ts";
import { ContentIdSchema, MessageKeySchema, VersionSchema } from "./graph.ts";

/**
 * Learning content entities: hint ladder, step, assessment.
 * Sources: DATA_MODEL.md §2.3 (step), §2.4 (hint ladder), §2.5 (assessment), §2.7 (rules).
 */

// ---------------------------------------------------------------------------
// Hint ladder — the offline-safe mentor (DATA_MODEL.md §2.4)
// ---------------------------------------------------------------------------

export const HintLevelSchema = z.object({
  level: z.number().int().min(1),
  type: HintTypeSchema,
  text_key: MessageKeySchema,
});
export type HintLevel = z.infer<typeof HintLevelSchema>;

export const HintLadderSchema = z
  .object({
    id: ContentIdSchema,
    version: VersionSchema,
    /** Attempts required before a `solution` level may be offered (TESTING.md §3). */
    solution_allowed_after: z.number().int().min(0).default(3),
    /** DATA_MODEL.md §2.7: at least levels 1 to 4, strictly sequential. */
    levels: z.array(HintLevelSchema).min(4),
    status: ContentStatusSchema.default("draft"),
  })
  .superRefine((ladder, ctx) => {
    ladder.levels.forEach((entry, index) => {
      const expected = index + 1;
      if (entry.level !== expected) {
        ctx.addIssue({
          code: "custom",
          message: `levels must be sequential starting at 1 (expected ${expected}, got ${entry.level})`,
          path: ["levels", index, "level"],
        });
      }
    });
  });
export type HintLadder = z.infer<typeof HintLadderSchema>;

// ---------------------------------------------------------------------------
// Step / activity (content/activities) — DATA_MODEL.md §2.3
// ---------------------------------------------------------------------------

export const StepSchema = z.object({
  id: ContentIdSchema,
  version: VersionSchema,
  type: StepTypeSchema,
  status: ContentStatusSchema.default("draft"),
  prompt_key: MessageKeySchema,
  audio_key: MessageKeySchema.optional(),
  concepts: z.array(ContentIdSchema).default([]),
  skills: z.array(ContentIdSchema).default([]),
  experience_ref: ContentIdSchema.optional(),
  hint_ladder: ContentIdSchema.optional(),
  assessment: ContentIdSchema.optional(),
  extensions: z.array(z.unknown()).default([]),
  parent_notes_key: MessageKeySchema.optional(),
});
export type Step = z.infer<typeof StepSchema>;

// ---------------------------------------------------------------------------
// Assessment (content/assessments) — DATA_MODEL.md §2.5
// ---------------------------------------------------------------------------

export const EvidenceSignalSchema = z
  .object({
    signal: z.string().min(1),
    skill: ContentIdSchema.optional(),
    concept: ContentIdSchema.optional(),
    strength: z.number().min(0).max(1),
  })
  .refine((entry) => entry.skill !== undefined || entry.concept !== undefined, {
    message: "evidence signal must reference a skill or a concept",
  });
export type EvidenceSignal = z.infer<typeof EvidenceSignalSchema>;

export const AssessmentSchema = z.object({
  id: ContentIdSchema,
  version: VersionSchema,
  evidence: z.array(EvidenceSignalSchema).min(1),
  mastery_rule: z.string().min(1),
});
export type Assessment = z.infer<typeof AssessmentSchema>;
