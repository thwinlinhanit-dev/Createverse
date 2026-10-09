/**
 * P1-10 — parent overview (API_SPEC §5.8) and settings enforcement (§5.3,
 * §6 rule 4: settings are enforced server-side; step-up for safety and AI
 * fields).
 *
 * Test plan from TASKS_PHASE_0_1.md: overview endpoint scoped by family;
 * settings change requires step-up. Role-gate coverage for both routes is
 * generated in matrix.test.ts from the same ROUTES table.
 */
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import type { Hono } from "hono";
import { beforeEach, describe, expect, it } from "vitest";
import type { AppOptions } from "../src/api/app.ts";
import type { AppEnv } from "../src/api/middleware.ts";
import type { Db } from "../src/db/index.ts";
import { childSettings } from "../src/db/schema.ts";
import {
  auditActions,
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

/** Compiled-content inputs the overview consumes (production: content bundle). */
const OVERVIEW_CONTENT: NonNullable<AppOptions["overviewContent"]> = {
  levelsBySkill: { "skill.bridges": 5 },
  assessments: [
    {
      id: "as.build",
      version: 1,
      evidence: [{ signal: "experience.success", skill: "skill.reflect", strength: 0.6 }],
    },
  ],
  experienceOrder: ["exp.first", "proj.bridge", "exp.second"],
};

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
  const testApp = buildApp({ overviewContent: OVERVIEW_CONTENT });
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

/** Recent timestamps keep decay stable so level assertions never age out. */
function at(offsetMs: number): string {
  return new Date(Date.now() - offsetMs).toISOString();
}

function event(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    event_id: randomUUID(),
    child_id: state.childId,
    device_id: state.deviceId,
    type: "child.activity.completed",
    schema_version: 1,
    occurred_at: at(60_000),
    content_id: "step.j1",
    payload: { outcome: "success" },
    ...overrides,
  };
}

async function push(events: readonly unknown[]): Promise<void> {
  const res = await app.request("/api/v1/sync/events", {
    method: "POST",
    headers: jsonHeaders({ "x-device-credential": state.deviceCredential }),
    body: JSON.stringify({ childId: state.childId, deviceId: state.deviceId, events }),
  });
  if (res.status !== 200) throw new Error(`sync failed: ${res.status}`);
}

/** A representative log: skills, concepts, a project, an interest, a struggle. */
async function seedOverviewEvents(): Promise<void> {
  await push([
    event({
      occurred_at: at(5 * 3_600_000),
      content_id: "step.j1",
      payload: {
        outcome: "success",
        skills: ["skill.bridges"],
        concepts: ["concept.load"],
        step_type: "experiment",
      },
    }),
    event({
      occurred_at: at(4 * 3_600_000),
      content_id: "step.j1",
      payload: {
        outcome: "success",
        skills: ["skill.bridges"],
        concepts: ["concept.load"],
        step_type: "experiment",
      },
    }),
    event({
      type: "child.project.completed",
      occurred_at: at(3 * 3_600_000),
      content_id: "proj.bridge",
      payload: {},
    }),
    event({
      type: "child.interest.detected",
      occurred_at: at(2 * 3_600_000),
      content_id: undefined,
      payload: { interest_id: "interest.space", weight: 2 },
    }),
    event({
      occurred_at: at(90_000),
      content_id: "step.j2",
      payload: { outcome: "failed" },
    }),
    event({
      type: "child.experiment.executed",
      occurred_at: at(30_000),
      content_id: "exp.x",
      payload: { success: true },
    }),
  ]);
}

async function overview(token: string, childId = state.childId): Promise<Response> {
  return await app.request(`/api/v1/children/${childId}/overview`, {
    method: "GET",
    headers: jsonHeaders({ authorization: `Bearer ${token}` }),
  });
}

async function patchSettings(
  token: string,
  body: unknown,
  childId = state.childId,
): Promise<Response> {
  return await app.request(`/api/v1/children/${childId}/settings`, {
    method: "PATCH",
    headers: jsonHeaders({ authorization: `Bearer ${token}` }),
    body: JSON.stringify(body),
  });
}

