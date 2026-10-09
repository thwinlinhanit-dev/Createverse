/**
 * P1-12 privacy module — the deletion workflow (DATA_MODEL §7).
 *
 * Flow per §7: parent confirms (API: `parent+fresh` step-up, API_SPEC §5.10 —
 * the family is passkey-first, SECURITY.md §16.1, so the step-up window is
 * the confirmation), soft delete via `children.deleted_at` hides the child
 * immediately, and after the grace period (default 14 days) a hard delete
 * cascades over events, derived rows, artifacts and files, AI messages
 * (none in Phase 1) and safety events — then an `audit_log` row without
 * personal content (ids/enums only, API_SPEC §7).
 *
 * Family deletion (DATA_MODEL §7 last line: "same flow for all children,
 * then users and devices") soft-deletes every child first; the parent
 * accounts, devices and the family row are removed by the same 14-day
 * grace pass once no child rows remain. The `family.delete` audit row is
 * the marker (no schema change: `audit_log` timestamps it) — child
 * creation and per-child cancel are refused while it stands.
 *
 * No schema change was needed: `children.deleted_at` has existed since
 * P1-01. Heavy cascade work runs in bounded batches (API_SPEC §5.10:
 * cascading deletes stay inside free-tier CPU limits) — at most
 * `maxChildren` children per pass, events deleted in 500-row batches.
 *
 * Media is unlinked BEFORE the row transaction: if a file cannot be
 * removed the purge aborts with every row intact (retryable), never the
 * other way round — an orphan file with no DB record would be an
 * untraceable privacy leak.
 */
import { and, asc, desc, eq, inArray, isNotNull, lte, or, sql } from "drizzle-orm";
import type { Db } from "../../db/index.ts";
import {
  artifacts,
  auditLog,
  authChallenges,
  childSettings,
  children,
  devices,
  families,
  passkeyCredentials,
  portfolioEntries,
  safetyEvents,
  sessions,
  users,
} from "../../db/schema.ts";
import { writeAudit } from "../identity/audit.ts";
import { deleteArtifactFile } from "../artifacts/fileStore.ts";

/** Grace period between soft delete and hard delete (DATA_MODEL §7). */
export const GRACE_PERIOD_DAYS = 14;
export const GRACE_PERIOD_MS = GRACE_PERIOD_DAYS * 24 * 60 * 60 * 1000;

/** Events deleted per statement so a cascade stays inside one CPU slice. */
const EVENT_DELETE_BATCH = 500;

/** Timestamp after which a soft-deleted child is purged. */
export function purgeDueAt(deletedAtIso: string): string {
  return new Date(Date.parse(deletedAtIso) + GRACE_PERIOD_MS).toISOString();
}

type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

/** `progress_events` is append-only (invariant 2): deletes happen only here. */
function deleteEventsBatched(tx: Tx, childId: string): number {
  let total = 0;
  for (;;) {
    const res = tx.run(
      sql`DELETE FROM progress_events WHERE event_id IN (
        SELECT event_id FROM progress_events WHERE child_id = ${childId} LIMIT ${EVENT_DELETE_BATCH}
      )`,
    );
    const changes = Number(res.changes);
    total += changes;
    if (changes < EVENT_DELETE_BATCH) return total;
  }
}

export interface SoftDeleteResult {
  deletedAt: string;
  purgeAfter: string;
  alreadyDeleted: boolean;
}

/**
 * Soft delete: stamp `deleted_at` (idempotent — the original timestamp is
 * never overwritten) and end the child's sessions so child mode stops
 * immediately (master spec §5.6 "hidden immediately"; deletion must not run
 * from child mode — a live child session must not keep writing). Returns
 * null when no such child exists (caller answers 404).
 */
export function softDeleteChild(
  db: Db,
  childId: string,
  nowIso: string,
): SoftDeleteResult | null {
  const rows = db
    .select({ deletedAt: children.deletedAt })
    .from(children)
    .where(eq(children.id, childId))
    .all();
  const row = rows[0];
  if (!row) return null;
  if (row.deletedAt !== null) {
    return { deletedAt: row.deletedAt, purgeAfter: purgeDueAt(row.deletedAt), alreadyDeleted: true };
  }
  db.transaction((tx) => {
    tx.update(children).set({ deletedAt: nowIso }).where(eq(children.id, childId)).run();
    tx.delete(sessions).where(eq(sessions.childId, childId)).run();
  });
  return { deletedAt: nowIso, purgeAfter: purgeDueAt(nowIso), alreadyDeleted: false };
}

/** Cancel within the grace period (API_SPEC §5.10 delete/cancel). */
export function cancelSoftDelete(db: Db, childId: string): void {
  db.update(children).set({ deletedAt: null }).where(eq(children.id, childId)).run();
}

/**
 * Hard delete of one child (DATA_MODEL §7 step 3): unlink media first, then
 * cascade every child-linked row in one transaction — safety events, the
 * event log, portfolio entries (before their artifacts, FK), settings,
 * artifacts, the child's sessions, and finally the `children` row itself.
 * Audit rows deliberately survive (ids only — the record that deletion
 * happened must outlive it, master spec §5.6).
 */
