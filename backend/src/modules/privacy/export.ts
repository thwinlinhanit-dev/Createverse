/**
 * P1-12 privacy module — export (DATA_MODEL §7).
 *
 * "Export (per child): one archive containing `profile.json`,
 * `events.ndjson`, `portfolio.json`, `skills.json`, `concepts.json`,
 * `ai_messages.json` (if retained), and all artifact files."
 *
 * API_SPEC §5.10 splits the work: the paged HTTP endpoints
 * (`export/events`, `export/portfolio`) let the app assemble the archive on
 * the device, so request handlers stay light (§8: no archive building in a
 * handler). `buildChildArchive()` assembles the same §7 file set server-side
 * for tests and the future admin CLI (ARCHITECTURE §repo layout: export
 * tools, CLI first) — it returns a deterministic file list; ZIP packaging is
 * the client's job (master spec §5.6).
 *
 * `ai_messages.json` is omitted because Phase 1 retains no AI messages
 * (AI_SPEC §12: no `ai_messages` rows exist until a provider is approved) —
 * §7 says "if retained". Skills and concepts are derived by replaying the
 * event log (DATA_MODEL §4: events are the source of truth), the same pure
 * replay the overview endpoint and the app use.
 */
import { asc, eq } from "drizzle-orm";
import { replayEvidence } from "@createverse/learning-core";
import type { ReplayAssessment } from "@createverse/learning-core";
import type { Db } from "../../db/index.ts";
import {
  artifacts,
  childSettings,
  children,
  portfolioEntries,
  progressEvents,
} from "../../db/schema.ts";
import { readArtifactFile } from "../artifacts/fileStore.ts";

/** One file of the export archive (DATA_MODEL §7). */
export interface ArchiveFile {
  path: string;
  bytes: Buffer;
}

export interface ArchiveOptions {
  /** Clock for evidence decay (injected so tests are deterministic). */
  nowMs?: number;
  /** Content inputs for the replay (same shapes as the overview endpoint). */
  levelsBySkill?: Readonly<Record<string, number>>;
  assessments?: readonly ReplayAssessment[];
}

/** `profile.json` — the profile plus its settings; never credential material. */
export interface ChildProfileExport {
  id: string;
  family_id: string;
  display_name: string;
  stage: string;
  locale: string;
  ui_preset: string;
  avatar_key: string | null;
  birth_year: number | null;
  created_at: string;
  deleted_at: string | null;
  has_pin: boolean;
  settings: {
    daily_minutes_limit: number | null;
    quiet_hours: unknown;
    ai_mentor_enabled: boolean;
    read_aloud_enabled: boolean;
    project_approval_required: boolean;
    allowed_risk_class: string;
    updated_at: string;
  } | null;
}

export function childProfile(db: Db, childId: string): ChildProfileExport | null {
  const rows = db.select().from(children).where(eq(children.id, childId)).all();
  const row = rows[0];
  if (!row) return null;
  const settingsRows = db
    .select()
    .from(childSettings)
    .where(eq(childSettings.childId, childId))
    .all();
  const settings = settingsRows[0];
  return {
    id: row.id,
    family_id: row.familyId,
    display_name: row.displayName,
    stage: row.stage,
    locale: row.locale,
    ui_preset: row.uiPreset,
    avatar_key: row.avatarKey,
    birth_year: row.birthYear,
    created_at: row.createdAt,
    deleted_at: row.deletedAt,
    // PIN material (hash, lockout counters) is auth state, not export data.
    has_pin: row.pinHash !== null,
    settings: settings
      ? {
          daily_minutes_limit: settings.dailyMinutesLimit,
          quiet_hours: settings.quietHours,
          ai_mentor_enabled: settings.aiMentorEnabled === 1,
          read_aloud_enabled: settings.readAloudEnabled === 1,
          project_approval_required: settings.projectApprovalRequired === 1,
          allowed_risk_class: settings.allowedRiskClass,
          updated_at: settings.updatedAt,
        }
      : null,
  };
}

/** One event in the export shape (same fields as `GET …/export/events`). */
export interface EventExportRow {
  event_id: string;
  child_id: string;
  device_id: string;
  type: string;
  schema_version: number;
  occurred_at: string;
  received_at: string;
  content_id: string | null;
  content_version: number | null;
  payload: unknown;
}

