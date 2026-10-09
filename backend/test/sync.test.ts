/**
 * P1-08 — sync endpoints (API_SPEC §5.4 ingest, §5.10 paged query).
 *
 * Covers the task's test plan: duplicate push deduped (retries never
 * duplicate rows — acceptance), events queryable per child, cross-child
 * (cross-family) query denied with 404 so existence never leaks.
 * Role-gate coverage for both routes is generated in matrix.test.ts from
 * the same ROUTES table.
 */
import { randomUUID } from "node:crypto";
import type { Hono } from "hono";
import { beforeEach, describe, expect, it } from "vitest";
import type { AppEnv } from "../src/api/middleware.ts";
import { children, progressEvents } from "../src/db/schema.ts";
import type { Db } from "../src/db/index.ts";
import {
  buildApp,
  jsonHeaders,
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
  deviceId: string;
  deviceCredential: string;
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
  state = {
    ...family,
    childId,
    deviceId: device.id,
    deviceCredential: device.credential,
  };
});

function event(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    event_id: randomUUID(),
    child_id: state.childId,
    device_id: state.deviceId,
    type: "child.activity.completed",
    schema_version: 1,
    occurred_at: "2026-10-09T00:00:00.000Z",
    received_at: "2026-10-09T00:00:01.000Z",
    content_id: "step.bridge.j1",
    content_version: 1,
    payload: { outcome: "success" },
    ...overrides,
  };
}

async function post(events: readonly unknown[]): Promise<Response> {
  return await app.request("/api/v1/sync/events", {
    method: "POST",
    headers: jsonHeaders({ "x-device-credential": state.deviceCredential }),
    body: JSON.stringify({ childId: state.childId, deviceId: state.deviceId, events }),
  });
}

async function queryEvents(
  token: string,
  childId: string,
  search = "",
): Promise<Response> {
  return await app.request(`/api/v1/children/${childId}/export/events${search}`, {
    method: "GET",
    headers: jsonHeaders({ authorization: `Bearer ${token}` }),
  });
}

function storedEvents() {
  return db.select().from(progressEvents).all();
}

describe("POST /sync/events (P1-08 ingest)", () => {
  it("accepts a batch and stores rows scoped to the child and device", async () => {
    const a = event();
    const b = event({
      type: "child.experiment.executed",
      payload: { success: true },
      // API_SPEC §5.4 example shape: content_ref instead of flat fields.
      content_id: undefined,
      content_version: undefined,
      content_ref: { id: "exp.bridge.j", version: 2 },
    });
    const res = await post([a, b]);
    expect(res.status).toBe(200);
    const body = await readJson(res);
    expect(body).toEqual({
      accepted: [a.event_id, b.event_id],
      duplicates: [],
      rejected: [],
    });

    const rows = storedEvents();
    expect(rows).toHaveLength(2);
    const stored = rows.find((row) => row.eventId === b.event_id);
    expect(stored?.childId).toBe(state.childId);
    expect(stored?.deviceId).toBe(state.deviceId); // authenticated device, not client field
    expect(stored?.contentId).toBe("exp.bridge.j");
    expect(stored?.contentVersion).toBe(2);
    expect(typeof stored?.receivedAt).toBe("string"); // server receive time
  });

  it("acknowledges a retried batch as duplicates and never stores twice", async () => {
    const batch = [event(), event()];
    const batchIds = batch.map((e) => e.event_id);
    const first = await readJson(await post(batch));
    expect(first.accepted).toHaveLength(2);

    const retry = await post(batch);
    expect(retry.status).toBe(200);
    const second = await readJson(retry);
    expect(second.accepted).toEqual([]);
    expect(second.duplicates).toEqual(batchIds);
    expect(second.rejected).toEqual([]);

    // Acceptance: retries never duplicate rows.
    expect(storedEvents()).toHaveLength(2);
  });

  it("mixes accepted, duplicate and rejected outcomes in one batch", async () => {
    const seen = event();
    await post([seen]);
    const fresh = event();
    const unknown = event({ type: "child.mystery.event" });
    const foreign = event({ child_id: "c_someone_else" });

    const body = await readJson(await post([seen, fresh, unknown, foreign]));
    expect(body.accepted).toEqual([fresh.event_id]);
    expect(body.duplicates).toEqual([seen.event_id]);
    expect(body.rejected).toEqual([
      { event_id: unknown.event_id, reason: "unknown_type" },
      { event_id: foreign.event_id, reason: "child_mismatch" },
    ]);
    expect(storedEvents()).toHaveLength(2);
  });

  it("404s a child outside the device's family (ids never grant access)", async () => {
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
        deviceId: state.deviceId,
        events: [event()],
      }),
    });
    expect(res.status).toBe(404);
    expect((await readJson(res)).error).toMatchObject({ code: "not_found" });
    expect(storedEvents()).toHaveLength(0);
  });

  it("400s a batch over the 50-event cap (API_SPEC §4)", async () => {
    const batch = Array.from({ length: 51 }, () => event());
    const res = await post(batch);
    expect(res.status).toBe(400);
    expect((await readJson(res)).error).toMatchObject({ code: "invalid_request" });
    expect(storedEvents()).toHaveLength(0);
  });

  it("requires the device credential", async () => {
    const res = await app.request("/api/v1/sync/events", {
      method: "POST",
      headers: jsonHeaders(),
      body: JSON.stringify({
        childId: state.childId,
        deviceId: state.deviceId,
        events: [event()],
      }),
    });
    expect(res.status).toBe(401);
    expect(storedEvents()).toHaveLength(0);
  });
});

