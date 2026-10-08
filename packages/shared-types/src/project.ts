import { z } from "zod";
import { ContentStatusSchema, RiskClassSchema, StageSchema } from "./enums.ts";
import { AgeRangeSchema, ContentIdSchema, MessageKeySchema, VersionSchema } from "./graph.ts";

/**
 * Experience spec and project entities.
 * Sources: DATA_MODEL.md §2.2 (project), §2.6 (experience spec), §2.7 (rules);
 * EXPERIENCE_RUNTIME.md §3 (spec fields); SAFETY.md §3 (risk classes).
 */

// ---------------------------------------------------------------------------
// Experience spec (content/experiences)
// ---------------------------------------------------------------------------

export const ExperienceUiSchema = z
  .object({
    read_aloud: z.boolean().default(true),
    no_text_required: z.boolean().default(false),
    large_targets: z.boolean().default(false),
    force_view: z.boolean().default(false),
    test_log: z.boolean().default(false),
  })
  .default(() => ({
    read_aloud: true,
    no_text_required: false,
    large_targets: false,
    force_view: false,
    test_log: false,
  }));

/**
 * Per-step overrides (EXPERIENCE_RUNTIME.md §4). Override wins over the spec.
 * Unknown keys are a validation error (strictObject).
 */
export const StepOverrideSchema = z.strictObject({
  preset: z.string().min(1).optional(),
  build_enabled: z.boolean().optional(),
  vehicle: z.string().min(1).optional(),
  vehicles: z.array(z.string().min(1)).optional(),
  max_pieces: z.number().int().positive().optional(),
  budget: z.number().min(0).optional(),
  pieces: z.array(z.string().min(1)).optional(),
  force_view: z.boolean().optional(),
  bonus_vehicle: z.string().min(1).optional(),
});
export type StepOverride = z.infer<typeof StepOverrideSchema>;

/**
 * Experience constraints. The first two fields are generic (DATA_MODEL.md §2.6);
 * the rest feed the bridge domain (EXPERIENCE_RUNTIME.md §5) and are optional so
 * other domains can define their own constraint sets later.
 */
export const ExperienceConstraintsSchema = z.object({
  max_pieces: z.number().int().positive(),
  budget: z.number().min(0),
  /** Bridge: gap width in grid units (world: 1 unit = 1 grid cell). */
  gap_width: z.number().positive().optional(),
  /** Allowed piece types; the domain default set applies when absent. */
  piece_types: z.array(z.string().min(1)).optional(),
  /** Materials: cost per unit length and strength multiplier. */
  materials: z
    .record(
      z.string(),
      z.object({
        cost: z.number().min(0),
        strength: z.number().positive(),
      }),
    )
    .optional(),
  /** Vehicle ids; the domain default set applies when absent. */
  vehicles: z.array(z.string().min(1)).optional(),
});

export const ExperienceSpecSchema = z.object({
  experience_id: ContentIdSchema,
  version: VersionSchema,
  stage: StageSchema,
  age_range: AgeRangeSchema,
  difficulty: z.number().int().min(1).max(5),
  learning_objectives: z.array(ContentIdSchema).default([]),
  mission: z.object({
    title_key: MessageKeySchema,
    objective_key: MessageKeySchema,
  }),
  seed: z.number().int().default(0),
  variables: z.record(z.string(), z.number()).default({}),
  constraints: ExperienceConstraintsSchema,
  ui: ExperienceUiSchema,
  assessment: z.object({
    success_conditions: z.array(z.string().min(1)).min(1),
  }),
  telemetry: z.array(z.string().min(1)).default([]),
  /** Per-step overrides keyed by step id; unknown keys are a validation error. */
  step_overrides: z.record(z.string(), StepOverrideSchema).optional(),
});
export type ExperienceSpec = z.infer<typeof ExperienceSpecSchema>;

// ---------------------------------------------------------------------------
// Project (content/projects) — DATA_MODEL.md §2.2
// ---------------------------------------------------------------------------

export const LaneSchema = z.object({
  age_range: AgeRangeSchema,
  steps: z.array(ContentIdSchema).min(1),
  experience: ContentIdSchema,
});
export type Lane = z.infer<typeof LaneSchema>;

export const ProjectSchema = z.object({
  id: ContentIdSchema,
  version: VersionSchema,
  status: ContentStatusSchema.default("draft"),
  title_key: MessageKeySchema,
  story_key: MessageKeySchema,
  mission_key: MessageKeySchema,
  interests: z.array(ContentIdSchema).default([]),
  /** DATA_MODEL.md §2.7: a lane for every configured stage. */
  lanes: z.object({
    junior: LaneSchema,
    explorer: LaneSchema,
    maker: LaneSchema,
  }),
  learning_objectives: z.array(ContentIdSchema).default([]),
  required_skills: z.array(ContentIdSchema).default([]),
  materials: z.array(z.unknown()).default([]),
  reflection_prompts: z.array(MessageKeySchema).default([]),
  portfolio_artifact: z.object({ kind: z.string().min(1) }),
  safety: z.object({
    /** SAFETY.md §3: `high` is blocked for children and must fail validation. */
    risk_class: RiskClassSchema,
    notes_key: MessageKeySchema,
  }),
});
export type Project = z.infer<typeof ProjectSchema>;