/** All events in keyset order — the full `events.ndjson` content. */
export function childEvents(db: Db, childId: string): EventExportRow[] {
  return db
    .select()
    .from(progressEvents)
    .where(eq(progressEvents.childId, childId))
    .orderBy(asc(progressEvents.occurredAt), asc(progressEvents.eventId))
    .all()
    .map((row) => ({
      event_id: row.eventId,
      child_id: row.childId,
      device_id: row.deviceId,
      type: row.type,
      schema_version: row.schemaVersion,
      occurred_at: row.occurredAt,
      received_at: row.receivedAt,
      content_id: row.contentId,
      content_version: row.contentVersion,
      payload: row.payload,
    }));
}

/** All portfolio entries and all artifacts of one child (invariant 4). */
export function childPortfolio(db: Db, childId: string): {
  entries: (typeof portfolioEntries.$inferSelect)[];
  artifacts: (typeof artifacts.$inferSelect)[];
} {
  const entries = db
    .select()
    .from(portfolioEntries)
    .where(eq(portfolioEntries.childId, childId))
    .orderBy(asc(portfolioEntries.createdAt), asc(portfolioEntries.id))
    .all();
  const artifactRows = db
    .select()
    .from(artifacts)
    .where(eq(artifacts.childId, childId))
    .orderBy(asc(artifacts.createdAt), asc(artifacts.id))
    .all();
  return { entries, artifacts: artifactRows };
}

function pretty(value: unknown): Buffer {
  return Buffer.from(`${JSON.stringify(value, null, 2)}\n`, "utf8");
}

/**
 * Builds the DATA_MODEL §7 archive file list for one child. Throws when the
 * child does not exist — callers (tests, CLI) resolve the profile first.
 * Artifact files that are already missing on disk are skipped (the row set
 * still lists them in `portfolio.json` so the loss is visible, not silent).
 */
export function buildChildArchive(
  db: Db,
  childId: string,
  artifactDir: string,
  options: ArchiveOptions = {},
): ArchiveFile[] {
  const profile = childProfile(db, childId);
  if (!profile) throw new Error(`child not found: ${childId}`);
  const events = childEvents(db, childId);
  const { entries, artifacts: artifactRows } = childPortfolio(db, childId);

  const files: ArchiveFile[] = [{ path: "profile.json", bytes: pretty(profile) }];

  const ndjson = events.map((event) => JSON.stringify(event)).join("\n");
  files.push({
    path: "events.ndjson",
    bytes: Buffer.from(events.length > 0 ? `${ndjson}\n` : "", "utf8"),
  });

  files.push({
    path: "portfolio.json",
    bytes: pretty({
      child_id: childId,
      entries: entries.map((entry) => ({
        id: entry.id,
        artifact_id: entry.artifactId,
        title: entry.title,
        stage_at_creation: entry.stageAtCreation,
        skills: entry.skills,
        concepts: entry.concepts,
        what_i_learned: entry.whatILearned,
        what_i_would_improve: entry.whatIWouldImprove,
        created_at: entry.createdAt,
      })),
      artifacts: artifactRows.map((artifact) => ({
        id: artifact.id,
        kind: artifact.kind,
        mime: artifact.mime,
        size_bytes: artifact.sizeBytes,
        storage_key: artifact.storageKey,
        created_at: artifact.createdAt,
      })),
    }),
  });

  const replay = replayEvidence(
    events.map((event) => ({
      type: event.type,
      occurred_at: event.occurred_at,
      payload: (event.payload ?? {}) as Readonly<Record<string, unknown>>,
    })),
    {
      nowMs: options.nowMs ?? Date.now(),
      ...(options.levelsBySkill ? { levelsBySkill: options.levelsBySkill } : {}),
      ...(options.assessments ? { assessments: options.assessments } : {}),
    },
  );
  files.push({ path: "skills.json", bytes: pretty(replay.skills) });
  files.push({ path: "concepts.json", bytes: pretty(replay.concepts) });
  // ai_messages.json intentionally absent: Phase 1 retains no AI messages.

  for (const artifact of artifactRows) {
    const bytes = readArtifactFile(artifactDir, artifact.storageKey);
    if (bytes) files.push({ path: `artifacts/${artifact.storageKey}`, bytes });
  }
  return files;
}