async function foreignChildId(): Promise<string> {
  const foreign = await seedForeignFamily(db, new Date().toISOString());
  const res = await app.request("/api/v1/children", {
    method: "POST",
    headers: jsonHeaders({ authorization: `Bearer ${foreign.token}` }),
    body: JSON.stringify({ display_name: "Other Child", stage: "explorer", locale: "en" }),
  });
  if (res.status !== 201) throw new Error(`foreign child create failed: ${res.status}`);
  return (await readJson(res)).id as string;
}

function settingsRow() {
  const rows = db.select().from(childSettings).where(eq(childSettings.childId, state.childId)).all();
  return rows[0];
}

describe("GET /children/:childId/overview (P1-10)", () => {
  it("requires a parent session", async () => {
    const anonymous = await app.request(`/api/v1/children/${state.childId}/overview`, {
      method: "GET",
      headers: jsonHeaders(),
    });
    expect(anonymous.status).toBe(401);

    const opened = await openChildSession(app, state.deviceCredential, state.childId);
    const childToken = (await readJson(opened)).session_token as string;
    const asChild = await overview(childToken);
    expect(asChild.status).toBe(403);
  });

  it("answers 404 for a child in another family (existence never leaks)", async () => {
    const otherChild = await foreignChildId();
    const res = await overview(state.parentToken, otherChild);
    expect(res.status).toBe(404);
    const body = await readJson(res);
    expect((body as { error: { code: string } }).error.code).toBe("not_found");
  });

  it("derives the learning-first overview from the event log", async () => {
    await seedOverviewEvents();
    const res = await overview(state.parentToken);
    expect(res.status).toBe(200);
    const body = (await readJson(res)) as {
      child_id: string;
      generated_at: string;
      skills: { skill_id: string; level: number; evidence_count: number }[];
      concepts: { concept_id: string; level: number; evidence_count: number }[];
      projects: { content_id: string; completed_at: string }[];
      interests: { interest_id: string; weight_total: number; count: number }[];
      struggles: { content_id: string; failed_count: number }[];
      suggestions: string[];
    };

    expect(body.child_id).toBe(state.childId);
    expect(typeof body.generated_at).toBe("string");

    // Two same-day successes: weighted sum 1.2 → level 1 of the configured 5.
    expect(body.skills).toContainEqual({
      skill_id: "skill.bridges",
      level: 1,
      evidence_count: 2,
      last_seen_at: expect.any(String),
    });
    // The assessment signal fired once (strength 0.6 < 1 → level 0, evidence kept).
    expect(body.skills).toContainEqual({
      skill_id: "skill.reflect",
      level: 0,
      evidence_count: 1,
      last_seen_at: expect.any(String),
    });
    // Two successful experiments on a concept step → "successful" (level 3).
    expect(body.concepts).toContainEqual({
      concept_id: "concept.load",
      level: 3,
      evidence_count: 2,
      last_seen_at: expect.any(String),
    });
    expect(body.projects).toEqual([
      { content_id: "proj.bridge", completed_at: expect.any(String) },
    ]);
    expect(body.interests).toEqual([
      { interest_id: "interest.space", weight_total: 2, count: 1, last_at: expect.any(String) },
    ]);
    expect(body.struggles).toEqual([
      { content_id: "step.j2", failed_count: 1, last_at: expect.any(String) },
    ]);
    // Content order minus the completed project, never engagement-ranked.
    expect(body.suggestions).toEqual(["exp.first", "exp.second"]);
  });

  it("suggests the first experiences and reports empty evidence for a new child", async () => {
    const res = await overview(state.parentToken);
    expect(res.status).toBe(200);
    const body = (await readJson(res)) as Record<string, unknown>;
    expect(body.skills).toEqual([]);
    expect(body.concepts).toEqual([]);
    expect(body.projects).toEqual([]);
    expect(body.interests).toEqual([]);
    expect(body.struggles).toEqual([]);
    expect(body.suggestions).toEqual(["exp.first", "proj.bridge", "exp.second"]);
  });
});

