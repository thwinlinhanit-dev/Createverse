/**
 * Audit coverage (P1-01 acceptance: an audit row for every auth action;
 * DATA_MODEL §3 audit_log; API_SPEC §7 / SECURITY.md §6 — ids and enums
 * only, never personal data).
 */
import { beforeEach, describe, expect, it } from "vitest";
import {
  auditActions,
  auditRows,
  backdateFresh,
  buildApp,
  jsonHeaders,
  makeCredential,
  openChildSession,
  readJson,
  resetLimits,
  seedChild,
  seedDevice,
  seedFamily,
  synthAssertion,
} from "./helpers.ts";

beforeEach(() => {
  resetLimits();
});

/** Every action P1-01 must audit (TASKS_PHASE_0_1.md acceptance). */
const REQUIRED_ACTIONS = [
  "setup.bootstrap",
  "auth.passkey_register",
  "auth.login",
  "auth.login_failed",
  "auth.logout",
  "auth.step_up",
  "device.register",
  "device.revoke",
  "child.create",
  "child.update",
  "child.pin_set",
  "child.open",
  "child.pin_failed",
  "child.pin_locked",
] as const;

function bearer(token: string): Record<string, string> {
  return { authorization: `Bearer ${token}` };
}

/** Runs one full identity journey that touches every audited action. */
async function runJourney() {
  const { app, db } = buildApp();
  const fam = await seedFamily(app); // setup.bootstrap, auth.passkey_register, auth.login
  backdateFresh(db, fam.staleToken);

  const device = await seedDevice(app, fam.parentToken); // device.register
  const childId = await seedChild(app, fam.parentToken); // child.create

  // child.update
  const patchRes = await app.request(`/api/v1/children/${childId}`, {
    method: "PATCH",
    headers: jsonHeaders(bearer(fam.parentToken)),
    body: JSON.stringify({ display_name: "Renamed Kid" }),
  });
  expect(patchRes.status).toBe(200);

  // child.pin_set
  const pinRes = await app.request(`/api/v1/children/${childId}/pin`, {
    method: "PATCH",
    headers: jsonHeaders(bearer(fam.parentToken)),
    body: JSON.stringify({ pin: "1234" }),
  });
  expect(pinRes.status).toBe(200);

  // child.open (correct PIN)
  const openRes = await openChildSession(app, device.credential, childId, "1234");
  expect(openRes.status).toBe(200);

  // child.pin_failed ×4 then child.pin_locked on the 5th wrong attempt
  for (let attempt = 1; attempt <= 5; attempt += 1) {
    const res = await openChildSession(app, device.credential, childId, "9999");
    expect(res.status, `attempt ${attempt}`).toBe(attempt < 5 ? 403 : 429);
  }

  // auth.login_failed — assertion from an unregistered credential
  const optionsRes = await app.request("/api/v1/auth/login/options", {
    method: "POST",
    headers: jsonHeaders(),
    body: "{}",
  });
  const challenge = (
    (await readJson(optionsRes)).options as { challenge: string }
  ).challenge;
  const failRes = await app.request("/api/v1/auth/login/verify", {
    method: "POST",
    headers: jsonHeaders(),
    body: JSON.stringify({ response: synthAssertion(makeCredential(), challenge) }),
  });
  expect(failRes.status).toBe(401);

  // auth.step_up on the stale session
  const freshChallengeRes = await app.request("/api/v1/auth/fresh", {
    method: "POST",
    headers: jsonHeaders(bearer(fam.staleToken)),
    body: "{}",
  });
  expect(freshChallengeRes.status).toBe(200);
  const freshChallenge = (
    (await readJson(freshChallengeRes)).options as { challenge: string }
  ).challenge;
  const freshRes = await app.request("/api/v1/auth/fresh", {
    method: "POST",
    headers: jsonHeaders(bearer(fam.staleToken)),
    body: JSON.stringify({ response: synthAssertion(fam.cred, freshChallenge) }),
  });
  expect(freshRes.status).toBe(200);

  // auth.logout
  const logoutRes = await app.request("/api/v1/auth/logout", {
    method: "POST",
    headers: jsonHeaders(bearer(fam.parentToken)),
    body: "{}",
  });
  expect(logoutRes.status).toBe(200);

  // device.revoke — staleToken was refreshed by auth.step_up (parent+fresh)
  const revokeRes = await app.request(`/api/v1/devices/${device.id}`, {
    method: "DELETE",
    headers: jsonHeaders(bearer(fam.staleToken)),
  });
  expect(revokeRes.status).toBe(200);

  return { app, db, fam, childId, device };
}

describe("audit log (P1-01 acceptance)", () => {
  it("writes an audit row for every auth action", async () => {
    const { db } = await runJourney();
    const actions = auditActions(db);
    for (const action of REQUIRED_ACTIONS) {
      expect(actions, `missing audit action ${action}`).toContain(action);
    }
    // Exactly the required set — no unexpected action kinds.
    expect(new Set(actions)).toEqual(new Set(REQUIRED_ACTIONS));
  });

  it("records ids and enums only — never personal data (SECURITY §6)", async () => {
    const { db } = await runJourney();
    const raw = JSON.stringify(auditRows(db));
    expect(raw).not.toContain("Renamed Kid");
    expect(raw).not.toContain("Test Child");
    expect(raw).not.toContain("parent@example.test");
    // The child PIN value must never appear (quoted or bare).
    expect(raw).not.toContain('"1234"');
    expect(raw).not.toContain(":1234");
  });

  it("keeps meta payloads minimal on the sensitive rows", async () => {
    const { db } = await runJourney();
    const rows = auditRows(db);
    const byAction = (action: string): Record<string, unknown>[] =>
      rows.filter((row) => row.action === action);

    // child.create: stage/locale enums only — no display name.
    expect(byAction("child.create")[0]?.meta).toEqual({
      stage: "explorer",
      locale: "en",
    });
    // child.update: field names only — no values.
    expect(byAction("child.update")[0]?.meta).toEqual({ fields: "displayName" });
    // child.pin_set: a boolean, never the PIN.
    expect(byAction("child.pin_set")[0]?.meta).toEqual({ has_pin: true });
    // auth.login_failed: credential id only — no email.
    expect(byAction("auth.login_failed")[0]?.meta).toEqual({
      credential_id: expect.any(String),
    });
    // Every row has an actor type, an action and a timestamp.
    for (const row of rows) {
      expect(["parent", "system", "child"]).toContain(row.actorType);
      expect(typeof row.at).toBe("string");
      expect(String(row.at).length).toBeGreaterThan(0);
    }
  });
});
