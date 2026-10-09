/**
 * P1-12 — privacy: export and deletion (DATA_MODEL §7, API_SPEC §5.10).
 *
 * Test plan from TASKS_PHASE_0_1.md:
 * - export archive contents asserted (the §7 file set, parsed and checked);
 * - delete cascade on a copy of real-shaped data (synced events, a derived
 *   safety row, an artifact file on disk, a portfolio entry, settings);
 * - audit row written for every delete/export, nothing personal in any audit
 *   row (API_SPEC §7: ids and action names only).
 *
 * Role gates for the five new routes are generated in matrix.test.ts from
 * the ROUTES table. The clock is injected (`AppOptions.now`) so the 14-day
 * grace is exercised without waiting; the family marker's timestamp comes
 * from `writeAudit` (wall clock), which is why the base time is `Date.now()`
 * and grace jumps (13d / 15d) dwarf the millisecond skew.
 */
import { randomUUID } from "node:crypto";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { eq, sql } from "drizzle-orm";
import type { AnySQLiteTable } from "drizzle-orm/sqlite-core";
import type { Hono } from "hono";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import type { AppEnv } from "../src/api/middleware.ts";
import type { Db } from "../src/db/index.ts";
import {
  artifacts,
  childSettings,
  children,
  devices,
  families,
  passkeyCredentials,
  portfolioEntries,
  progressEvents,
  safetyEvents,
  sessions,
  users,
} from "../src/db/schema.ts";
import { hashToken } from "../src/modules/identity/sessions.ts";
import { writeAudit } from "../src/modules/identity/audit.ts";
import {
  GRACE_PERIOD_DAYS,
  purgeDueAt,
  runDueHardDeletes,
} from "../src/modules/privacy/delete.ts";
import { buildChildArchive } from "../src/modules/privacy/export.ts";
import {
  auditRows,
  backdateFresh,
  buildApp,
  jsonHeaders,
  openChildSession,
  readJson,
  resetLimits,
  seedChild,
  seedDevice,
  seedFamily,
  seedForeignFamily,
  type FlowState,
} from "./helpers.ts";

const PNG_BYTES = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const PNG_BASE64 = PNG_BYTES.toString("base64");
const DAY_MS = 24 * 60 * 60 * 1000;
const T0 = Date.now();

const iso = (ms: number): string => new Date(ms).toISOString();

interface State extends FlowState {
  childId: string;
  deviceId: string;
  deviceCredential: string;
  childToken: string;
  eventIds: string[];
}

let artifactDir: string;
let app: Hono<AppEnv>;
let db: Db;
let state: State;
let nowMs: number;

afterAll(() => {
  if (artifactDir) rmSync(artifactDir, { recursive: true, force: true });
});

