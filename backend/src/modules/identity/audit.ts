import type { Db } from "../../db/index.ts";
import { auditLog } from "../../db/schema.ts";
import { ids } from "./ids.ts";

export type AuditActorType = "parent" | "system" | "child";

export interface AuditEntry {
  actorType: AuditActorType;
  actorId?: string | null;
  action: string;
  targetType?: string | null;
  targetId?: string | null;
  /**
   * Free-form but MUST contain ids and enum values only — never names,
   * emails, tokens or message text (API_SPEC §7, SECURITY.md §6).
   */
  meta?: Record<string, string | number | boolean | null>;
}

/**
 * Writes one audit row. API_SPEC §7: every auth action is recorded —
 * login, logout, failed logins, device register/revoke, child create,
 * setup bootstrap, step-up, PIN failures (P1-01 acceptance criteria).
 * Audit writes must never throw into the request path's error handling:
 * a failed audit is a bug, but it should surface as a 500, not be silent.
 */
export function writeAudit(db: Db, entry: AuditEntry): string {
  const id = ids.audit();
  db.insert(auditLog)
    .values({
      id,
      actorType: entry.actorType,
      actorId: entry.actorId ?? null,
      action: entry.action,
      targetType: entry.targetType ?? null,
      targetId: entry.targetId ?? null,
      at: new Date().toISOString(),
      meta: entry.meta ?? null,
    })
    .run();
  return id;
}

/** Reads audit rows for a family-scoped listing (parent overview, tests). */
export function listAudit(db: Db, limit = 200) {
  return db.select().from(auditLog).all().slice(-limit);
}
