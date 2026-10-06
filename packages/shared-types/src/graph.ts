import { z } from "zod";

/**
 * Content primitives and graph nodes.
 * Sources: DATA_MODEL.md §2.1 (graph), §2.7 (content rules).
 * Content lives in git as files under `content/`, never as database copies.
 */

/** Dotted lowercase id, e.g. `concept.load`, `step.bridge.e2`, `exp.bridge.j`. */
export const ContentIdSchema = z
  .string()
  .regex(
    /^[a-z][a-z0-9_]*(?:\.[a-z0-9_]+)+$/,
    "must be a dotted lowercase id like concept.load",
  );

/** Localization key, e.g. `project.bridge.title`, `hints.bridge.e2.1`. */
export const MessageKeySchema = z
  .string()
  .regex(
    /^[a-z0-9_]+(?:\.[a-z0-9_]+)+$/,
    "must be a dotted lowercase message key like project.bridge.title",
  );

export const VersionSchema = z.number().int().positive();

export const AgeRangeSchema = z
  .tuple([z.number().int().min(0).max(18), z.number().int().min(0).max(18)])
  .refine(([min, max]) => min <= max, {
    message: "age_range minimum must be <= maximum",
  });

// ---------------------------------------------------------------------------
// Graph nodes (content/graph/*.json)
// ---------------------------------------------------------------------------

export const ConceptSchema = z.object({
  id: ContentIdSchema,
  version: VersionSchema,
  name_key: MessageKeySchema,
  prerequisites: z.array(ContentIdSchema).default([]),
  tags: z.array(z.string().min(1)).default([]),
});
export type Concept = z.infer<typeof ConceptSchema>;

export const SkillSchema = z.object({
  id: ContentIdSchema,
  version: VersionSchema,
  name_key: MessageKeySchema,
  levels: z.number().int().min(1).max(10),
});
export type Skill = z.infer<typeof SkillSchema>;

export const InterestSchema = z.object({
  id: ContentIdSchema,
  version: VersionSchema,
  name_key: MessageKeySchema,
  parent: ContentIdSchema.nullable().default(null),
});
export type Interest = z.infer<typeof InterestSchema>;
