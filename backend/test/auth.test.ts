/**
 * P1-01 identity behavior tests — TASKS_PHASE_0_1.md acceptance plus the
 * SECURITY.md §5 denial matrix (cross-family, child-vs-parent, revoked
 * device), PIN lockout (SECURITY §4), step-up (API_SPEC §2 parent+fresh),
 * strict-Zod bodies and the error envelope (API_SPEC §3).
 *
 * Role coverage per route lives in matrix.test.ts; audit coverage in
 * audit.test.ts.
 */
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../src/api/app.ts";
import { ROUTES } from "../src/api/routeTable.ts";
import { openDb } from "../src/db/index.ts";
import { children, devices, sessions } from "../src/db/schema.ts";
import {
  TEST_ORIGIN,
  TEST_RP_ID,
  TEST_SETUP_SECRET,
  auditActions,
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
  seedForeignFamily,
  synthAssertion,
} from "./helpers.ts";

beforeEach(() => {
  resetLimits();
});

function bearer(token: string): Record<string, string> {
  return { authorization: `Bearer ${token}` };
}

describe("step-up (parent+fresh)", () => {
  it("denies a stale session, verifies a fresh assertion, then allows", async () => {
    const { app, db } = buildApp();
    const fam = await seedFamily(app);
    backdateFresh(db, fam.staleToken);

    const body = JSON.stringify({ display_name: "Kid", stage: "explorer" });
    const denyRes = await app.request("/api/v1/children", {
      method: "POST",
      headers: jsonHeaders(bearer(fam.staleToken)),
      body,
    });
    expect(denyRes.status).toBe(401);
    expect((await readJson(denyRes)).error).toMatchObject({
      code: "fresh_auth_required",
    });

    // Phase 1: empty body → step-up challenge options.
    const challengeRes = await app.request("/api/v1/auth/fresh", {
      method: "POST",
      headers: jsonHeaders(bearer(fam.staleToken)),
      body: "{}",
    });
    expect(challengeRes.status).toBe(200);
    const challenge = (
      (await readJson(challengeRes)).options as { challenge: string }
    ).challenge;
    expect(challenge.length).toBeGreaterThan(10);

    // Phase 2: assertion → session marked fresh.
    const verifyRes = await app.request("/api/v1/auth/fresh", {
      method: "POST",
      headers: jsonHeaders(bearer(fam.staleToken)),
      body: JSON.stringify({ response: synthAssertion(fam.cred, challenge) }),
    });
    expect(verifyRes.status).toBe(200);
    expect(await readJson(verifyRes)).toMatchObject({ fresh: true });

    const allowRes = await app.request("/api/v1/children", {
      method: "POST",
      headers: jsonHeaders(bearer(fam.staleToken)),
      body,
    });
    expect(allowRes.status).toBe(201);
    expect(auditActions(db)).toContain("auth.step_up");
  });

  it("rejects a replayed (already consumed) step-up challenge", async () => {
    const { app } = buildApp();
    const fam = await seedFamily(app);
    const challengeRes = await app.request("/api/v1/auth/fresh", {
      method: "POST",
      headers: jsonHeaders(bearer(fam.parentToken)),
      body: "{}",
    });
    const challenge = (
      (await readJson(challengeRes)).options as { challenge: string }
    ).challenge;
    const assertion = synthAssertion(fam.cred, challenge);
    const first = await app.request("/api/v1/auth/fresh", {
      method: "POST",
      headers: jsonHeaders(bearer(fam.parentToken)),
      body: JSON.stringify({ response: assertion }),
    });
    expect(first.status).toBe(200);
    const replay = await app.request("/api/v1/auth/fresh", {
      method: "POST",
      headers: jsonHeaders(bearer(fam.parentToken)),
      body: JSON.stringify({ response: assertion }),
    });
    expect(replay.status).toBe(401);
  });
});

