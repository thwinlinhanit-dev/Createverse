/**
 * P1-01 test helpers.
 *
 * Includes a synthesized software authenticator: a P-256 keypair that builds
 * real registration (attestation "none") and assertion responses, so the
 * tests exercise the full @simplewebauthn/server verification path — the same
 * library the free-tier spike benchmarked (scripts/free-tier-bench.mjs).
 */
import { createHash, generateKeyPairSync, randomBytes, sign } from "node:crypto";
import type { Hono } from "hono";
import { eq } from "drizzle-orm";
import { createApp } from "../src/api/app.ts";
import type { AppEnv } from "../src/api/middleware.ts";
import { resetRateLimits } from "../src/api/middleware.ts";
import { openDb } from "../src/db/index.ts";
import type { Db } from "../src/db/index.ts";
import { auditLog, sessions } from "../src/db/schema.ts";
import { hashToken } from "../src/modules/identity/sessions.ts";

export const TEST_ORIGIN = "http://localhost:5173";
export const TEST_RP_ID = "localhost";
export const TEST_SETUP_SECRET = "test-setup-secret-please";

function b64url(buf: Buffer): string {
  return buf.toString("base64url");
}

/* ------------------------------------------------------------ CBOR helpers */

function cborText(s: string): Buffer {
  const bytes = Buffer.from(s, "utf8");
  if (bytes.length >= 24) throw new Error("text too long for this encoder");
  return Buffer.concat([Buffer.from([0x60 | bytes.length]), bytes]);
}

function cborBytes(bytes: Buffer): Buffer {
  if (bytes.length < 256) {
    return Buffer.concat([Buffer.from([0x58, bytes.length]), bytes]);
  }
  const len = Buffer.alloc(2);
  len.writeUInt16BE(bytes.length);
  return Buffer.concat([Buffer.from([0x59]), len, bytes]);
}

/* ------------------------------------------------------- software authenticator */

export interface SyntheticCredential {
  credentialId: Buffer;
  publicKeyJwk: JsonWebKey;
  privateKey: import("node:crypto").KeyObject;
}

export function makeCredential(): SyntheticCredential {
  const { publicKey, privateKey } = generateKeyPairSync("ec", { namedCurve: "P-256" });
  const jwk = publicKey.export({ format: "jwk" }) as JsonWebKey;
  return { credentialId: randomBytes(32), publicKeyJwk: jwk, privateKey };
}

/** COSE_Key for EC2/P-256/ES256 — same hand encoding as the P0-09 spike. */
function coseKey(jwk: JsonWebKey): Buffer {
  const x = Buffer.from(jwk.x ?? "", "base64url");
  const y = Buffer.from(jwk.y ?? "", "base64url");
  if (x.length !== 32 || y.length !== 32) throw new Error("bad P-256 jwk");
  return Buffer.concat([
    Buffer.from([0xa5, 0x01, 0x02, 0x03, 0x26, 0x20, 0x01, 0x21, 0x58, 0x20]),
    x,
    Buffer.from([0x22, 0x58, 0x20]),
    y,
  ]);
}

function rpIdHash(rpID: string): Buffer {
  return createHash("sha256").update(rpID).digest();
}

export interface RegistrationSynth {
  id: string;
  rawId: string;
  type: "public-key";
  response: {
    clientDataJSON: string;
    attestationObject: string;
    transports?: string[];
  };
  clientExtensionResults: Record<string, never>;
}

/** Builds a RegistrationResponseJSON with a "none" attestation object. */
export function synthRegistration(
  cred: SyntheticCredential,
  challenge: string,
  rpID: string = TEST_RP_ID,
  origin: string = TEST_ORIGIN,
): RegistrationSynth {
  const clientDataJSON = Buffer.from(
    JSON.stringify({ type: "webauthn.create", challenge, origin, crossOrigin: false }),
    "utf8",
  );
  const flags = Buffer.from([0x45]); // UP | UV | AT
  const counter = Buffer.alloc(4);
  const aaguid = Buffer.alloc(16);
  const credIdLen = Buffer.alloc(2);
  credIdLen.writeUInt16BE(cred.credentialId.length);
  const attested = Buffer.concat([
    aaguid,
    credIdLen,
    cred.credentialId,
    coseKey(cred.publicKeyJwk),
  ]);
  const authData = Buffer.concat([rpIdHash(rpID), flags, counter, attested]);

  // attestationObject = CBOR {"fmt":"none","attStmt":{},"authData":bstr}
  const attestationObject = Buffer.concat([
    Buffer.from([0xa3]),
    cborText("fmt"),
    cborText("none"),
    cborText("attStmt"),
    Buffer.from([0xa0]),
    cborText("authData"),
    cborBytes(authData),
  ]);

  const id = b64url(cred.credentialId);
  return {
    id,
    rawId: id,
    type: "public-key",
    response: {
      clientDataJSON: b64url(clientDataJSON),
      attestationObject: b64url(attestationObject),
      transports: ["internal"],
    },
    clientExtensionResults: {},
  };
}

