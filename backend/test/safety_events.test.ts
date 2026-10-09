/**
 * P1-11 — safety events (SAFETY.md §2 + §10, DATA_MODEL §2/§4).
 *
 * Test plan from TASKS_PHASE_0_1.md: every blocked or redirected exchange
 * writes a `safety_events` row with no raw personal data; risk classes are
 * enforced (`high` severity survives derivation, invalid enums never store);
 * role gates for the two new routes are generated in matrix.test.ts from the
 * ROUTES table, plus direct assertions here.
 */
import { randomUUID } from "node:crypto";
import type { Hono } from "hono";
import { beforeEach, describe, expect, it } from "vitest";
import type { AppEnv } from "../src/api/middleware.ts";
import type { Db } from "../src/db/index.ts";
import { children, safetyEvents } from "../src/db/schema.ts";
import {
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

interface State extends FlowState {
  childId: string;
  deviceCredential: string;
  childToken: string;
}

let app: Hono<AppEnv>;
let db: Db;
let state: State;

beforeEach(async () => {
  resetLimits();
  const testApp = buildApp();
  app = testApp.app;
  db = testApp.db;
  const family = await seedFamily(app);
  const device = await seedDevice(app, family.parentToken);
  const childId = await seedChild(app, family.parentToken);
  const opened = await openChildSession(app, device.credential, childId);
  const childToken = (await readJson(opened)).session_token as string;
  state = {
    ...family,
    childId,
    deviceCredential: device.credential,
    childToken,
  };
});

/** A flagged-exchange sync event (what the app writes on a safety flag). */
function flaggedEvent(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    event_id: randomUUID(),
    child_id: state.childId,
    device_id: "device-unused",
    type: "ai.safety.flagged",
    schema_version: 1,
    occurred_at: "2026-10-09T08:00:00.000Z",
    payload: {
      kind: "input_blocked",
      severity: "warn",
      source: "ai_mentor",
      action_taken: "safe_alternative",
    },
    ...overrides,
  };
}

async function post(events: readonly unknown[]): Promise<Response> {
  return await app.request("/api/v1/sync/events", {
    method: "POST",
    headers: jsonHeaders({ "x-device-credential": state.deviceCredential }),
    body: JSON.stringify({ childId: state.childId, deviceId: "device-unused", events }),
  });
}

async function listEvents(token: string, childId = state.childId): Promise<Response> {
  return await app.request(`/api/v1/children/${childId}/safety-events`, {
    headers: jsonHeaders({ authorization: `Bearer ${token}` }),
  });
}

function storedRows(): (typeof safetyEvents.$inferSelect)[] {
  return db.select().from(safetyEvents).all();
}

/** First derived row — throws instead of handing back `undefined`. */
function onlyRow(): typeof safetyEvents.$inferSelect {
  const rows = storedRows();
  if (rows.length !== 1) throw new Error(`expected exactly 1 row, got ${rows.length}`);
  const row = rows[0];
  if (row === undefined) throw new Error("unreachable");
  return row;
}

describe("POST /sync/events → safety_events derivation (DATA_MODEL §4)", () => {
  it("derives one row per flagged exchange with enum fields only", async () => {
    const res = await post([flaggedEvent()]);
    expect(res.status).toBe(200);

    const row = onlyRow();
    expect(row.kind).toBe("input_blocked");
    expect(row.severity).toBe("warn");
    expect(row.source).toBe("ai_mentor");
    expect(row.actionTaken).toBe("safe_alternative");
    expect(row.reviewedByParent).toBe(0);
    expect(row.childId).toBe(state.childId);
    // Deterministic id from the source event → retries stay idempotent.
    expect(row.id).toMatch(/^sev_/);
  });

  it("stores no raw message text even when the payload carries it", async () => {
    const res = await post([
      flaggedEvent({
        payload: {
          kind: "input_blocked",
          severity: "warn",
          action_taken: "safe_alternative",
          // What the child actually typed — must never reach safety_events.
          message: "my name is Alex and I live at 42 Oak Street",
        },
      }),
    ]);
    expect(res.status).toBe(200);

    const rows = storedRows();
    expect(rows).toHaveLength(1);
    const asJson = JSON.stringify(rows[0]);
    expect(asJson).not.toContain("Alex");
    expect(asJson).not.toContain("Oak Street");
    expect(asJson).not.toContain("my name is");
    // Column shape: enum fields + ids/timestamps only.
    expect(Object.keys(onlyRow()).sort()).toEqual(
      [
        "actionTaken",
        "childId",
        "createdAt",
        "id",
        "kind",
        "reviewedByParent",
        "severity",
        "source",
      ].sort(),
    );
  });

  it("retries (same event_id) never duplicate the derived row", async () => {
    const event = flaggedEvent();
    expect((await post([event])).status).toBe(200);
    expect((await post([event])).status).toBe(200);

    expect(storedRows()).toHaveLength(1);
    const json = (await readJson(await listEvents(state.parentToken))) as {
      events: unknown[];
    };
    expect(json.events).toHaveLength(1);
  });

  it("keeps the high risk class (SAFETY §3 — high risk never blocked from the record)", async () => {
    const res = await post([
      flaggedEvent({ payload: { kind: "risky_experiment", severity: "high", action_taken: "blocked" } }),
    ]);
    expect(res.status).toBe(200);
    const row = onlyRow();
    expect(row.severity).toBe("high");
    expect(row.kind).toBe("risky_experiment");
  });

  it("never derives a row from invalid enums or unknown types", async () => {
    const res = await post([
      flaggedEvent({ payload: { kind: "made_up_kind", severity: "warn", action_taken: "x" } }),
      flaggedEvent({ payload: { kind: "input_blocked", severity: "catastrophic", action_taken: "x" } }),
      flaggedEvent({ payload: { kind: "input_blocked" } }), // missing severity
      { ...flaggedEvent(), type: "not.a.real.event.type" },
    ]);
    expect(res.status).toBe(200);
    expect(storedRows()).toHaveLength(0);
  });

  it("scopes derivation to the authenticated family's child", async () => {
    const foreign = await seedForeignFamily(db, new Date().toISOString());
    db.insert(children)
      .values({
        id: "c_foreign_child",
        familyId: foreign.familyId,
        displayName: "Foreign",
        avatarKey: null,
        stage: "explorer",
        birthYear: null,
        locale: "en",
        uiPreset: "explorer",
        pinHash: null,
        pinFailedAttempts: 0,
        pinLockedUntil: null,
        createdAt: new Date().toISOString(),
        deletedAt: null,
      })
      .run();

    const res = await app.request("/api/v1/sync/events", {
      method: "POST",
      headers: jsonHeaders({ "x-device-credential": state.deviceCredential }),
      body: JSON.stringify({
        childId: "c_foreign_child",
        deviceId: "device-unused",
        events: [flaggedEvent({ child_id: "c_foreign_child" })],
      }),
    });
    expect(res.status).toBe(404);
    expect(storedRows()).toHaveLength(0);
  });
});