describe("children cannot self-register (SECURITY §5)", () => {
  it("no public or child-role route creates children", () => {
    const childRoutes = ROUTES.filter((r) => r.path.startsWith("/children"));
    expect(childRoutes.length).toBeGreaterThan(0);
    for (const route of childRoutes) {
      expect(
        route.role === "public" || route.role === "child",
        `${route.method} ${route.path} must not be callable by children or anonymously`,
      ).toBe(false);
    }
  });

  it("a child session and an anonymous caller are denied POST /children", async () => {
    const { app } = buildApp();
    const fam = await seedFamily(app);
    const device = await seedDevice(app, fam.parentToken);
    const childId = await seedChild(app, fam.parentToken);
    const openRes = await openChildSession(app, device.credential, childId);
    const childToken = (await readJson(openRes)).session_token as string;

    const body = JSON.stringify({ display_name: "Sneaky", stage: "junior" });
    const childTry = await app.request("/api/v1/children", {
      method: "POST",
      headers: jsonHeaders(bearer(childToken)),
      body,
    });
    expect(childTry.status).toBe(403);
    expect((await readJson(childTry)).error).toMatchObject({ code: "forbidden" });

    const anonTry = await app.request("/api/v1/children", {
      method: "POST",
      headers: jsonHeaders(),
      body,
    });
    expect(anonTry.status).toBe(401);
    expect((await readJson(anonTry)).error).toMatchObject({
      code: "unauthenticated",
    });
  });
});

describe("cross-family denial (SECURITY §5, API_SPEC §6)", () => {
  it("family B sees only its own rows and gets 404 on family A ids", async () => {
    const { app, db } = buildApp();
    const famA = await seedFamily(app);
    const deviceA = await seedDevice(app, famA.parentToken, "A phone");
    const childA = await seedChild(app, famA.parentToken, "A kid");
    const foreign = await seedForeignFamily(db, new Date().toISOString());

    // Scoped listing: B's child list is empty, never A's data.
    const listRes = await app.request("/api/v1/children", {
      method: "GET",
      headers: jsonHeaders(bearer(foreign.token)),
    });
    expect(listRes.status).toBe(200);
    expect((await readJson(listRes)).children).toEqual([]);

    // Direct access to A's ids → 404 (existence must not leak, API_SPEC §3).
    const patchRes = await app.request(`/api/v1/children/${childA}`, {
      method: "PATCH",
      headers: jsonHeaders(bearer(foreign.token)),
      body: JSON.stringify({ display_name: "Hijacked" }),
    });
    expect(patchRes.status).toBe(404);

    const pinRes = await app.request(`/api/v1/children/${childA}/pin`, {
      method: "PATCH",
      headers: jsonHeaders(bearer(foreign.token)),
      body: JSON.stringify({ pin: "1234" }),
    });
    expect(pinRes.status).toBe(404);

    const revokeRes = await app.request(`/api/v1/devices/${deviceA.id}`, {
      method: "DELETE",
      headers: jsonHeaders(bearer(foreign.token)),
    });
    expect(revokeRes.status).toBe(404);

    // A device registered in B cannot open a child of A.
    const deviceB = await seedDevice(app, foreign.token, "B phone");
    const openRes = await openChildSession(app, deviceB.credential, childA);
    expect(openRes.status).toBe(404);

    // /family always answers with the caller's own family.
    const familyRes = await app.request("/api/v1/family", {
      method: "GET",
      headers: jsonHeaders(bearer(foreign.token)),
    });
    expect(familyRes.status).toBe(200);
    expect((await readJson(familyRes)).id).toBe(foreign.familyId);
  });
});