beforeEach(async () => {
  resetLimits();
  artifactDir = mkdtempSync(join(tmpdir(), "cv-privacy-"));
  nowMs = T0;
  const testApp = buildApp({ artifactDir, now: () => new Date(nowMs) });
  app = testApp.app;
  db = testApp.db;

  const family = await seedFamily(app);
  const device = await seedDevice(app, family.parentToken);
  const childId = await seedChild(app, family.parentToken);
  const opened = await openChildSession(app, device.credential, childId);
  if (opened.status !== 200) throw new Error(`child open failed: ${opened.status}`);
  const childToken = (await readJson(opened)).session_token as string;
  state = {
    ...family,
    childId,
    deviceId: device.id,
    deviceCredential: device.credential,
    childToken,
    eventIds: [],
  };

  // Real-shaped data across every child-linked table the cascade touches.
  const flagged = {
    event_id: randomUUID(),
    child_id: childId,
    device_id: device.id,
    type: "ai.safety.flagged",
    schema_version: 1,
    occurred_at: "2026-10-01T09:15:00.000Z",
    received_at: "2026-10-01T09:15:01.000Z",
    payload: {
      kind: "input_blocked",
      severity: "warn",
      source: "ai_mentor",
      action_taken: "safe_alternative",
    },
  };
  const events = [
    event({ occurred_at: "2026-10-01T09:00:00.000Z" }),
    event({
      type: "child.experiment.executed",
      occurred_at: "2026-10-01T09:05:00.000Z",
      content_id: "exp.bridge.e2",
      payload: { success: true, iterations: 2 },
    }),
    event({
      type: "child.reflection.submitted",
      occurred_at: "2026-10-01T09:10:00.000Z",
      content_id: "step.bridge.r1",
      payload: {},
    }),
    flagged,
  ];
  const syncRes = await app.request("/api/v1/sync/events", {
    method: "POST",
    headers: jsonHeaders({ "x-device-credential": device.credential }),
    body: JSON.stringify({ childId, deviceId: device.id, events }),
  });
  if (syncRes.status !== 200) throw new Error(`sync failed: ${syncRes.status}`);
  const syncBody = await readJson(syncRes);
  if ((syncBody.rejected as unknown[]).length > 0) {
    throw new Error(`seeding rejected events: ${JSON.stringify(syncBody.rejected)}`);
  }
  state.eventIds = events.map((e) => e.event_id as string);

  const uploadRes = await app.request("/api/v1/artifacts", {
    method: "POST",
    headers: jsonHeaders({ authorization: `Bearer ${childToken}` }),
    body: JSON.stringify({ kind: "drawing", mime: "image/png", data_base64: PNG_BASE64 }),
  });
  if (uploadRes.status !== 201) throw new Error(`upload failed: ${uploadRes.status}`);
  const artifactId = (await readJson(uploadRes)).id as string;
  const entryRes = await app.request("/api/v1/portfolio", {
    method: "POST",
    headers: jsonHeaders({ authorization: `Bearer ${childToken}` }),
    body: JSON.stringify({
      artifact_id: artifactId,
      title: "My bridge",
      skills: ["skill.bridges"],
      concepts: ["concept.load"],
      what_i_learned: "Load moves through the deck.",
    }),
  });
  if (entryRes.status !== 201) throw new Error(`entry failed: ${entryRes.status}`);
});

function event(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    event_id: randomUUID(),
    child_id: state.childId,
    device_id: state.deviceId,
    type: "child.activity.completed",
    schema_version: 1,
    occurred_at: "2026-10-01T09:00:00.000Z",
    received_at: "2026-10-01T09:00:01.000Z",
    content_id: "step.bridge.e1",
    content_version: 1,
    payload: {
      outcome: "success",
      skills: ["skill.bridges"],
      concepts: ["concept.load"],
      step_type: "activity",
    },
    ...overrides,
  };
}

function get(url: string, token: string): Promise<Response> {
  return Promise.resolve(
    app.request(url, { method: "GET", headers: jsonHeaders({ authorization: `Bearer ${token}` }) }),
  ) as Promise<Response>;
}

function post(url: string, token: string, body: Record<string, unknown> = {}): Promise<Response> {
  return Promise.resolve(
    app.request(url, {
      method: "POST",
      headers: jsonHeaders(token ? { authorization: `Bearer ${token}` } : {}),
      body: JSON.stringify(body),
    }),
  ) as Promise<Response>;
}

function errorCode(body: Record<string, unknown>): string | undefined {
  return (body.error as { code?: string } | undefined)?.code;
}

/** Schemas can't wait out the grace: push this session's window forward. */
function extendSession(token: string, atMs: number): void {
  db.update(sessions)
    .set({
      freshAt: iso(atMs),
      expiresAt: iso(atMs + 60 * 60 * 1000),
    })
    .where(eq(sessions.tokenHash, hashToken(token)))
    .run();
}

/** Row counter for cascade assertions; child tables filter by `child_id`. */
function countRows(table: AnySQLiteTable, childId?: string): number {
  if (!childId) return db.select().from(table).all().length;
  // `children` has no child_id column — its primary key *is* the child id.
  const where = table === children ? eq(children.id, childId) : sql`child_id = ${childId}`;
  return db.select().from(table).where(where).all().length;
}