describe("GET /children/:childId/safety-events (API_SPEC §5.8)", () => {
  it("returns this child's events sorted by severity, newest first inside a class", async () => {
    await post([
      flaggedEvent({
        occurred_at: "2026-10-09T09:00:00.000Z",
        payload: { kind: "input_blocked", severity: "info", action_taken: "redirected_to_project" },
      }),
      flaggedEvent({
        occurred_at: "2026-10-09T10:00:00.000Z",
        payload: { kind: "risky_experiment", severity: "high", action_taken: "blocked" },
      }),
      flaggedEvent({
        occurred_at: "2026-10-09T11:00:00.000Z",
        payload: { kind: "privacy", severity: "warn", action_taken: "private_info_message" },
      }),
    ]);

    const json = (await readJson(await listEvents(state.parentToken))) as {
      child_id: string;
      events: { severity: string; kind: string; reviewed: boolean; created_at: string }[];
    };
    expect(json.child_id).toBe(state.childId);
    expect(json.events.map((e) => e.severity)).toEqual(["high", "warn", "info"]);
    expect(json.events.every((e) => e.reviewed === false)).toBe(true);
    expect(json.events[0]?.kind).toBe("risky_experiment");
  });

  it("rejects a child session (403) and a foreign family (404)", async () => {
    await post([flaggedEvent()]);
    expect((await listEvents(state.childToken)).status).toBe(403);

    const foreign = await seedForeignFamily(db, new Date().toISOString());
    expect((await listEvents(foreign.token)).status).toBe(404);
  });
});

describe("POST /safety-events/:eventId/review (API_SPEC §5.8)", () => {
  it("marks the event reviewed, idempotently", async () => {
    await post([flaggedEvent()]);
    const row = onlyRow();

    const res = await app.request(`/api/v1/safety-events/${row.id}/review`, {
      method: "POST",
      headers: jsonHeaders({ authorization: `Bearer ${state.parentToken}` }),
      body: "{}",
    });
    expect(res.status).toBe(200);
    expect(await readJson(res)).toEqual({ id: row.id, reviewed: true });

    const after = onlyRow();
    expect(after.reviewedByParent).toBe(1);

    // Re-review: same answer, still one row.
    const again = await app.request(`/api/v1/safety-events/${row.id}/review`, {
      method: "POST",
      headers: jsonHeaders({ authorization: `Bearer ${state.parentToken}` }),
      body: "{}",
    });
    expect(again.status).toBe(200);
    expect(storedRows()).toHaveLength(1);
  });

  it("404s across families and for unknown ids; 403s for a child session", async () => {
    await post([flaggedEvent()]);
    const row = onlyRow();

    const foreign = await seedForeignFamily(db, new Date().toISOString());
    const crossFamily = await app.request(`/api/v1/safety-events/${row.id}/review`, {
      method: "POST",
      headers: jsonHeaders({ authorization: `Bearer ${foreign.token}` }),
      body: "{}",
    });
    expect(crossFamily.status).toBe(404);

    const unknown = await app.request(`/api/v1/safety-events/sev_${randomUUID()}/review`, {
      method: "POST",
      headers: jsonHeaders({ authorization: `Bearer ${state.parentToken}` }),
      body: "{}",
    });
    expect(unknown.status).toBe(404);

    const asChild = await app.request(`/api/v1/safety-events/${row.id}/review`, {
      method: "POST",
      headers: jsonHeaders({ authorization: `Bearer ${state.childToken}` }),
      body: "{}",
    });
    expect(asChild.status).toBe(403);

    // Nothing was reviewed by the denied calls.
    expect(onlyRow().reviewedByParent).toBe(0);
  });
});