describe("PIN lockout (SECURITY §4)", () => {
  it("locks after 5 failures, stays locked for a correct PIN, recovers", async () => {
    const { app, db } = buildApp();
    const fam = await seedFamily(app);
    const device = await seedDevice(app, fam.parentToken);
    const childId = await seedChild(app, fam.parentToken);

    const setPin = await app.request(`/api/v1/children/${childId}/pin`, {
      method: "PATCH",
      headers: jsonHeaders(bearer(fam.parentToken)),
      body: JSON.stringify({ pin: "1234" }),
    });
    expect(setPin.status).toBe(200);

    // Attempts 1–4: forbidden, counter increments.
    for (let attempt = 1; attempt <= 4; attempt += 1) {
      const res = await openChildSession(app, device.credential, childId, "9999");
      expect(res.status, `attempt ${attempt}`).toBe(403);
      const row = db.select().from(children).where(eq(children.id, childId)).all()[0];
      expect(row?.pinFailedAttempts).toBe(attempt);
    }
    // Attempt 5: locks for 15 minutes.
    const lockRes = await openChildSession(app, device.credential, childId, "9999");
    expect(lockRes.status).toBe(429);
    expect((await readJson(lockRes)).error).toMatchObject({ code: "rate_limited" });

    // Even the correct PIN is refused while locked.
    const lockedCorrect = await openChildSession(app, device.credential, childId, "1234");
    expect(lockedCorrect.status).toBe(429);

    // Lock window elapsed → correct PIN opens and resets the counter.
    db.update(children)
      .set({ pinLockedUntil: new Date(Date.now() - 1000).toISOString() })
      .where(eq(children.id, childId))
      .run();
    const recoverRes = await openChildSession(app, device.credential, childId, "1234");
    expect(recoverRes.status).toBe(200);
    const row = db.select().from(children).where(eq(children.id, childId)).all()[0];
    expect(row?.pinFailedAttempts).toBe(0);
    expect(Date.parse(row?.pinLockedUntil ?? "1970-01-01T00:00:00.000Z")).toBeLessThan(
      Date.now(),
    );
  });

  it("a correct PIN after a partial failure resets the counter", async () => {
    const { app, db } = buildApp();
    const fam = await seedFamily(app);
    const device = await seedDevice(app, fam.parentToken);
    const childId = await seedChild(app, fam.parentToken);
    await app.request(`/api/v1/children/${childId}/pin`, {
      method: "PATCH",
      headers: jsonHeaders(bearer(fam.parentToken)),
      body: JSON.stringify({ pin: "4321" }),
    });
    await openChildSession(app, device.credential, childId, "0000");
    await openChildSession(app, device.credential, childId, "0000");
    const ok = await openChildSession(app, device.credential, childId, "4321");
    expect(ok.status).toBe(200);
    const row = db.select().from(children).where(eq(children.id, childId)).all()[0];
    expect(row?.pinFailedAttempts).toBe(0);
  });
});

describe("revoked device (SECURITY §5)", () => {
  it("cannot open a child and its sessions are dead", async () => {
    const { app, db } = buildApp();
    const fam = await seedFamily(app);
    const device = await seedDevice(app, fam.parentToken);
    const childId = await seedChild(app, fam.parentToken);

    const openRes = await openChildSession(app, device.credential, childId);
    expect(openRes.status).toBe(200);
    const childToken = (await readJson(openRes)).session_token as string;
    const sessionRes = await app.request("/api/v1/auth/session", {
      method: "GET",
      headers: jsonHeaders(bearer(childToken)),
    });
    expect(sessionRes.status).toBe(200);

    const revokeRes = await app.request(`/api/v1/devices/${device.id}`, {
      method: "DELETE",
      headers: jsonHeaders(bearer(fam.parentToken)),
    });
    expect(revokeRes.status).toBe(200);
    expect((await readJson(revokeRes)).revoked_sessions).toBeGreaterThanOrEqual(1);

    // Credential no longer resolves.
    const reopen = await openChildSession(app, device.credential, childId);
    expect(reopen.status).toBe(401);

    // Session minted through the device is dead too.
    const deadSession = await app.request("/api/v1/auth/session", {
      method: "GET",
      headers: jsonHeaders(bearer(childToken)),
    });
    expect(deadSession.status).toBe(401);
    expect(auditActions(db)).toContain("device.revoke");
  });
});