export interface AssertionSynth {
  id: string;
  rawId: string;
  type: "public-key";
  response: {
    clientDataJSON: string;
    authenticatorData: string;
    signature: string;
    userHandle: null;
  };
  clientExtensionResults: Record<string, never>;
}

/** Builds an AuthenticationResponseJSON signed by the credential's key. */
export function synthAssertion(
  cred: SyntheticCredential,
  challenge: string,
  rpID: string = TEST_RP_ID,
  origin: string = TEST_ORIGIN,
): AssertionSynth {
  const clientDataJSON = Buffer.from(
    JSON.stringify({ type: "webauthn.get", challenge, origin, crossOrigin: false }),
    "utf8",
  );
  const flags = Buffer.from([0x05]); // UP | UV
  const counter = Buffer.alloc(4);
  const authData = Buffer.concat([rpIdHash(rpID), flags, counter]);
  const clientDataHash = createHash("sha256").update(clientDataJSON).digest();
  // DER encoding is what node's sign() produces and what WebAuthn expects.
  const signature = sign("sha256", Buffer.concat([authData, clientDataHash]), cred.privateKey);
  const id = b64url(cred.credentialId);
  return {
    id,
    rawId: id,
    type: "public-key",
    response: {
      clientDataJSON: b64url(clientDataJSON),
      authenticatorData: b64url(authData),
      signature: b64url(signature),
      userHandle: null,
    },
    clientExtensionResults: {},
  };
}

/* ------------------------------------------------------------ app fixtures */

export interface TestApp {
  app: Hono<AppEnv>;
  db: Db;
}

export function buildApp(): TestApp {
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
    // Generous limits by default so suites don't trip the auth bucket;
    // the dedicated rate-limit test overrides with a unique X-Forwarded-For.
    limits: {
      auth: { kind: "auth", max: 10_000, windowMs: 60_000 },
      session: { kind: "session", max: 10_000, windowMs: 60_000 },
    },
  });
  return { app, db };
}

export function jsonHeaders(extra: Record<string, string> = {}): Record<string, string> {
  return { "content-type": "application/json", ...extra };
}

export async function readJson(res: Response): Promise<Record<string, unknown>> {
  return (await res.json()) as Record<string, unknown>;
}

export interface FlowState {
  familyId: string;
  userId: string;
  parentToken: string;
  staleToken: string;
  cred: SyntheticCredential;
}

/**
 * Full happy path: bootstrap → register passkey → login (fresh assertion) →
 * a second, deliberately stale session for step-up tests.
 * Returns tokens/ids the endpoint tests need.
 */
export async function seedFamily(app: Hono<AppEnv>): Promise<FlowState> {
  const cred = makeCredential();

  const boot = await app.request("/api/v1/setup/bootstrap", {
    method: "POST",
    headers: jsonHeaders(),
    body: JSON.stringify({
      setup_secret: TEST_SETUP_SECRET,
      email: "parent@example.test",
      family_name: "Test Family",
    }),
  });
  if (boot.status !== 201) throw new Error(`bootstrap failed: ${boot.status}`);
  const bootJson = await readJson(boot);
  const parentToken = bootJson.session_token as string;
  const familyId = bootJson.family_id as string;
  const userId = bootJson.user_id as string;

  // Register passkey (parent session from bootstrap is fresh).
  const regOptionsRes = await app.request("/api/v1/auth/passkeys/register/options", {
    method: "POST",
    headers: jsonHeaders({ authorization: `Bearer ${parentToken}` }),
    body: "{}",
  });
  if (regOptionsRes.status !== 200) {
    throw new Error(`register options failed: ${regOptionsRes.status}`);
  }
  const regOptions = (await readJson(regOptionsRes)).options as { challenge: string };
  const regVerify = await app.request("/api/v1/auth/passkeys/register/verify", {
    method: "POST",
    headers: jsonHeaders({ authorization: `Bearer ${parentToken}` }),
    body: JSON.stringify({ response: synthRegistration(cred, regOptions.challenge) }),
  });
  if (regVerify.status !== 201) throw new Error(`register verify failed: ${regVerify.status}`);

  // Login with a fresh assertion → real parent session token.
  const loginOptionsRes = await app.request("/api/v1/auth/login/options", {
    method: "POST",
    headers: jsonHeaders(),
    body: "{}",
  });
  const loginOptions = (await readJson(loginOptionsRes)).options as { challenge: string };
  const loginVerify = await app.request("/api/v1/auth/login/verify", {
    method: "POST",
    headers: jsonHeaders(),
    body: JSON.stringify({ response: synthAssertion(cred, loginOptions.challenge) }),
  });
  if (loginVerify.status !== 200) throw new Error(`login verify failed: ${loginVerify.status}`);
  const loginJson = await readJson(loginVerify);
  const loginToken = loginJson.session_token as string;

  return { familyId, userId, parentToken: loginToken, staleToken: parentToken, cred };
}