export function hardDeleteChild(db: Db, childId: string, artifactDir: string): number {
  const artifactRows = db
    .select({ id: artifacts.id, storageKey: artifacts.storageKey })
    .from(artifacts)
    .where(eq(artifacts.childId, childId))
    .all();

  // Media first: a failing unlink aborts the purge with rows intact.
  for (const row of artifactRows) {
    deleteArtifactFile(artifactDir, row.storageKey); // false when already gone — fine
  }

  let events = 0;
  db.transaction((tx) => {
    tx.delete(safetyEvents).where(eq(safetyEvents.childId, childId)).run();
    events = deleteEventsBatched(tx, childId);
    tx.delete(portfolioEntries).where(eq(portfolioEntries.childId, childId)).run();
    tx.delete(childSettings).where(eq(childSettings.childId, childId)).run();
    tx.delete(artifacts).where(eq(artifacts.childId, childId)).run();
    tx.delete(sessions).where(eq(sessions.childId, childId)).run();
    tx.delete(children).where(eq(children.id, childId)).run();
  });

  writeAudit(db, {
    actorType: "system",
    action: "child.purge",
    targetType: "child",
    targetId: childId,
    // Counts and ids only — never content (API_SPEC §7).
    meta: { events, artifacts: artifactRows.length },
  });
  return events;
}

/**
 * Final stage of family deletion: users, passkeys, devices and sessions go,
 * then the family row (children must already be purged — FK order).
 */
export function hardDeleteFamily(db: Db, familyId: string): number {
  const userIds = db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.familyId, familyId))
    .all()
    .map((row) => row.id);
  db.transaction((tx) => {
    tx.delete(sessions).where(eq(sessions.familyId, familyId)).run();
    // WebAuthn challenges also reference the family/users (FK order).
    const challengeScope = or(
      eq(authChallenges.familyId, familyId),
      userIds.length > 0 ? inArray(authChallenges.userId, userIds) : undefined,
    );
    if (challengeScope) tx.delete(authChallenges).where(challengeScope).run();
    if (userIds.length > 0) {
      tx.delete(passkeyCredentials).where(inArray(passkeyCredentials.userId, userIds)).run();
    }
    tx.delete(devices).where(eq(devices.familyId, familyId)).run();
    if (userIds.length > 0) {
      tx.delete(users).where(eq(users.familyId, familyId)).run();
    }
    tx.delete(families).where(eq(families.id, familyId)).run();
  });
  writeAudit(db, {
    actorType: "system",
    action: "family.purge",
    targetType: "family",
    targetId: familyId,
    meta: { users: userIds.length },
  });
  return userIds.length;
}

/**
 * The `family.delete` audit row doubles as the family-deletion marker
 * (API_SPEC §7 timestamps it; no `families.deleted_at` column was added).
 */
export function familyDeletionMarker(db: Db, familyId: string): { at: string } | null {
  const rows = db
    .select({ at: auditLog.at })
    .from(auditLog)
    .where(
      and(
        eq(auditLog.action, "family.delete"),
        eq(auditLog.targetType, "family"),
        eq(auditLog.targetId, familyId),
      ),
    )
    .orderBy(desc(auditLog.at))
    .limit(1)
    .all();
  const row = rows[0];
  return row ? { at: row.at } : null;
}

export interface PurgePassResult {
  children: number;
  families: number;
}

/**
 * Opportunistic grace sweep: purge children whose 14 days have elapsed, then
 * finish family deletions whose grace has elapsed and whose children are all
 * gone. Called from the privacy mutation endpoints (and destined for a cron
 * trigger once the app deploys — CURRENT_STATE note). Bounded per pass so a
 * request never becomes the heavy worker (API_SPEC §5.10).
 */
export function runDueHardDeletes(
  db: Db,
  nowIso: string,
  artifactDir: string,
  maxChildren = 10,
): PurgePassResult {
  const cutoff = new Date(Date.parse(nowIso) - GRACE_PERIOD_MS).toISOString();

  const due = db
    .select({ id: children.id })
    .from(children)
    .where(and(isNotNull(children.deletedAt), lte(children.deletedAt, cutoff)))
    .orderBy(asc(children.deletedAt))
    .limit(maxChildren)
    .all();
  for (const row of due) {
    hardDeleteChild(db, row.id, artifactDir);
  }

  const markers = db
    .select({ familyId: auditLog.targetId, at: auditLog.at })
    .from(auditLog)
    .where(
      and(
        eq(auditLog.action, "family.delete"),
        eq(auditLog.targetType, "family"),
        lte(auditLog.at, cutoff),
      ),
    )
    .orderBy(asc(auditLog.at))
    .limit(maxChildren)
    .all();

  let purgedFamilies = 0;
  for (const marker of markers) {
    const familyId = marker.familyId;
    if (!familyId) continue;
    const exists = db
      .select({ id: families.id })
      .from(families)
      .where(eq(families.id, familyId))
      .all()[0];
    if (!exists) continue; // already purged (idempotent pass)
    const remaining = db
      .select({ id: children.id })
      .from(children)
      .where(eq(children.familyId, familyId))
      .limit(1)
      .all();
    if (remaining.length > 0) continue; // children purge first (same flow, then users)
    hardDeleteFamily(db, familyId);
    purgedFamilies += 1;
  }

  return { children: due.length, families: purgedFamilies };
}