describe("CORS and origin (API_SPEC §1, SECURITY §8)", () => {
  it("rejects a foreign Origin and allows the app origin with no-store", async () => {
    const { app } = buildApp();
    const evil = await app.request("/api/v1/health", {
      method: "GET",
      headers: { origin: "https://evil.example" },
    });
    expect(evil.status).toBe(403);
    expect((await readJson(evil)).error).toMatchObject({ code: "forbidden" });

    const ok = await app.request("/api/v1/health", {
      method: "GET",
      headers: { origin: TEST_ORIGIN },
    });
    expect(ok.status).toBe(200);
    expect(ok.headers.get("access-control-allow-origin")).toBe(TEST_ORIGIN);
    expect(ok.headers.get("cache-control")).toBe("no-store");
    expect(ok.headers.get("x-content-type-options")).toBe("nosniff");
  });

  it("answers CORS preflight for the app origin", async () => {
    const { app } = buildApp();
    const res = await app.request("/api/v1/children", {
      method: "OPTIONS",
      headers: { origin: TEST_ORIGIN, "access-control-request-method": "POST" },
    });
    expect(res.status).toBe(204);
    expect(res.headers.get("access-control-allow-origin")).toBe(TEST_ORIGIN);
  });
});

describe("strict request validation (API_SPEC §1)", () => {
  it("rejects unknown fields with invalid_request", async () => {
    const { app } = buildApp();
    const fam = await seedFamily(app);

    const childRes = await app.request("/api/v1/children", {
      method: "POST",
      headers: jsonHeaders(bearer(fam.parentToken)),
      body: JSON.stringify({
        display_name: "Kid",
        stage: "explorer",
        extra_field: true,
      }),
    });
    expect(childRes.status).toBe(400);
    expect((await readJson(childRes)).error).toMatchObject({
      code: "invalid_request",
    });

    const loginRes = await app.request("/api/v1/auth/login/options", {
      method: "POST",
      headers: jsonHeaders(),
      body: JSON.stringify({ unexpected: 1 }),
    });
    expect(loginRes.status).toBe(400);

    const malformed = await app.request("/api/v1/auth/login/verify", {
      method: "POST",
      headers: jsonHeaders(),
      body: "{not json",
    });
    expect(malformed.status).toBe(400);
  });

  it("rejects an oversized body with too_large", async () => {
    const { app } = buildApp();
    const res = await app.request("/api/v1/auth/login/options", {
      method: "POST",
      headers: jsonHeaders(),
      body: JSON.stringify({ pad: "x".repeat(65 * 1024) }),
    });
    expect(res.status).toBe(413);
    expect((await readJson(res)).error).toMatchObject({ code: "too_large" });
  });
});

describe("error envelope (API_SPEC §3)", () => {
  it("always answers { error: { code, message, request_id } }", async () => {
    const { app } = buildApp();
    const res = await app.request("/api/v1/family", { method: "GET" });
    expect(res.status).toBe(401);
    const body = await readJson(res);
    const error = body.error as Record<string, unknown>;
    expect(error.code).toBe("unauthenticated");
    expect(typeof error.message).toBe("string");
    expect(String(error.request_id)).toMatch(/^r_/);
    expect(Object.keys(body)).toEqual(["error"]);
  });

  it("answers 404 for unknown routes", async () => {
    const { app } = buildApp();
    const res = await app.request("/api/v1/does-not-exist", { method: "GET" });
    expect(res.status).toBe(404);
    expect((await readJson(res)).error).toMatchObject({ code: "not_found" });
  });
});

describe("rate limits (API_SPEC §4: auth 10/min/IP)", () => {
  it("returns 429 with Retry-After past the limit", async () => {
    resetLimits();
    const db = openDb(":memory:");
    const app = createApp({
      db,
      setupSecret: TEST_SETUP_SECRET,
      allowedOrigin: TEST_ORIGIN,
      webauthn: {
        rpName: "Createverse Test",
        rpID: TEST_RP_ID,
        expectedOrigins: [TEST_ORIGIN],
      },
    });
    const ip = "203.0.113.7";
    let last: Response | null = null;
    for (let i = 0; i < 11; i += 1) {
      last = await app.request("/api/v1/auth/login/options", {
        method: "POST",
        headers: jsonHeaders({ "x-forwarded-for": ip }),
        body: "{}",
      });
      if (last.status === 429) break;
    }
    expect(last?.status).toBe(429);
    expect(last?.headers.get("retry-after")).toBeTruthy();
    expect((await readJson(last as Response)).error).toMatchObject({
      code: "rate_limited",
    });
  });
});

