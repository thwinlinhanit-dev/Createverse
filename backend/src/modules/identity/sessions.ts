import { createHash } from "node:crypto";
import { and, eq, isNull } from "drizzle-orm";
import type { Db } from "../../db/index.ts";
import { devices, sessions } from "../../db/schema.ts";
import { ids, newToken } from "./ids.ts";

/** SHA-256 hex of a bearer token; tokens are stored only hashed (SECURITY.md §6). */
export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export interface SessionContext {
  id: string;
  kind: "parent" | "child";
  userId: string | null;
  childId: string | null;
  familyId: string;
  deviceId: string | null;
  /** ISO time of the last passkey confirmation (step-up window, API_SPEC §2). */
  freshAt: string | null;
}

export interface CreateSessionInput {
  kind: "parent" | "child";
  userId?: string;
  childId?: string;
  familyId: string;
  deviceId?: string;
  expiresAt: string;
  /** Parent sessions start fresh: login *is* a passkey confirmation. */
  fresh?: boolean;
}

/**
 * Creates a session, returning the raw token exactly once (stored hashed).
 * Parent sessions are created fresh (API_SPEC §2: login is a passkey
 * confirmation); child sessions never carry step-up rights.
 */
export function createSession(db: Db, input: CreateSessionInput): { token: string; context: SessionContext } {
  const token = newToken();
  const now = new Date().toISOString();
  const id = ids.session();
  const freshAt = input.kind === "parent" && input.fresh !== false ? now : null;
  db.insert(sessions)
    .values({
      id,
      userId: input.userId ?? null,
      childId: input.childId ?? null,
      familyId: input.familyId,
      deviceId: input.deviceId ?? null,
      kind: input.kind,
      tokenHash: hashToken(token),
      createdAt: now,
      expiresAt: input.expiresAt,
      freshAt,
      revokedAt: null,
    })
    .run();
  return {
    token,
    context: {
      id,
      kind: input.kind,
      userId: input.userId ?? null,
      childId: input.childId ?? null,
      familyId: input.familyId,
      deviceId: input.deviceId ?? null,
      freshAt,
    },
  };
}

/**
 * Resolves a raw token to a live session: not revoked, not expired, and —
 * for parent sessions — the linked device must still be valid (SECURITY.md §4
 * "tied to a registered device"). Returns null for anything else.
 */
export function resolveSession(db: Db, token: string, nowIso: string): SessionContext | null {
  const rows = db
    .select()
    .from(sessions)
    .where(and(eq(sessions.tokenHash, hashToken(token)), isNull(sessions.revokedAt)))
    .all();
  const row = rows[0];
  if (!row) return null;
  if (row.expiresAt <= nowIso) return null;
  if (row.deviceId) {
    // A revoked device's sessions are dead even if a revoke race left the
    // session row unrevoked (SECURITY.md §4, API_SPEC §6 rule 3).
    const device = db
      .select({ revokedAt: devices.revokedAt })
      .from(devices)
      .where(eq(devices.id, row.deviceId))
      .all();
    const deviceRow = device[0];
    if (!deviceRow || deviceRow.revokedAt !== null) return null;
  }
  return {
    id: row.id,
    kind: row.kind,
    userId: row.userId,
    childId: row.childId,
    familyId: row.familyId,
    deviceId: row.deviceId,
    freshAt: row.freshAt,
  };
}

/** Marks a session revoked (logout, device revoke). Idempotent. */
export function revokeSession(db: Db, sessionId: string, nowIso: string): void {
  db.update(sessions)
    .set({ revokedAt: nowIso })
    .where(eq(sessions.id, sessionId))
    .run();
}

/** Revokes every session on a device (device revoke, API_SPEC §5.2). */
export function revokeDeviceSessions(db: Db, deviceId: string, nowIso: string): number {
  const result = db
    .update(sessions)
    .set({ revokedAt: nowIso })
    .where(and(eq(sessions.deviceId, deviceId), isNull(sessions.revokedAt)))
    .run();
  return result.changes;
}

/** Records a fresh passkey confirmation on the session (step-up). */
export function markFresh(db: Db, sessionId: string, nowIso: string): void {
  db.update(sessions).set({ freshAt: nowIso }).where(eq(sessions.id, sessionId)).run();
}