describe("GET /children/:childId/export/events (P1-08 query)", () => {
  it("returns that child's events in time order with cursor paging", async () => {
    const e1 = event({ occurred_at: "2026-10-09T01:00:00.000Z" });
    const e2 = event({ occurred_at: "2026-10-09T02:00:00.000Z" });
    const e3 = event({ occurred_at: "2026-10-09T03:00:00.000Z" });
    await post([e1, e2, e3]);

    const page1 = await readJson(await queryEvents(state.parentToken, state.childId, "?limit=2"));
    const events1 = page1.events as { event_id: string; occurred_at: string }[];
    expect(events1.map((e) => e.event_id)).toEqual([e1.event_id, e2.event_id]);
    expect(typeof page1.next_cursor).toBe("string");

    const page2 = await readJson(
      await queryEvents(
        state.parentToken,
        state.childId,
        `?limit=2&cursor=${encodeURIComponent(page1.next_cursor as string)}`,
      ),
    );
    const events2 = page2.events as { event_id: string }[];
    expect(events2.map((e) => e.event_id)).toEqual([e3.event_id]);
    expect(page2.next_cursor).toBeNull();
  });

  it("pages same-timestamp events without loss or overlap (row-value cursor)", async () => {
    const at = "2026-10-09T05:00:00.000Z";
    const a = event({ occurred_at: at });
    const b = event({ occurred_at: at });
    await post([a, b]);

    const page1 = await readJson(
      await queryEvents(state.parentToken, state.childId, "?limit=1"),
    );
    const page2 = await readJson(
      await queryEvents(
        state.parentToken,
        state.childId,
        `?limit=1&cursor=${encodeURIComponent(page1.next_cursor as string)}`,
      ),
    );
    const ids = [
      (page1.events as { event_id: string }[])[0]?.event_id ?? "",
      (page2.events as { event_id: string }[])[0]?.event_id ?? "",
    ];
    expect(ids.sort()).toEqual([a.event_id, b.event_id].sort());
    expect(page2.next_cursor).toBeNull();
  });

  it("denies a cross-family query with 404 (cross-child query denied)", async () => {
    await post([event()]);
    const foreign = await seedForeignFamily(db, new Date().toISOString());
    const res = await queryEvents(foreign.token, state.childId);
    expect(res.status).toBe(404);
    expect((await readJson(res)).error).toMatchObject({ code: "not_found" });
  });

  it("404s an unknown child and 400s malformed paging parameters", async () => {
    const missing = await queryEvents(state.parentToken, "c_missing");
    expect(missing.status).toBe(404);

    const badCursor = await queryEvents(state.parentToken, state.childId, "?cursor=garbage");
    expect(badCursor.status).toBe(400);

    const badLimit = await queryEvents(state.parentToken, state.childId, "?limit=0");
    expect(badLimit.status).toBe(400);
  });

  it("answers 401 without a parent session", async () => {
    const res = await app.request(`/api/v1/children/${state.childId}/export/events`, {
      method: "GET",
      headers: jsonHeaders(),
    });
    expect(res.status).toBe(401);
  });
});