describe("session lifecycle (SECURITY §4, §16.1)", () => {
  it("logout revokes the session immediately", async () => {
    const { app, db } = buildApp();
    const fam = await seedFamily(app);
    const logoutRes = await app.request("/api/v1/auth/logout", {
      method: "POST",
      headers: jsonHeaders(bearer(fam.parentToken)),
      body: "{}",
    });
    expect(logoutRes.status).toBe(200);
    const after = await app.request("/api/v1/auth/session", {
      method: "GET",
      headers: jsonHeaders(bearer(fam.parentToken)),
    });
    expect(after.status).toBe(401);
    expect(auditActions(db)).toContain("auth.logout");
  });

  it("rejects an unknown-credential login and audits the failure", async () => {
    const { app, db } = buildApp();
    await seedFamily(app);
    const optionsRes = await app.request("/api/v1/auth/login/options", {
      method: "POST",
      headers: jsonHeaders(),
      body: "{}",
    });
    const challenge = (
      (await readJson(optionsRes)).options as { challenge: string }
    ).challenge;
    const res = await app.request("/api/v1/auth/login/verify", {
      method: "POST",
      headers: jsonHeaders(),
      body: JSON.stringify({ response: synthAssertion(makeCredential(), challenge) }),
    });
    expect(res.status).toBe(401);
    expect((await readJson(res)).error).toMatchObject({ code: "unauthenticated" });
    expect(auditActions(db)).toContain("auth.login_failed");
  });

  it("stores session tokens only as SHA-256 hashes", async () => {
    const { app, db } = buildApp();
    const fam = await seedFamily(app);
    const sessionRows = db.select({ tokenHash: sessions.tokenHash }).from(sessions).all();
    expect(sessionRows.length).toBeGreaterThanOrEqual(2);
    for (const row of sessionRows) {
      expect(row.tokenHash).not.toBe(fam.parentToken);
      expect(row.tokenHash).toMatch(/^[0-9a-f]{64}$/);
    }
  });
});

describe("setup bootstrap (API_SPEC §5.1)", () => {
  it("rejects a wrong setup secret, then refuses a second family", async () => {
    const { app } = buildApp();
    const wrong = await app.request("/api/v1/setup/bootstrap", {
      method: "POST",
      headers: jsonHeaders(),
      body: JSON.stringify({
        setup_secret: "not-the-secret",
        email: "a@example.test",
      }),
    });
    expect(wrong.status).toBe(403);
    expect((await readJson(wrong)).error).toMatchObject({ code: "forbidden" });

    const first = await app.request("/api/v1/setup/bootstrap", {
      method: "POST",
      headers: jsonHeaders(),
      body: JSON.stringify({
        setup_secret: TEST_SETUP_SECRET,
        email: "first@example.test",
      }),
    });
    expect(first.status).toBe(201);

    const second = await app.request("/api/v1/setup/bootstrap", {
      method: "POST",
      headers: jsonHeaders(),
      body: JSON.stringify({
        setup_secret: TEST_SETUP_SECRET,
        email: "second@example.test",
      }),
    });
    expect(second.status).toBe(409);
    expect((await readJson(second)).error).toMatchObject({ code: "conflict" });
  });
});

describe("device credentials (SECURITY §6)", () => {
  it("returns the credential once and stores only its hash", async () => {
    const { app, db } = buildApp();
    const fam = await seedFamily(app);
    const device = await seedDevice(app, fam.parentToken, "Kitchen tablet");
    expect(device.credential.length).toBeGreaterThan(20);

    const row = db.select().from(devices).where(eq(devices.id, device.id)).all()[0];
    expect(row?.credentialHash).toMatch(/^[0-9a-f]{64}$/);
    expect(row?.credentialHash).not.toBe(device.credential);

    const listRes = await app.request("/api/v1/devices", {
      method: "GET",
      headers: jsonHeaders(bearer(fam.parentToken)),
    });
    const listed = JSON.stringify(await readJson(listRes));
    expect(listed).not.toContain(device.credential);
    expect(listed).toContain("Kitchen tablet");
  });
});