/** Registers a device and returns its raw credential (shown once). */
export async function seedDevice(
  app: Hono<AppEnv>,
  parentToken: string,
  label = "Test Phone",
): Promise<{ id: string; credential: string }> {
  const res = await app.request("/api/v1/devices", {
    method: "POST",
    headers: jsonHeaders({ authorization: `Bearer ${parentToken}` }),
    body: JSON.stringify({ label }),
  });
  if (res.status !== 201) throw new Error(`device register failed: ${res.status}`);
  const json = await readJson(res);
  return { id: json.id as string, credential: json.credential as string };
}

/** Creates a child profile. */
export async function seedChild(
  app: Hono<AppEnv>,
  parentToken: string,
  displayName = "Test Child",
  stage = "explorer",
): Promise<string> {
  const res = await app.request("/api/v1/children", {
    method: "POST",
    headers: jsonHeaders({ authorization: `Bearer ${parentToken}` }),
    body: JSON.stringify({ display_name: displayName, stage, locale: "en" }),
  });
  if (res.status !== 201) throw new Error(`child create failed: ${res.status}`);
  return (await readJson(res)).id as string;
}

/** Opens a child session using a device credential (PIN optional). */
export async function openChildSession(
  app: Hono<AppEnv>,
  deviceCredential: string,
  childId: string,
  pin?: string,
): Promise<Response> {
  return app.request(`/api/v1/children/${childId}/open`, {
    method: "POST",
    headers: jsonHeaders({ "x-device-credential": deviceCredential }),
    body: JSON.stringify(pin === undefined ? {} : { pin }),
  });
}

/**
 * Seeds family B directly in the database (bootstrap is single-use by
 * spec, API_SPEC §5.1) and mints a parent session for it.
 */
export async function seedForeignFamily(
  db: Db,
  now: string,
): Promise<{ familyId: string; userId: string; token: string }> {
  const { createSession } = await import("../src/modules/identity/sessions.ts");
  const { ids } = await import("../src/modules/identity/ids.ts");
  const { families, users } = await import("../src/db/schema.ts");
  const familyId = ids.family();
  const userId = ids.user();
  db.insert(families)
    .values({ id: familyId, name: "Foreign Family", createdAt: now })
    .run();
  db.insert(users)
    .values({
      id: userId,
      familyId,
      email: "other@example.test",
      passwordHash: null,
      role: "owner",
      createdAt: now,
      lastLoginAt: null,
    })
    .run();
  const { token } = createSession(db, {
    kind: "parent",
    userId,
    familyId,
    expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    fresh: true,
  });
  return { familyId, userId, token };
}

/** Clears the in-memory rate limiter between tests. */
export function resetLimits(): void {
  resetRateLimits();
}

/**
 * Backdates a session's `fresh_at` so the step-up window (parent+fresh,
 * API_SPEC §2) reads as expired without waiting 5 minutes.
 */
export function backdateFresh(db: Db, token: string, minutesAgo = 10): void {
  db.update(sessions)
    .set({ freshAt: new Date(Date.now() - minutesAgo * 60_000).toISOString() })
    .where(eq(sessions.tokenHash, hashToken(token)))
    .run();
}

/** All audit actions written so far, in write order (P1-01 acceptance). */
export function auditActions(db: Db): string[] {
  return db
    .select({ action: auditLog.action })
    .from(auditLog)
    .all()
    .map((row) => row.action);
}

/** Full audit rows as plain JSON for personal-data assertions (§7). */
export function auditRows(db: Db): Record<string, unknown>[] {
  return db.select().from(auditLog).all() as unknown as Record<string, unknown>[];
}
