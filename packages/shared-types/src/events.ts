import { z } from "zod";
import { ContentIdSchema, VersionSchema } from "./graph.ts";

/**
 * Progress events — the append-only source of truth for learning history.
 * Source: DATA_MODEL.md §3 (`progress_events` table) and §5 (derivations by replay).
 * Client-generated UUIDv7 `event_id` makes sync idempotent (ARCHITECTURE.md §6).
 */

const UuidLikeSchema = z
  .string()
  .regex(
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    "must be a UUID (v7 preferred)",
  );

/**
 * Minimum event type set from CREATEVERSE_BUILD_PLAN.md §3.
 * New types are additive; never rename or remove an existing type.
 */
export const KNOWN_EVENT_TYPES = [
  "child.project.started",
  "child.project.completed",
  "child.activity.completed",
  "child.experiment.executed",
] as const;

export const ProgressEventSchema = z.object({
  event_id: UuidLikeSchema,
  child_id: z.string().min(1),
  device_id: z.string().min(1),
  type: z.string().min(1),
  schema_version: z.number().int().positive(),
  occurred_at: z.iso.datetime(),
  received_at: z.iso.datetime(),
  content_id: ContentIdSchema.optional(),
  content_version: VersionSchema.optional(),
  payload: z.record(z.string(), z.unknown()).default({}),
});
export type ProgressEvent = z.infer<typeof ProgressEventSchema>;