/** Rows of one table belonging to a single family (foreign families coexist). */
function countFamilyRows(
  table: typeof children | typeof users | typeof devices | typeof sessions,
  familyId: string,
): number {
  return db.select().from(table).where(eq(table.familyId, familyId)).all().length;
}

async function deleteOk(childId = state.childId, token = state.parentToken) {
  const res = await post(`/api/v1/children/${childId}/delete`, token);
  if (res.status !== 200) throw new Error(`delete failed: ${res.status} ${await res.text()}`);
  return readJson(res);
}

async function foreignChild(existing?: Awaited<ReturnType<typeof seedForeignFamily>>) {
  const foreign = existing ?? (await seedForeignFamily(db, iso(T0)));
  const res = await app.request("/api/v1/children", {
    method: "POST",
    headers: jsonHeaders({ authorization: `Bearer ${foreign.token}` }),
    body: JSON.stringify({ display_name: "Other Child", stage: "explorer", locale: "en" }),
  });
  if (res.status !== 201) throw new Error(`foreign child create failed: ${res.status}`);
  return (await readJson(res)).id as string;
}

/* ------------------------------------------------------------------ export */

describe("export (API_SPEC §5.10, DATA_MODEL §7)", () => {
  it("pages every event with the keyset cursor and audits each export", async () => {
    const first = await get(
      `/api/v1/children/${state.childId}/export/events?limit=2`,
      state.parentToken,
    );
    expect(first.status).toBe(200);
    const firstBody = await readJson(first);
    const firstEvents = firstBody.events as { event_id: string }[];
    expect(firstEvents.length).toBe(2);
    expect(firstEvents[0]?.event_id).toBe(state.eventIds[0]); // occurred_at order
    expect(typeof firstBody.next_cursor).toBe("string");

    const second = await get(
      `/api/v1/children/${state.childId}/export/events?limit=2&cursor=${encodeURIComponent(
        firstBody.next_cursor as string,
      )}`,
      state.parentToken,
    );
    expect(second.status).toBe(200);
    const secondBody = await readJson(second);
    const secondEvents = secondBody.events as { event_id: string }[];
    expect(secondEvents.length).toBe(2);
    expect(secondBody.next_cursor).toBeNull(); // exactly 4 events seeded
    expect([...firstEvents, ...secondEvents].map((e) => e.event_id)).toEqual(state.eventIds);

    const exported = auditRows(db).filter((row) => row.action === "child.export");
    expect(exported.length).toBeGreaterThanOrEqual(2);
    expect(exported[0]?.targetId).toBe(state.childId);
  });

  it("returns portfolio entries with artifact file links", async () => {
    const res = await get(`/api/v1/children/${state.childId}/export/portfolio`, state.parentToken);
    expect(res.status).toBe(200);
    const body = await readJson(res);
    expect(body.child_id).toBe(state.childId);
    const entries = body.entries as { artifact: { file_url: string } | null }[];
    expect(entries.length).toBe(1);
    expect(entries[0]?.artifact?.file_url).toBe(
      `/api/v1/artifacts/${(body.artifacts as { id: string }[])[0]?.id}/file`,
    );
    expect((body.artifacts as unknown[]).length).toBe(1);

    const foreignId = await foreignChild();
    const denied = await get(`/api/v1/children/${foreignId}/export/portfolio`, state.parentToken);
    expect(denied.status).toBe(404); // cross-family never leaks existence

    const exported = auditRows(db).filter((row) => row.action === "child.export");
    expect(exported.some((row) => (row.meta as { scope?: string })?.scope === "portfolio")).toBe(
      true,
    );
  });

  it("requires a fresh step-up window and a parent session", async () => {
    backdateFresh(db, state.parentToken);
    for (const path of ["export/events", "export/portfolio"]) {
      const res = await get(`/api/v1/children/${state.childId}/${path}`, state.parentToken);
      expect(res.status).toBe(401);
      expect(errorCode(await readJson(res))).toBe("fresh_auth_required");
    }
    const childCall = await get(
      `/api/v1/children/${state.childId}/export/portfolio`,
      state.childToken,
    );
    expect(childCall.status).toBe(403); // export never runs from child mode
    const anon = await get(`/api/v1/children/${state.childId}/export/portfolio`, "");
    expect(anon.status).toBe(401);
  });

  it("builds the DATA_MODEL §7 archive with exactly the specified files", async () => {
    const artifactRows = db.select().from(artifacts).all();
    expect(artifactRows.length).toBe(1);
    const storageKey = artifactRows[0]!.storageKey;

    const files = buildChildArchive(db, state.childId, artifactDir, { nowMs });
    const paths = files.map((file) => file.path).sort();
    expect(paths).toEqual(
      [
        "concepts.json",
        "events.ndjson",
        "portfolio.json",
        "profile.json",
        "skills.json",
        `artifacts/${storageKey}`,
      ].sort(),
    );
    // §7 says ai_messages.json "if retained" — Phase 1 retains none.
    expect(paths).not.toContain("ai_messages.json");

    const read = (path: string): string =>
      Buffer.from(files.find((file) => file.path === path)!.bytes).toString("utf8");

    const profile = JSON.parse(read("profile.json")) as Record<string, unknown>;
    expect(profile.id).toBe(state.childId);
    expect(profile.display_name).toBe("Test Child");
    expect(profile.stage).toBe("explorer");
    expect(profile.locale).toBe("en");
    expect((profile.settings as Record<string, unknown>).ai_mentor_enabled).toBe(true);
    expect(profile).not.toHaveProperty("pin_hash"); // credentials are never exported

    const lines = read("events.ndjson").trim().split("\n");
    expect(lines.length).toBe(4);
    const parsed = lines.map((line) => JSON.parse(line) as { event_id: string; type: string });
    expect(parsed.map((row) => row.event_id)).toEqual(state.eventIds);
    expect(parsed.some((row) => row.type === "ai.safety.flagged")).toBe(true);

    const portfolio = JSON.parse(read("portfolio.json")) as {
      entries: unknown[];
      artifacts: { storage_key: string }[];
    };
    expect(portfolio.entries.length).toBe(1);
    expect(portfolio.artifacts[0]?.storage_key).toBe(storageKey);

    const skills = JSON.parse(read("skills.json")) as { skillId: string; level: number }[];
    expect(skills.length).toBeGreaterThanOrEqual(1);
    expect(skills[0]?.skillId).toBe("skill.bridges");
    const concepts = JSON.parse(read("concepts.json")) as { conceptId: string }[];
    expect(concepts[0]?.conceptId).toBe("concept.load");

    const artifactFile = files.find((file) => file.path.startsWith("artifacts/"))!;
    expect(artifactFile.bytes.equals(PNG_BYTES)).toBe(true);
  });
});