describe("PATCH /children/:childId/settings (P1-10)", () => {
  it("requires a parent session", async () => {
    const res = await app.request(`/api/v1/children/${state.childId}/settings`, {
      method: "PATCH",
      headers: jsonHeaders(),
      body: JSON.stringify({ daily_minutes_limit: 60 }),
    });
    expect(res.status).toBe(401);
  });

  it("answers 404 for a child in another family", async () => {
    const otherChild = await foreignChildId();
    const res = await patchSettings(state.parentToken, { daily_minutes_limit: 60 }, otherChild);
    expect(res.status).toBe(404);
  });

  it("persists a time-limit change without step-up", async () => {
    backdateFresh(db, state.staleToken); // step-up window expired
    const res = await patchSettings(state.staleToken, { daily_minutes_limit: 60 });
    expect(res.status).toBe(200);
    const body = (await readJson(res)) as {
      settings: { daily_minutes_limit: number; read_aloud_enabled: boolean };
    };
    expect(body.settings.daily_minutes_limit).toBe(60);
    expect(body.settings.read_aloud_enabled).toBe(true); // untouched default

    const row = settingsRow();
    expect(row?.dailyMinutesLimit).toBe(60);
  });

  it("rejects safety and AI field changes without step-up", async () => {
    backdateFresh(db, state.staleToken);
    const res = await patchSettings(state.staleToken, { ai_mentor_enabled: false });
    expect(res.status).toBe(401);
    const body = await readJson(res);
    expect((body as { error: { code: string } }).error.code).toBe("fresh_auth_required");

    expect(settingsRow()?.aiMentorEnabled).toBe(1); // nothing changed
    expect(auditActions(db)).not.toContain("child.settings");
  });

  it("accepts safety and AI field changes from a freshly confirmed parent", async () => {
    const res = await patchSettings(state.parentToken, {
      ai_mentor_enabled: false,
      allowed_risk_class: "medium",
    });
    expect(res.status).toBe(200);
    const body = (await readJson(res)) as {
      settings: { ai_mentor_enabled: boolean; allowed_risk_class: string };
    };
    expect(body.settings.ai_mentor_enabled).toBe(false);
    expect(body.settings.allowed_risk_class).toBe("medium");

    const row = settingsRow();
    expect(row?.aiMentorEnabled).toBe(0);
    expect(row?.allowedRiskClass).toBe("medium");
  });

  it("merges later patches into the existing row instead of resetting it", async () => {
    backdateFresh(db, state.staleToken);
    const time = await patchSettings(state.staleToken, { daily_minutes_limit: 120 });
    expect(time.status).toBe(200);
    const safety = await patchSettings(state.parentToken, { project_approval_required: true });
    expect(safety.status).toBe(200);

    const body = (await readJson(safety)) as {
      settings: {
        daily_minutes_limit: number;
        project_approval_required: boolean;
        read_aloud_enabled: boolean;
      };
    };
    expect(body.settings.daily_minutes_limit).toBe(120); // earlier change survived
    expect(body.settings.project_approval_required).toBe(true);
    expect(body.settings.read_aloud_enabled).toBe(true); // default survived

    const row = settingsRow();
    expect(row?.dailyMinutesLimit).toBe(120);
    expect(row?.projectApprovalRequired).toBe(1);
    expect(row?.readAloudEnabled).toBe(1);
  });

  it("validates the body strictly", async () => {
    expect((await patchSettings(state.parentToken, {})).status).toBe(400);
    expect((await patchSettings(state.parentToken, { unknown_field: 1 })).status).toBe(400);
    expect((await patchSettings(state.parentToken, { allowed_risk_class: "extreme" })).status).toBe(
      400,
    );
    expect((await patchSettings(state.parentToken, { daily_minutes_limit: "60" })).status).toBe(
      400,
    );
    expect((await patchSettings(state.parentToken, { daily_minutes_limit: 100_000 })).status).toBe(
      400,
    );
    expect((await patchSettings(state.parentToken, { ai_mentor_enabled: 0 })).status).toBe(400);
  });

  it("audits the change with field names only, never values", async () => {
    const res = await patchSettings(state.parentToken, { allowed_risk_class: "medium" });
    expect(res.status).toBe(200);

    expect(auditActions(db)).toContain("child.settings");
    const rows = auditRows(db).filter((row) => row.action === "child.settings");
    expect(rows).toHaveLength(1);
    const row = rows[0] as { meta: { fields?: string }; targetId?: unknown };
    expect(row.meta.fields).toBe("allowed_risk_class");
    // The value itself must never reach the audit log (API_SPEC §7).
    expect(JSON.stringify(row)).not.toContain("medium");
    expect(row.targetId).toBe(state.childId);
  });
});