/* ------------------------------------------------------------ child delete */

describe("child delete (DATA_MODEL §7)", () => {
  it("requires parent+fresh — never a child or anonymous session", async () => {
    backdateFresh(db, state.parentToken);
    const stale = await post(`/api/v1/children/${state.childId}/delete`, state.parentToken);
    expect(stale.status).toBe(401);
    expect(errorCode(await readJson(stale))).toBe("fresh_auth_required");

    const childCall = await post(`/api/v1/children/${state.childId}/delete`, state.childToken);
    expect(childCall.status).toBe(403);
    const anon = await post(`/api/v1/children/${state.childId}/delete`, "");
    expect(anon.status).toBe(401);

    // Nothing happened.
    const row = db.select().from(children).where(eq(children.id, state.childId)).all()[0];
    expect(row?.deletedAt).toBeNull();
  });

  it("soft delete hides the child immediately but keeps the data", async () => {
    const body = await deleteOk();
    expect(body.deleted_at).toBe(iso(nowMs));
    expect(body.purge_after).toBe(purgeDueAt(iso(nowMs)));
    expect(body.grace_days).toBe(GRACE_PERIOD_DAYS);

    // Hidden everywhere, immediately.
    const list = await get("/api/v1/children", state.parentToken);
    expect((await readJson(list)).children).toEqual([]);
    const openRes = await openChildSession(app, state.deviceCredential, state.childId);
    expect(openRes.status).toBe(404);
    const exportRes = await get(
      `/api/v1/children/${state.childId}/export/events`,
      state.parentToken,
    );
    expect(exportRes.status).toBe(404);

    // Data intact (soft), child sessions dead, audit written.
    expect(countRows(progressEvents, state.childId)).toBe(4);
    expect(countRows(safetyEvents, state.childId)).toBe(1);
    expect(countRows(artifacts, state.childId)).toBe(1);
    expect(countRows(portfolioEntries, state.childId)).toBe(1);
    expect(countRows(childSettings, state.childId)).toBe(1);
    expect(countRows(sessions, state.childId)).toBe(0);
    const actions = auditRows(db).map((row) => row.action);
    expect(actions).toContain("child.delete");
  });

  it("is idempotent within the grace period", async () => {
    const first = await deleteOk();
    const second = await deleteOk();
    expect(second.deleted_at).toBe(first.deleted_at); // original stamp kept
    const deletes = auditRows(db).filter((row) => row.action === "child.delete");
    expect(deletes.length).toBe(1);
  });

  it("cancel restores the child within the grace period", async () => {
    await deleteOk();
    const cancel = await post(
      `/api/v1/children/${state.childId}/delete/cancel`,
      state.parentToken,
    );
    expect(cancel.status).toBe(200);
    expect((await readJson(cancel)).ok).toBe(true);

    const list = await get("/api/v1/children", state.parentToken);
    expect((await readJson(list)).children).toHaveLength(1);
    const reopened = await openChildSession(app, state.deviceCredential, state.childId);
    expect(reopened.status).toBe(200); // child mode works again (fresh open)

    const again = await post(
      `/api/v1/children/${state.childId}/delete/cancel`,
      state.parentToken,
    );
    expect(again.status).toBe(409); // nothing left to cancel
    expect(auditRows(db).map((row) => row.action)).toContain("child.delete_cancel");
  });

  it("purges the cascade after the 14-day grace, not before", async () => {
    const artifactRows = db.select().from(artifacts).all();
    const storageKey = artifactRows[0]!.storageKey;
    const filePath = join(artifactDir, storageKey);
    expect(existsSync(filePath)).toBe(true);
    await deleteOk();

    // Still inside the grace: the sweep touches nothing.
    const early = runDueHardDeletes(db, iso(nowMs + 13 * DAY_MS), artifactDir);
    expect(early).toEqual({ children: 0, families: 0 });
    expect(countRows(progressEvents, state.childId)).toBe(4);

    // Grace expired: hard delete cascades rows and media.
    nowMs += 15 * DAY_MS;
    const late = runDueHardDeletes(db, iso(nowMs), artifactDir);
    expect(late.children).toBe(1);
    expect(countRows(children, state.childId)).toBe(0);
    expect(countRows(progressEvents, state.childId)).toBe(0);
    expect(countRows(safetyEvents, state.childId)).toBe(0);
    expect(countRows(childSettings, state.childId)).toBe(0);
    expect(countRows(portfolioEntries, state.childId)).toBe(0);
    expect(countRows(artifacts, state.childId)).toBe(0);
    expect(countRows(sessions, state.childId)).toBe(0);
    expect(existsSync(filePath)).toBe(false); // media is gone too

    // A per-child delete never takes the family or the parent with it.
    expect(countRows(families)).toBe(1);
    expect(countRows(users)).toBe(1);

    const actions = auditRows(db);
    expect(actions.some((row) => row.action === "child.purge")).toBe(true);
    // Acceptance: the audit trail records the deletion with no personal data.
    const raw = JSON.stringify(actions);
    expect(raw).not.toContain("Test Child");
    expect(raw).not.toContain("parent@example.test");
  });

  it("answers 404 for another family's child and leaves it intact", async () => {
    const foreignId = await foreignChild();
    const res = await post(`/api/v1/children/${foreignId}/delete`, state.parentToken);
    expect(res.status).toBe(404);
    const foreignRow = db.select().from(children).where(eq(children.id, foreignId)).all()[0];
    expect(foreignRow?.deletedAt).toBeNull();
    expect(countRows(children, state.childId)).toBe(1); // our child untouched
  });

  it("refuses cancel once the grace has expired (purged first)", async () => {
    await deleteOk();
    nowMs += 15 * DAY_MS;
    extendSession(state.parentToken, nowMs);
    const cancel = await post(
      `/api/v1/children/${state.childId}/delete/cancel`,
      state.parentToken,
    );
    expect(cancel.status).toBe(404); // the grace ended — the child is gone
    expect(countRows(children, state.childId)).toBe(0);
  });
});

/* ------------------------------------------------------------ family delete */

describe("family delete (DATA_MODEL §7)", () => {
  it("soft-deletes every child, then purges users and devices after the grace", async () => {
    await seedChild(app, state.parentToken, "Second Kid");
    const foreign = await seedForeignFamily(db, iso(T0));
    const foreignRes = await app.request("/api/v1/children", {
      method: "POST",
      headers: jsonHeaders({ authorization: `Bearer ${foreign.token}` }),
      body: JSON.stringify({ display_name: "Other Child", stage: "explorer", locale: "en" }),
    });
    const foreignChildId = (await readJson(foreignRes)).id as string;

    const res = await post("/api/v1/family/delete", state.parentToken);
    expect(res.status).toBe(200);
    const body = await readJson(res);
    expect(body.children).toBe(2);
    expect(body.grace_days).toBe(GRACE_PERIOD_DAYS);

    // Children hidden; parent accounts and devices survive the grace (§7:
    // "same flow for all children, then users and devices").
    const list = await get("/api/v1/children", state.parentToken);
    expect((await readJson(list)).children).toEqual([]);
    expect(countFamilyRows(children, state.familyId)).toBe(2); // foreign child untouched
    expect(countRows(sessions, state.childId)).toBe(0); // child mode ends now
    const stillParent = await get("/api/v1/family", state.parentToken);
    expect(stillParent.status).toBe(200); // parents keep their account during grace

    // Inside grace: sweep changes nothing.
    const early = runDueHardDeletes(db, iso(nowMs + 13 * DAY_MS), artifactDir);
    expect(early).toEqual({ children: 0, families: 0 });

    // Grace over: children purge first, then users/devices/passkeys/sessions
    // and the family row itself.
    nowMs += 15 * DAY_MS;
    const late = runDueHardDeletes(db, iso(nowMs), artifactDir);
    expect(late).toEqual({ children: 2, families: 1 });
    expect(countFamilyRows(children, state.familyId)).toBe(0);
    expect(countFamilyRows(users, state.familyId)).toBe(0);
    expect(countFamilyRows(devices, state.familyId)).toBe(0);
    expect(countFamilyRows(sessions, state.familyId)).toBe(0);
    expect(countRows(passkeyCredentials)).toBe(0); // foreign family has none
    const familyRow = db
      .select()
      .from(families)
      .where(eq(families.id, state.familyId))
      .all();
    expect(familyRow).toHaveLength(0);

    const actions = auditRows(db);
    expect(actions.some((row) => row.action === "family.delete")).toBe(true);
    expect(actions.some((row) => row.action === "family.purge")).toBe(true);
    expect(JSON.stringify(actions)).not.toContain("Second Kid");

    // The other family is completely untouched.
    expect(countRows(families)).toBe(1);
    expect(
      db.select().from(children).where(eq(children.id, foreignChildId)).all(),
    ).toHaveLength(1);
    expect(
      db.select().from(users).where(eq(users.familyId, foreign.familyId)).all(),
    ).toHaveLength(1);
  });

  it("is idempotent and blocks child creation and cancel during grace", async () => {
    const first = await readJson(await post("/api/v1/family/delete", state.parentToken));
    expect(first.children).toBe(1);

    const second = await readJson(await post("/api/v1/family/delete", state.parentToken));
    expect(second.children).toBe(0);
    // The marker (first call's audit row) is the idempotent identity.
    const marker = auditRows(db).find((row) => row.action === "family.delete");
    expect(marker).toBeDefined();
    expect(second.deleted_at).toBe(marker?.at);
    expect(second.purge_after).toBe(purgeDueAt(marker?.at as string));
    expect(
      auditRows(db).filter((row) => row.action === "family.delete").length,
    ).toBe(1); // never double-marked

    const create = await post("/api/v1/children", state.parentToken, {
      display_name: "Latecomer",
      stage: "junior",
    });
    expect(create.status).toBe(409); // no new children while deletion is pending

    const cancel = await post(
      `/api/v1/children/${state.childId}/delete/cancel`,
      state.parentToken,
    );
    expect(cancel.status).toBe(409); // family deletion has no cancel
  });
});

/* ------------------------------------------------------------------ audit */

describe("GET /audit (API_SPEC §5.10/§7)", () => {
  it("returns the family's actions in time order with cursor paging", async () => {
    const seen: { id: string; at: string; action: string; actor_type: string }[] = [];
    let cursor: string | null = null;
    do {
      const url: string = `/api/v1/audit?limit=2${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`;
      const res = await get(url, state.parentToken);
      expect(res.status).toBe(200);
      const body = await readJson(res);
      for (const row of body.audit as typeof seen) {
        expect(["parent", "system", "child"]).toContain(row.actor_type);
        seen.push(row);
      }
      cursor = body.next_cursor as string | null;
    } while (cursor);

    expect(seen.length).toBeGreaterThanOrEqual(5);
    expect(new Set(seen.map((row) => row.id)).size).toBe(seen.length); // no repeats
    for (let i = 1; i < seen.length; i += 1) {
      expect(seen[i]!.at >= seen[i - 1]!.at).toBe(true); // chronological
    }
    const actions = seen.map((row) => row.action);
    expect(actions).toContain("child.create");
    expect(actions).toContain("auth.login");
    expect(actions).toContain("device.register");
  });

  it("never includes another family's rows", async () => {
    const foreign = await seedForeignFamily(db, iso(T0));
    const foreignChildId = await foreignChild(foreign); // one foreign family only
    writeAudit(db, {
      actorType: "parent",
      actorId: foreign.userId,
      action: "child.create",
      targetType: "child",
      targetId: foreignChildId,
    });
    writeAudit(db, {
      actorType: "parent",
      actorId: foreign.userId,
      action: "family.delete",
      targetType: "family",
      targetId: foreign.familyId,
    });

    const res = await get("/api/v1/audit?limit=500", state.parentToken);
    const raw = JSON.stringify(await readJson(res));
    expect(raw).not.toContain(foreignChildId);
    expect(raw).not.toContain(foreign.familyId);
    expect(raw).not.toContain(foreign.userId);
  });

  it("contains ids and enums only — nothing personal, before or after deletion", async () => {
    await deleteOk();
    nowMs += 15 * DAY_MS;
    runDueHardDeletes(db, iso(nowMs), artifactDir);
    extendSession(state.parentToken, nowMs); // the old session window expired with the grace

    const res = await get("/api/v1/audit?limit=500", state.parentToken);
    expect(res.status).toBe(200);
    const text = JSON.stringify(await readJson(res));
    expect(text).not.toContain("Test Child"); // display names never enter the audit
    expect(text).not.toContain("parent@example.test");
    expect(auditRows(db).map((row) => row.action)).toEqual(
      expect.arrayContaining(["child.delete", "child.purge"]),
    );
    const raw = JSON.stringify(auditRows(db));
    expect(raw).not.toContain("Test Child");
    expect(raw).not.toContain("parent@example.test");
  });
});
