import { z } from "zod";
import { replayEvidence } from "@createverse/learning-core";
import {
  ARTIFACT_BODY_LIMIT,
  MAX_ARTIFACT_BYTES,
  decodeArtifactBase64,
  deleteArtifactFile,
  extForMime,
  isAllowlistedMime,
  readArtifactFile,
  saveArtifactFile,
  svgIsSafe,
} from "../modules/artifacts/fileStore.ts";
import { and, asc, desc, eq, sql } from "drizzle-orm";
import type { Context } from "hono";
import type { AppEnv } from "./middleware.ts";
import {
  assertFamily,
  assertFresh,
  checkSetupSecret,
  hashCredential,
  readJsonBody,
  requireParent,
  zodParse,
} from "./middleware.ts";
import { ApiError } from "./errors.ts";
import type { Db } from "../db/index.ts";
import {
  artifacts,
  childSettings,
  children,
  devices,
  families,
  portfolioEntries,
  progressEvents,
  safetyEvents,
  users,
} from "../db/schema.ts";
import { ids, newToken } from "../modules/identity/ids.ts";
import type { SessionContext } from "../modules/identity/sessions.ts";
import { writeAudit } from "../modules/identity/audit.ts";
import {
  createSession,
  markFresh,
  revokeDeviceSessions,
  revokeSession,
} from "../modules/identity/sessions.ts";
import {
  freshChallengeOptions,
  loginChallengeOptions,
  registrationOptions,
  verifyFreshAssertion,
  verifyLogin,
  verifyRegistration,
} from "../modules/identity/passkeys.ts";
import type {
  AuthenticationResponseJSON,
  RegistrationResponseJSON,
} from "../modules/identity/passkeys.ts";

/** Session lifetime (SECURITY.md §4: short-lived, tied to a device). */
const SESSION_TTL_MS = 12 * 60 * 60 * 1000;

function ttlIso(nowMs: number): string {
  return new Date(nowMs + SESSION_TTL_MS).toISOString();
}

/* ------------------------------------------------------------------ schemas
 * Strict objects: unknown fields are rejected (API_SPEC §1).
 */

const WebAuthnAssertionShape = z.strictObject({
  id: z.string(),
  rawId: z.string(),
  type: z.literal("public-key"),
  response: z.strictObject({
    clientDataJSON: z.string(),
    authenticatorData: z.string(),
    signature: z.string(),
    userHandle: z.string().nullable().optional(),
  }),
  clientExtensionResults: z.record(z.string(), z.unknown()).optional(),
  authenticatorAttachment: z.string().optional(),
});

const WebAuthnAttestationShape = z.strictObject({
  id: z.string(),
  rawId: z.string(),
  type: z.literal("public-key"),
  response: z.strictObject({
    clientDataJSON: z.string(),
    attestationObject: z.string(),
    transports: z.array(z.string()).optional(),
  }),
  clientExtensionResults: z.record(z.string(), z.unknown()).optional(),
  authenticatorAttachment: z.string().optional(),
});

const BootstrapBody = z.strictObject({
  setup_secret: z.string().min(1),
  email: z.email(),
  family_name: z.string().min(1).max(80).optional(),
});

const EmptyBody = z.strictObject({});

const LoginVerifyBody = z.strictObject({ response: WebAuthnAssertionShape });
const RegisterVerifyBody = z.strictObject({ response: WebAuthnAttestationShape });
const FreshVerifyBody = z.strictObject({ response: WebAuthnAssertionShape });

const DeviceBody = z.strictObject({ label: z.string().min(1).max(60) });

const ChildCreateBody = z.strictObject({
  display_name: z.string().min(1).max(40),
  stage: z.enum(["junior", "explorer", "maker", "creator", "inventor", "researcher"]),
  locale: z.enum(["en", "zh-Hant"]).optional(),
  birth_year: z.number().int().min(1900).max(2100).nullable().optional(),
  avatar_key: z.string().min(1).max(40).nullable().optional(),
});

const ChildPatchBody = z.strictObject({
  display_name: z.string().min(1).max(40).optional(),
  stage: z
    .enum(["junior", "explorer", "maker", "creator", "inventor", "researcher"])
    .optional(),
  locale: z.enum(["en", "zh-Hant"]).optional(),
  avatar_key: z.string().min(1).max(40).nullable().optional(),
});

const PinBody = z.strictObject({
  pin: z.string().regex(/^\d{4,6}$/).nullable(),
});

const ChildOpenBody = z.strictObject({ pin: z.string().optional() });

/* ------------------------------------------------------------------ helpers */

function findFamily(db: Db, familyId: string) {
  const rows = db.select().from(families).where(eq(families.id, familyId)).all();
  const row = rows[0];
  if (!row) throw new ApiError("not_found");
  return row;
}

function findUser(db: Db, userId: string) {
  const rows = db.select().from(users).where(eq(users.id, userId)).all();
  const row = rows[0];
  if (!row) throw new ApiError("not_found");
  return row;
}

function findChild(db: Db, childId: string) {
  const rows = db.select().from(children).where(eq(children.id, childId)).all();
  const row = rows[0];
  if (!row || row.deletedAt !== null) throw new ApiError("not_found");
  return row;
}

/** Hono's param() is `string | undefined` under noUncheckedIndexedAccess. */
function pathParam(c: Context<AppEnv>, name: string): string {
  const value = c.req.param(name);
  if (!value) throw new ApiError("not_found");
  return value;
}

/* ------------------------------------------------------------------ setup */

export async function bootstrap(c: Context<AppEnv>): Promise<Response> {
  const body = zodParse(BootstrapBody.safeParse(await readJsonBody(c, (d) => d)));
  if (!checkSetupSecret(c, body.setup_secret)) {
    // Wrong secret looks the same as absent (API_SPEC §3 generic errors).
    throw new ApiError("forbidden");
  }
  const db = c.get("db");
  const existing = db.select({ id: families.id }).from(families).limit(1).all();
  if (existing.length > 0) {
    // Disabled once a family exists (API_SPEC §5.1).
    throw new ApiError("conflict");
  }
  const now = c.get("now");
  const familyId = ids.family();
  const userId = ids.user();
  db.insert(families)
    .values({ id: familyId, name: body.family_name ?? null, createdAt: now })
    .run();
  db.insert(users)
    .values({
      id: userId,
      familyId,
      email: body.email,
      passwordHash: null,
      role: "owner",
      createdAt: now,
      lastLoginAt: null,
    })
    .run();
  const { token, context } = createSession(db, {
    kind: "parent",
    userId,
    familyId,
    expiresAt: ttlIso(Date.parse(now)),
    fresh: true,
  });
  writeAudit(db, {
    actorType: "parent",
    actorId: userId,
    action: "setup.bootstrap",
    targetType: "family",
    targetId: familyId,
  });
  return c.json(
    { family_id: familyId, user_id: userId, session_token: token, session_id: context.id },
    201,
  );
}

/* ------------------------------------------------------------------ passkeys */

export async function registerOptions(c: Context<AppEnv>): Promise<Response> {
  const session = requireParent(c);
  const user = findUser(c.get("db"), session.userId ?? "");
  const { options } = await registrationOptions(c.get("db"), c.get("webauthn"), {
    id: user.id,
    email: user.email,
  });
  return c.json({ options });
}

export async function registerVerify(c: Context<AppEnv>): Promise<Response> {
  const session = requireParent(c);
  const body = zodParse(RegisterVerifyBody.safeParse(await readJsonBody(c, (d) => d)));
  const db = c.get("db");
  const now = c.get("now");
  const userId = session.userId ?? "";
  findUser(db, userId);
  let verified: boolean;
  let credentialId: string | null = null;
  try {
    const result = await verifyRegistration(
      db,
      c.get("webauthn"),
      userId,
      body.response as RegistrationResponseJSON,
      now,
    );
    verified = result.verified;
    credentialId = result.credentialId ?? null;
  } catch {
    // Malformed attestation object — same outcome as a failed verification.
    verified = false;
  }
  if (!verified) throw new ApiError("invalid_request");
  writeAudit(db, {
    actorType: "parent",
    actorId: userId,
    action: "auth.passkey_register",
    targetType: "credential",
    targetId: credentialId,
  });
  return c.json({ verified: true, credential_id: credentialId }, 201);
}

export async function loginOptions(c: Context<AppEnv>): Promise<Response> {
  zodParse(EmptyBody.safeParse(await readJsonBody(c, (d) => d)));
  const { options } = await loginChallengeOptions(c.get("db"), c.get("webauthn"));
  return c.json({ options });
}

export async function loginVerify(c: Context<AppEnv>): Promise<Response> {
  const body = zodParse(LoginVerifyBody.safeParse(await readJsonBody(c, (d) => d)));
  const db = c.get("db");
  const now = c.get("now");
  let verified: Awaited<ReturnType<typeof verifyLogin>>;
  try {
    verified = await verifyLogin(db, c.get("webauthn"), body.response as AuthenticationResponseJSON, now);
  } catch {
    // Malformed assertion — same outcome as a bad signature.
    verified = { verified: false };
  }
  if (!verified.verified || !verified.userId || !verified.familyId) {
    writeAudit(db, {
      actorType: "system",
      action: "auth.login_failed",
      // Credential id only — never an email or other personal data (§7).
      meta: { credential_id: body.response.id },
    });
    throw new ApiError("unauthenticated");
  }
  db.update(users)
    .set({ lastLoginAt: now })
    .where(eq(users.id, verified.userId))
    .run();
  const { token, context } = createSession(db, {
    kind: "parent",
    userId: verified.userId,
    familyId: verified.familyId,
    expiresAt: ttlIso(Date.parse(now)),
    fresh: true,
  });
  writeAudit(db, {
    actorType: "parent",
    actorId: verified.userId,
    action: "auth.login",
    targetType: "session",
    targetId: context.id,
  });
  return c.json({
    session_token: token,
    session_id: context.id,
    family_id: verified.familyId,
  });
}

/* ------------------------------------------------------------------ step-up */

export async function freshVerify(c: Context<AppEnv>): Promise<Response> {
  const session = requireParent(c);
  const db = c.get("db");
  const now = c.get("now");
  const data = await readJsonBody(c, (d) => d);

  const verifyBody = FreshVerifyBody.safeParse(data);
  if (verifyBody.success) {
    // Phase 2: verify the fresh assertion and mark the session fresh.
    let ok: boolean;
    try {
      const result = await verifyFreshAssertion(
        db,
        c.get("webauthn"),
        session.userId ?? "",
        verifyBody.data.response as AuthenticationResponseJSON,
        now,
      );
      ok = result.verified;
    } catch {
      ok = false;
    }
    if (!ok) throw new ApiError("unauthenticated");
    markFresh(db, session.id, now);
    writeAudit(db, {
      actorType: "parent",
      actorId: session.userId,
      action: "auth.step_up",
      targetType: "session",
      targetId: session.id,
    });
    return c.json({ fresh: true, fresh_at: now });
  }

  // Phase 1: empty body issues the step-up challenge (API_SPEC §5.1 has a
  // single POST /auth/fresh route, so both phases share it).
  if (EmptyBody.safeParse(data).success) {
    const { options } = await freshChallengeOptions(
      db,
      c.get("webauthn"),
      session.userId ?? "",
    );
    return c.json({ options });
  }
  throw new ApiError("invalid_request");
}

/* ------------------------------------------------------------------ session */

export async function logout(c: Context<AppEnv>): Promise<Response> {
  const session = c.get("session");
  if (!session) throw new ApiError("unauthenticated");
  const now = c.get("now");
  revokeSession(c.get("db"), session.id, now);
  writeAudit(c.get("db"), {
    actorType: session.kind === "parent" ? "parent" : "child",
    actorId: session.userId ?? session.childId,
    action: "auth.logout",
    targetType: "session",
    targetId: session.id,
  });
  return c.json({ ok: true });
}

export async function getSession(c: Context<AppEnv>): Promise<Response> {
  const session = c.get("session");
  if (!session) throw new ApiError("unauthenticated");
  return c.json({
    role: session.kind,
    family_id: session.familyId,
    child_id: session.childId,
    session_id: session.id,
    fresh: session.freshAt !== null,
  });
}

/* ------------------------------------------------------------------ family */

export async function getFamily(c: Context<AppEnv>): Promise<Response> {
  const session = requireParent(c);
  const db = c.get("db");
  const family = findFamily(db, session.familyId);
  const guardians = db
    .select({
      id: users.id,
      email: users.email,
      role: users.role,
      created_at: users.createdAt,
    })
    .from(users)
    .where(eq(users.familyId, session.familyId))
    .all();
  return c.json({
    id: family.id,
    name: family.name,
    created_at: family.createdAt,
    guardians,
  });
}

/* ------------------------------------------------------------------ devices */

export async function listDevices(c: Context<AppEnv>): Promise<Response> {
  const session = requireParent(c);
  const rows = c
    .get("db")
    .select({
      id: devices.id,
      label: devices.label,
      created_at: devices.createdAt,
      last_sync_at: devices.lastSyncAt,
      revoked_at: devices.revokedAt,
    })
    .from(devices)
    .where(eq(devices.familyId, session.familyId))
    .all();
  return c.json({ devices: rows });
}

export async function registerDevice(c: Context<AppEnv>): Promise<Response> {
  const session = requireParent(c);
  const body = zodParse(DeviceBody.safeParse(await readJsonBody(c, (d) => d)));
  const db = c.get("db");
  const now = c.get("now");
  const deviceId = ids.device();
  const credential = newToken();
  db.insert(devices)
    .values({
      id: deviceId,
      familyId: session.familyId,
      label: body.label,
      credentialHash: hashCredential(credential),
      createdAt: now,
      lastSyncAt: null,
      revokedAt: null,
    })
    .run();
  writeAudit(db, {
    actorType: "parent",
    actorId: session.userId,
    action: "device.register",
    targetType: "device",
    targetId: deviceId,
  });
  // Credential returned exactly once (SECURITY.md §6: stored hashed only).
  return c.json({ id: deviceId, credential, label: body.label, created_at: now }, 201);
}

export async function revokeDevice(c: Context<AppEnv>): Promise<Response> {
  const session = requireParent(c);
  const deviceId = pathParam(c, "deviceId");
  const db = c.get("db");
  const now = c.get("now");
  const rows = db.select().from(devices).where(eq(devices.id, deviceId)).all();
  const device = rows[0];
  if (!device) throw new ApiError("not_found");
  assertFamily(session, device.familyId);
  db.update(devices).set({ revokedAt: now }).where(eq(devices.id, deviceId)).run();
  const revoked = revokeDeviceSessions(db, deviceId, now);
  writeAudit(db, {
    actorType: "parent",
    actorId: session.userId,
    action: "device.revoke",
    targetType: "device",
    targetId: deviceId,
    meta: { sessions_revoked: revoked },
  });
  return c.json({ ok: true, revoked_sessions: revoked });
}

/* ------------------------------------------------------------------ children */

export async function listChildren(c: Context<AppEnv>): Promise<Response> {
  const session = requireParent(c);
  const rows = c
    .get("db")
    .select()
    .from(children)
    .where(eq(children.familyId, session.familyId))
    .all()
    .filter((row) => row.deletedAt === null);
  return c.json({
    children: rows.map((row) => ({
      id: row.id,
      display_name: row.displayName,
      stage: row.stage,
      locale: row.locale,
      ui_preset: row.uiPreset,
      avatar_key: row.avatarKey,
      birth_year: row.birthYear,
      has_pin: row.pinHash !== null,
      created_at: row.createdAt,
    })),
  });
}

export async function createChild(c: Context<AppEnv>): Promise<Response> {
  const session = requireParent(c);
  const body = zodParse(ChildCreateBody.safeParse(await readJsonBody(c, (d) => d)));
  const db = c.get("db");
  const now = c.get("now");
  const childId = ids.child();
  db.insert(children)
    .values({
      id: childId,
      familyId: session.familyId,
      displayName: body.display_name,
      avatarKey: body.avatar_key ?? null,
      stage: body.stage,
      birthYear: body.birth_year ?? null,
      locale: body.locale ?? "en",
      uiPreset: body.stage,
      pinHash: null,
      pinFailedAttempts: 0,
      pinLockedUntil: null,
      createdAt: now,
      deletedAt: null,
    })
    .run();
  db.insert(childSettings)
    .values({
      childId,
      dailyMinutesLimit: null,
      quietHours: null,
      aiMentorEnabled: 1,
      readAloudEnabled: 1,
      projectApprovalRequired: 0,
      allowedRiskClass: "low",
      updatedAt: now,
    })
    .run();
  writeAudit(db, {
    actorType: "parent",
    actorId: session.userId,
    action: "child.create",
    targetType: "child",
    targetId: childId,
    // stage/locale enums only — no display name (API_SPEC §7).
    meta: { stage: body.stage, locale: body.locale ?? "en" },
  });
  return c.json({ id: childId, created_at: now }, 201);
}

export async function patchChild(c: Context<AppEnv>): Promise<Response> {
  const session = requireParent(c);
  const body = zodParse(ChildPatchBody.safeParse(await readJsonBody(c, (d) => d)));
  const db = c.get("db");
  const now = c.get("now");
  const child = findChild(db, pathParam(c, "childId"));
  assertFamily(session, child.familyId);

  const patch: Partial<typeof children.$inferInsert> = {};
  if (body.display_name !== undefined) patch.displayName = body.display_name;
  if (body.stage !== undefined) {
    patch.stage = body.stage;
    patch.uiPreset = body.stage;
  }
  if (body.locale !== undefined) patch.locale = body.locale;
  if (body.avatar_key !== undefined) patch.avatarKey = body.avatar_key;
  db.update(children).set(patch).where(eq(children.id, child.id)).run();
  writeAudit(db, {
    actorType: "parent",
    actorId: session.userId,
    action: "child.update",
    targetType: "child",
    targetId: child.id,
    // Field names only, never values (a display name would be personal data).
    meta: { fields: Object.keys(patch).join(",") },
  });
  return c.json({ id: child.id, updated_at: now });
}

export async function setPin(c: Context<AppEnv>): Promise<Response> {
  const session = requireParent(c);
  const body = zodParse(PinBody.safeParse(await readJsonBody(c, (d) => d)));
  const db = c.get("db");
  const child = findChild(db, pathParam(c, "childId"));
  assertFamily(session, child.familyId);
  // PINs stored hashed (SECURITY.md §6); verified with lockout in openChild
  // (SECURITY.md §4: attempts rate limited, profile locks on repeated failure).
  const pinHash = body.pin === null ? null : hashCredential(`${child.id}:${body.pin}`);
  db.update(children)
    .set({ pinHash, pinFailedAttempts: 0, pinLockedUntil: null })
    .where(eq(children.id, child.id))
    .run();
  writeAudit(db, {
    actorType: "parent",
    actorId: session.userId,
    action: "child.pin_set",
    targetType: "child",
    targetId: child.id,
    meta: { has_pin: body.pin !== null },
  });
  return c.json({ ok: true, has_pin: body.pin !== null });
}

const PIN_MAX_ATTEMPTS = 5;
const PIN_LOCK_MS = 15 * 60 * 1000;

/** Opens a child profile from a registered device (API_SPEC §5.3, role=device). */
export async function openChild(c: Context<AppEnv>): Promise<Response> {
  const db = c.get("db");
  const now = c.get("now");
  const deviceId = c.get("deviceId");
  if (!deviceId) throw new ApiError("unauthenticated");
  const deviceRows = db.select().from(devices).where(eq(devices.id, deviceId)).all();
  const device = deviceRows[0];
  if (!device || device.revokedAt !== null) throw new ApiError("unauthenticated");

  const body = zodParse(ChildOpenBody.safeParse(await readJsonBody(c, (d) => d)));
  const rows = db.select().from(children).where(eq(children.id, pathParam(c, "childId"))).all();
  const child = rows[0];
  // 404 for wrong family too: device proves family membership, and existence
  // must not leak across families (API_SPEC §3, §6 rule 6).
  if (!child || child.deletedAt !== null || child.familyId !== device.familyId) {
    throw new ApiError("not_found");
  }

  if (child.pinHash !== null) {
    const lockedUntil = child.pinLockedUntil ? Date.parse(child.pinLockedUntil) : 0;
    if (Date.parse(now) < lockedUntil) {
      writeAudit(db, {
        actorType: "system",
        action: "child.pin_locked",
        targetType: "child",
        targetId: child.id,
      });
      throw new ApiError("rate_limited", Math.ceil((lockedUntil - Date.parse(now)) / 1000));
    }
    const attemptHash = hashCredential(`${child.id}:${body.pin ?? ""}`);
    if (attemptHash !== child.pinHash) {
      const attempts = child.pinFailedAttempts + 1;
      const locked = attempts >= PIN_MAX_ATTEMPTS;
      db.update(children)
        .set({
          pinFailedAttempts: locked ? 0 : attempts,
          pinLockedUntil: locked
            ? new Date(Date.parse(now) + PIN_LOCK_MS).toISOString()
            : child.pinLockedUntil,
        })
        .where(eq(children.id, child.id))
        .run();
      writeAudit(db, {
        actorType: "system",
        action: locked ? "child.pin_locked" : "child.pin_failed",
        targetType: "child",
        targetId: child.id,
        meta: { attempts },
      });
      throw new ApiError(locked ? "rate_limited" : "forbidden");
    }
    if (child.pinFailedAttempts > 0) {
      db.update(children)
        .set({ pinFailedAttempts: 0, pinLockedUntil: null })
        .where(eq(children.id, child.id))
        .run();
    }
  }

  const { token, context } = createSession(db, {
    kind: "child",
    childId: child.id,
    familyId: child.familyId,
    deviceId,
    expiresAt: ttlIso(Date.parse(now)),
    fresh: false,
  });
  writeAudit(db, {
    actorType: "child",
    actorId: child.id,
    action: "child.open",
    targetType: "child",
    targetId: child.id,
    meta: { device_id: deviceId },
  });
  return c.json({
    session_token: token,
    session_id: context.id,
    child: {
      id: child.id,
      display_name: child.displayName,
      stage: child.stage,
      locale: child.locale,
      ui_preset: child.uiPreset,
      avatar_key: child.avatarKey,
    },
  });
}

export async function health(c: Context<AppEnv>): Promise<Response> {
  return c.json({ ok: true, version: "0.1.0" });
}

/* ------------------------------------------------------------------ sync
 * P1-08 — API_SPEC §5.4 (POST /sync/events) and §5.10 (paged events).
 * Append-only ingest, idempotent by event_id; ownership is always derived
 * from the authenticated device or parent session, never from client ids
 * (API_SPEC §2 "always derive ownership from the session").
 */

/** DATA_MODEL §4 catalogue — anything else is rejected as `unknown_type`. */
const SYNC_EVENT_TYPES = new Set([
  "child.project.started",
  "child.activity.completed",
  "child.experiment.executed",
  "child.artifact.created",
  "child.reflection.submitted",
  "child.assessment.completed",
  "child.project.completed",
  "child.skill.updated",
  "child.interest.detected",
  "ai.hint.requested",
  "ai.safety.flagged",
  "parent.settings.changed",
]);

/** P1-11: safety_events enums (DATA_MODEL §2). Anything else is not derived. */
const SAFETY_EVENT_KINDS: ReadonlySet<string> = new Set([
  "input_blocked",
  "output_blocked",
  "risky_experiment",
  "privacy",
  "other",
]);
const SAFETY_EVENT_SEVERITIES: ReadonlySet<string> = new Set(["info", "warn", "high"]);

/** Accepts both the app's shared-types event shape and the API_SPEC §5.4 example. */
const SyncEventShape = z.strictObject({
  event_id: z
    .string()
    .regex(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
      "must be a UUID",
    ),
  child_id: z.string().min(1).optional(),
  device_id: z.string().min(1).optional(),
  type: z.string().min(1),
  schema_version: z.number().int().positive(),
  occurred_at: z.iso.datetime(),
  received_at: z.iso.datetime().optional(),
  content_id: z.string().min(1).optional(),
  content_version: z.number().int().positive().optional(),
  content_ref: z
    .strictObject({ id: z.string().min(1), version: z.number().int().positive() })
    .optional(),
  payload: z.record(z.string(), z.unknown()).default({}),
});

/** Sync batch cap: API_SPEC §4 — 50 events per request. */
const SyncBody = z.strictObject({
  childId: z.string().min(1),
  deviceId: z.string().min(1),
  events: z.array(SyncEventShape).min(1).max(50),
});

export async function syncEvents(c: Context<AppEnv>): Promise<Response> {
  const deviceId = c.get("deviceId");
  if (!deviceId) throw new ApiError("unauthenticated");
  const body = zodParse(SyncBody.safeParse(await readJsonBody(c, (d) => d)));
  const db = c.get("db");
  const now = c.get("now");

  // Ownership from the credential: the child must live in this device's
  // family. A foreign child id answers 404 — existence never leaks (§6).
  const deviceRows = db.select().from(devices).where(eq(devices.id, deviceId)).all();
  const device = deviceRows[0];
  if (!device || device.revokedAt !== null) throw new ApiError("unauthenticated");
  const childRows = db.select().from(children).where(eq(children.id, body.childId)).all();
  const child = childRows[0];
  if (!child || child.deletedAt !== null || child.familyId !== device.familyId) {
    throw new ApiError("not_found");
  }

  const accepted: string[] = [];
  const duplicates: string[] = [];
  const rejected: { event_id: string; reason: string }[] = [];

  db.transaction((tx) => {
    for (const event of body.events) {
      if (!SYNC_EVENT_TYPES.has(event.type)) {
        rejected.push({ event_id: event.event_id, reason: "unknown_type" });
        continue;
      }
      if (event.child_id !== undefined && event.child_id !== body.childId) {
        rejected.push({ event_id: event.event_id, reason: "child_mismatch" });
        continue;
      }
      const result = tx
        .insert(progressEvents)
        .values({
          eventId: event.event_id,
          childId: child.id, // validated above — derived from the credential
          deviceId, // authenticated device, never the client's field
          type: event.type,
          schemaVersion: event.schema_version,
          occurredAt: event.occurred_at,
          receivedAt: now, // server receive time (DATA_MODEL §3)
          contentId: event.content_id ?? event.content_ref?.id ?? null,
          contentVersion: event.content_version ?? event.content_ref?.version ?? null,
          payload: event.payload,
        })
        .onConflictDoNothing({ target: progressEvents.eventId })
        .run();
      // Retries (same event_id) are acknowledged, never stored twice.
      if (Number(result.changes) === 0) duplicates.push(event.event_id);
      else accepted.push(event.event_id);

      // P1-11 (DATA_MODEL §4): ai.safety.flagged derives a safety_events
      // row — enum fields only, deterministic id `sev_<event_id>` so
      // retries stay idempotent, never the message text (SAFETY §2).
      if (event.type === "ai.safety.flagged") {
        const kind = event.payload["kind"];
        const severity = event.payload["severity"];
        if (
          typeof kind === "string" &&
          SAFETY_EVENT_KINDS.has(kind) &&
          typeof severity === "string" &&
          SAFETY_EVENT_SEVERITIES.has(severity)
        ) {
          tx.insert(safetyEvents)
            .values({
              id: `sev_${event.event_id}`,
              childId: child.id,
              kind: kind as typeof safetyEvents.$inferInsert["kind"],
              severity: severity as typeof safetyEvents.$inferInsert["severity"],
              source: String(event.payload["source"] ?? "ai_mentor").slice(0, 80),
              actionTaken: String(event.payload["action_taken"] ?? "unknown").slice(0, 80),
              reviewedByParent: 0,
              createdAt: event.occurred_at,
            })
            .onConflictDoNothing()
            .run();
        }
      }
    }
    tx.update(devices).set({ lastSyncAt: now }).where(eq(devices.id, deviceId)).run();
  });

  return c.json({ accepted, duplicates, rejected });
}

/** Paged events for one child (API_SPEC §5.10; the archive builder reads this). */
const EXPORT_PAGE_DEFAULT = 100;
const EXPORT_PAGE_MAX = 500;

export async function exportChildEvents(c: Context<AppEnv>): Promise<Response> {
  const session = requireParent(c);
  const db = c.get("db");
  const child = findChild(db, pathParam(c, "childId"));
  assertFamily(session, child.familyId); // 404 across families — never leak existence

  const limitRaw = c.req.query("limit");
  const limit = limitRaw === undefined ? EXPORT_PAGE_DEFAULT : Number(limitRaw);
  if (!Number.isInteger(limit) || limit < 1 || limit > EXPORT_PAGE_MAX) {
    throw new ApiError("invalid_request");
  }

  const cursorRaw = c.req.query("cursor");
  const conditions = [eq(progressEvents.childId, child.id)];
  if (cursorRaw !== undefined && cursorRaw !== "") {
    const sep = cursorRaw.indexOf("#");
    if (sep <= 0) throw new ApiError("invalid_request");
    conditions.push(
      sql`(${progressEvents.occurredAt}, ${progressEvents.eventId}) > (${cursorRaw.slice(0, sep)}, ${cursorRaw.slice(sep + 1)})`,
    );
  }

  const rows = db
    .select()
    .from(progressEvents)
    .where(and(...conditions))
    .orderBy(asc(progressEvents.occurredAt), asc(progressEvents.eventId))
    .limit(limit + 1)
    .all();

  const page = rows.slice(0, limit);
  const last = page[page.length - 1];
  return c.json({
    events: page.map((row) => ({
      event_id: row.eventId,
      child_id: row.childId,
      device_id: row.deviceId,
      type: row.type,
      schema_version: row.schemaVersion,
      occurred_at: row.occurredAt,
      received_at: row.receivedAt,
      content_id: row.contentId,
      content_version: row.contentVersion,
      payload: row.payload,
    })),
    next_cursor: rows.length > limit && last ? `${last.occurredAt}#${last.eventId}` : null,
  });
}

/* ------------------------------------------------- P1-10 overview + settings
 * API_SPEC §5.8 GET /children/:childId/overview — the learning-first parent
 * overview (PRODUCT_SPEC FR-40: evidence first, time never the headline).
 * Derived server-side from the append-only event log (DATA_MODEL §4: events
 * are the source of truth, derived state is replay), using the same pure
 * replay as the app so both views agree.
 *
 * API_SPEC §5.3 PATCH /children/:childId/settings — §6 rule 4: settings are
 * enforced server-side; the client hides what it may not do, never decides.
 * Safety and AI fields additionally require the step-up window (§5, §7).
 */

/** Fields that require step-up: safety and AI settings (API_SPEC §5.3, §6 rule 4). */
const SETTINGS_SAFETY_AI: ReadonlySet<string> = new Set([
  "ai_mentor_enabled",
  "allowed_risk_class",
  "project_approval_required",
]);

const ChildSettingsBody = z.strictObject({
  daily_minutes_limit: z.number().int().min(0).max(600).nullable().optional(),
  read_aloud_enabled: z.boolean().optional(),
  ai_mentor_enabled: z.boolean().optional(),
  project_approval_required: z.boolean().optional(),
  // "high" is blocked for children (DATA_MODEL §121) — a parent cannot allow it either.
  allowed_risk_class: z.enum(["low", "medium"]).optional(),
});

function overviewContent(c: Context<AppEnv>): {
  levelsBySkill?: Readonly<Record<string, number>>;
  assessments?: readonly import("@createverse/learning-core").ReplayAssessment[];
  experienceOrder?: readonly string[];
} {
  const content = c.get("overviewContent");
  if (!content) return {};
  return {
    ...(content.levelsBySkill ? { levelsBySkill: content.levelsBySkill } : {}),
    ...(content.assessments ? { assessments: content.assessments } : {}),
    ...(content.experienceOrder ? { experienceOrder: content.experienceOrder } : {}),
  };
}

export async function getChildOverview(c: Context<AppEnv>): Promise<Response> {
  const session = requireParent(c);
  const db = c.get("db");
  const now = c.get("now");
  const child = findChild(db, pathParam(c, "childId"));
  assertFamily(session, child.familyId); // cross-family reads answer 404 (§6 rule 1)

  const content = overviewContent(c);
  const events = db
    .select()
    .from(progressEvents)
    .where(eq(progressEvents.childId, child.id))
    .all();

  const replay = replayEvidence(
    events.map((event) => ({
      type: event.type,
      occurred_at: event.occurredAt,
      payload: event.payload as Record<string, unknown>,
    })),
    {
      nowMs: Date.parse(now),
      ...(content.levelsBySkill ? { levelsBySkill: content.levelsBySkill } : {}),
      ...(content.assessments ? { assessments: content.assessments } : {}),
    },
  );

  // Interests and struggles come straight from their catalogue events
  // (DATA_MODEL §4: child.interest.detected carries interest_id/weight;
  // a struggle is repeated failed activity on one piece of content).
  const projects = new Map<string, string>(); // content_id -> latest completed_at
  const interests = new Map<string, { weight: number; count: number; lastAt: string }>();
  const struggles = new Map<string, { count: number; lastAt: string }>();

  for (const event of events) {
    const payload = event.payload as Record<string, unknown>;
    if (event.type === "child.project.completed" && event.contentId !== null) {
      const prev = projects.get(event.contentId);
      if (prev === undefined || event.occurredAt > prev) {
        projects.set(event.contentId, event.occurredAt);
      }
      continue;
    }
    if (event.type === "child.interest.detected") {
      const interestId = payload["interest_id"];
      if (typeof interestId === "string") {
        const rawWeight = payload["weight"];
        const weight = typeof rawWeight === "number" && Number.isFinite(rawWeight) ? rawWeight : 1;
        const prev = interests.get(interestId);
        interests.set(interestId, {
          weight: (prev?.weight ?? 0) + weight,
          count: (prev?.count ?? 0) + 1,
          lastAt:
            prev === undefined || event.occurredAt > prev.lastAt ? event.occurredAt : prev.lastAt,
        });
      }
      continue;
    }
    if (event.type === "child.activity.completed" && event.contentId !== null) {
      if (payload["outcome"] === "failed") {
        const prev = struggles.get(event.contentId);
        struggles.set(event.contentId, {
          count: (prev?.count ?? 0) + 1,
          lastAt:
            prev === undefined || event.occurredAt > prev.lastAt ? event.occurredAt : prev.lastAt,
        });
      }
    }
  }

  // Suggestions: the next experiences the child has not completed yet, in
  // content order (never engagement-ranked — PRODUCT_SPEC P3/FR-40).
  const completed = new Set(projects.keys());
  const suggestions = (content.experienceOrder ?? [])
    .filter((id) => !completed.has(id))
    .slice(0, 3);

  return c.json({
    child_id: child.id,
    generated_at: now,
    skills: replay.skills.map((row) => ({
      skill_id: row.skillId,
      level: row.level,
      evidence_count: row.evidenceCount,
      last_seen_at: row.lastSeenAt,
    })),
    concepts: replay.concepts.map((row) => ({
      concept_id: row.conceptId,
      level: row.level,
      evidence_count: row.evidenceCount,
      last_seen_at: row.lastSeenAt,
    })),
    projects: [...projects.entries()]
      .map(([contentId, completedAt]) => ({ content_id: contentId, completed_at: completedAt }))
      .sort((a, b) => (a.content_id < b.content_id ? -1 : a.content_id > b.content_id ? 1 : 0)),
    interests: [...interests.entries()]
      .map(([interestId, v]) => ({
        interest_id: interestId,
        weight_total: v.weight,
        count: v.count,
        last_at: v.lastAt,
      }))
      .sort((a, b) =>
        b.weight_total !== a.weight_total
          ? b.weight_total - a.weight_total
          : a.interest_id < b.interest_id
            ? -1
            : 1,
      ),
    struggles: [...struggles.entries()]
      .map(([contentId, v]) => ({
        content_id: contentId,
        failed_count: v.count,
        last_at: v.lastAt,
      }))
      .sort((a, b) =>
        b.failed_count !== a.failed_count
          ? b.failed_count - a.failed_count
          : a.content_id < b.content_id
            ? -1
            : 1,
      ),
    suggestions,
  });
}

export async function patchChildSettings(c: Context<AppEnv>): Promise<Response> {
  const session = requireParent(c);
  const body = zodParse(ChildSettingsBody.safeParse(await readJsonBody(c, (d) => d)));
  if (Object.keys(body).length === 0) throw new ApiError("invalid_request");

  const db = c.get("db");
  const now = c.get("now");
  const child = findChild(db, pathParam(c, "childId"));
  assertFamily(session, child.familyId);

  // Step-up only when safety or AI fields change (API_SPEC §5.3, §6 rule 4);
  // time and read-aloud stay usable in the normal parent window.
  const keys = Object.keys(body);
  if (keys.some((key) => SETTINGS_SAFETY_AI.has(key))) {
    assertFresh(c, session);
  }

  const patch: Partial<typeof childSettings.$inferInsert> = {};
  if (body.daily_minutes_limit !== undefined) patch.dailyMinutesLimit = body.daily_minutes_limit;
  // Integer flag columns (0/1); the API speaks booleans both ways.
  if (body.read_aloud_enabled !== undefined) patch.readAloudEnabled = body.read_aloud_enabled ? 1 : 0;
  if (body.ai_mentor_enabled !== undefined) patch.aiMentorEnabled = body.ai_mentor_enabled ? 1 : 0;
  if (body.project_approval_required !== undefined) {
    patch.projectApprovalRequired = body.project_approval_required ? 1 : 0;
  }
  if (body.allowed_risk_class !== undefined) patch.allowedRiskClass = body.allowed_risk_class;
  patch.updatedAt = now;

  // Upsert: a child may have no settings row yet; later patches merge into
  // the existing row so a partial update never resets the other controls.
  db.insert(childSettings)
    .values({ childId: child.id, updatedAt: now, ...patch })
    .onConflictDoUpdate({ target: childSettings.childId, set: patch })
    .run();

  const rows = db.select().from(childSettings).where(eq(childSettings.childId, child.id)).all();
  const row = rows[0];
  if (!row) throw new ApiError("internal"); // just upserted — unreachable

  writeAudit(db, {
    actorType: "parent",
    actorId: session.userId,
    action: "child.settings",
    targetType: "child",
    targetId: child.id,
    // Field names only, never values (API_SPEC §7: ids and action names).
    meta: { fields: keys.join(",") },
  });

  return c.json({
    id: child.id,
    updated_at: now,
    settings: {
      daily_minutes_limit: row.dailyMinutesLimit,
      quiet_hours: row.quietHours,
      read_aloud_enabled: row.readAloudEnabled === 1,
      ai_mentor_enabled: row.aiMentorEnabled === 1,
      project_approval_required: row.projectApprovalRequired === 1,
      allowed_risk_class: row.allowedRiskClass,
    },
  });
}

/* ------------------------------------------------- P1-09 portfolio endpoints
 * API_SPEC §5.7. Roles: uploads and entry creation come from the child
 * session; lists/details/edits accept parent OR the owning child
 * ("child (own)" — API_SPEC §6 rule 2); deletes are parent-only.
 *
 * Audit decision (API_SPEC §7): creating/reading content carries no
 * security meaning and adds no audit rows; the two destructive parent
 * operations do (portfolio.delete, artifact.delete below).
 */

const ARTIFACT_KINDS = [
  "drawing",
  "song",
  "code",
  "experiment_result",
  "design",
  "report",
  "game",
  "model",
] as const;

const ArtifactUploadBody = z.strictObject({
  kind: z.enum(ARTIFACT_KINDS),
  mime: z.string().min(1),
  data_base64: z.string().min(1),
});

const PortfolioCreateBody = z.strictObject({
  artifact_id: z.string().min(1),
  title: z.string().min(1).max(80),
  skills: z.array(z.string().min(1).max(60)).max(20).default([]),
  concepts: z.array(z.string().min(1).max(60)).max(20).default([]),
  what_i_learned: z.string().max(500).optional(),
  what_i_would_improve: z.string().max(500).optional(),
});

const PortfolioPatchBody = z.strictObject({
  title: z.string().min(1).max(80).optional(),
  what_i_learned: z.string().max(500).nullable().optional(),
  what_i_would_improve: z.string().max(500).nullable().optional(),
});

type ArtifactRow = typeof artifacts.$inferSelect;
type EntryRow = typeof portfolioEntries.$inferSelect;

/** The gate already proved a session exists; this narrows it for handlers. */
function requireSession(c: Context<AppEnv>): SessionContext {
  const session = c.get("session");
  if (!session) throw new ApiError("unauthenticated");
  return session;
}

/** Child role (gate-checked) plus its non-null profile id. */
function requireChildId(c: Context<AppEnv>): string {
  const session = c.get("session");
  if (!session || session.kind !== "child" || !session.childId) throw new ApiError("forbidden");
  return session.childId;
}

/**
 * any-session ownership (API_SPEC §6 rules 1–2): a parent reaches the
 * family's children (404 across families), a child session only its own
 * profile — anything else answers 404 so existence never leaks.
 */
function accessibleChild(db: Db, session: SessionContext, childId: string) {
  const child = findChild(db, childId);
  if (session.kind === "parent") {
    assertFamily(session, child.familyId);
  } else if (session.childId !== child.id) {
    throw new ApiError("not_found");
  }
  return child;
}

function findArtifact(db: Db, artifactId: string): ArtifactRow | null {
  const rows = db.select().from(artifacts).where(eq(artifacts.id, artifactId)).all();
  return rows[0] ?? null;
}

function findEntry(db: Db, entryId: string): EntryRow | null {
  const rows = db.select().from(portfolioEntries).where(eq(portfolioEntries.id, entryId)).all();
  return rows[0] ?? null;
}

function artifactJson(row: ArtifactRow) {
  return {
    id: row.id,
    kind: row.kind,
    mime: row.mime,
    size_bytes: row.sizeBytes,
    file_url: `/api/v1/artifacts/${row.id}/file`,
  };
}

function entryJson(entry: EntryRow, artifact: ArtifactRow | null) {
  return {
    id: entry.id,
    child_id: entry.childId,
    artifact_id: entry.artifactId,
    title: entry.title,
    stage_at_creation: entry.stageAtCreation,
    skills: entry.skills,
    concepts: entry.concepts,
    what_i_learned: entry.whatILearned,
    what_i_would_improve: entry.whatIWouldImprove,
    created_at: entry.createdAt,
    artifact: artifact === null ? null : artifactJson(artifact),
  };
}

/** POST /artifacts (child): allowlisted type, 2 MB cap, safe SVG (T10/§6). */
export async function createArtifact(c: Context<AppEnv>): Promise<Response> {
  const childId = requireChildId(c);
  const body = zodParse(
    ArtifactUploadBody.safeParse(await readJsonBody(c, (d) => d, ARTIFACT_BODY_LIMIT)),
  );
  if (!isAllowlistedMime(body.mime)) throw new ApiError("unprocessable");
  const bytes = decodeArtifactBase64(body.data_base64);
  if (bytes === null || bytes.length === 0) throw new ApiError("invalid_request");
  if (bytes.length > MAX_ARTIFACT_BYTES) throw new ApiError("too_large");
  if (body.mime === "image/svg+xml" && !svgIsSafe(bytes.toString("utf8"))) {
    throw new ApiError("unprocessable");
  }

  const db = c.get("db");
  const now = c.get("now");
  const dir = c.get("artifactDir");
  const id = ids.artifact();
  const storageKey = `${id}.${extForMime(body.mime)}`;
  saveArtifactFile(dir, storageKey, bytes);
  try {
    db.insert(artifacts)
      .values({
        id,
        childId,
        projectInstanceId: null,
        kind: body.kind,
        mime: body.mime,
        storageKey,
        sizeBytes: bytes.length,
        meta: null,
        createdAt: now,
      })
      .run();
  } catch (err) {
    deleteArtifactFile(dir, storageKey); // never leave an orphan file
    throw err;
  }
  return c.json(
    { id, kind: body.kind, mime: body.mime, size_bytes: bytes.length, created_at: now },
    201,
  );
}

/** POST /portfolio (child): entry from an owned artifact + reflection. */
export async function createPortfolioEntry(c: Context<AppEnv>): Promise<Response> {
  const childId = requireChildId(c);
  const body = zodParse(PortfolioCreateBody.safeParse(await readJsonBody(c, (d) => d)));
  const db = c.get("db");
  const now = c.get("now");

  // Invariant 4 (DATA_MODEL): the artifact must exist and belong to this
  // child — a foreign or unknown id answers 404, no entry is written.
  const artifact = findArtifact(db, body.artifact_id);
  if (!artifact || artifact.childId !== childId) throw new ApiError("not_found");
  const existing = db
    .select()
    .from(portfolioEntries)
    .where(eq(portfolioEntries.artifactId, artifact.id))
    .all();
  if (existing.length > 0) throw new ApiError("conflict"); // one entry per artifact

  const child = findChild(db, childId);
  const id = ids.portfolio();
  db.insert(portfolioEntries)
    .values({
      id,
      childId,
      artifactId: artifact.id,
      projectInstanceId: null,
      title: body.title,
      stageAtCreation: child.stage, // server-side truth, never a client field
      skills: body.skills,
      concepts: body.concepts,
      whatILearned: body.what_i_learned ?? null,
      whatIWouldImprove: body.what_i_would_improve ?? null,
      createdAt: now,
    })
    .run();

  const created = findEntry(db, id);
  if (!created) throw new ApiError("internal");
  return c.json(entryJson(created, artifact), 201);
}

/** GET /children/:childId/portfolio (parent, child own): newest first. */
export async function listPortfolio(c: Context<AppEnv>): Promise<Response> {
  const session = requireSession(c);
  const db = c.get("db");
  const child = accessibleChild(db, session, pathParam(c, "childId"));
  const rows = db
    .select()
    .from(portfolioEntries)
    .leftJoin(artifacts, eq(portfolioEntries.artifactId, artifacts.id))
    .where(eq(portfolioEntries.childId, child.id))
    .orderBy(desc(portfolioEntries.createdAt))
    .all();
  return c.json({
    child_id: child.id,
    entries: rows.map((row) => entryJson(row.portfolio_entries, row.artifacts)),
  });
}

/** GET /portfolio/:entryId (parent, child own): detail with artifact link. */
export async function getPortfolioEntry(c: Context<AppEnv>): Promise<Response> {
  const session = requireSession(c);
  const db = c.get("db");
  const entry = findEntry(db, pathParam(c, "entryId"));
  if (!entry) throw new ApiError("not_found");
  accessibleChild(db, session, entry.childId);
  const artifact = findArtifact(db, entry.artifactId);
  return c.json(entryJson(entry, artifact));
}

/** PATCH /portfolio/:entryId (child own, parent): title and reflection only. */
export async function patchPortfolioEntry(c: Context<AppEnv>): Promise<Response> {
  const session = requireSession(c);
  const body = zodParse(PortfolioPatchBody.safeParse(await readJsonBody(c, (d) => d)));
  if (Object.keys(body).length === 0) throw new ApiError("invalid_request");
  const db = c.get("db");
  const entry = findEntry(db, pathParam(c, "entryId"));
  if (!entry) throw new ApiError("not_found");
  accessibleChild(db, session, entry.childId);

  const patch: Partial<typeof portfolioEntries.$inferInsert> = {};
  if (body.title !== undefined) patch.title = body.title;
  if (body.what_i_learned !== undefined) patch.whatILearned = body.what_i_learned;
  if (body.what_i_would_improve !== undefined) patch.whatIWouldImprove = body.what_i_would_improve;
  db.update(portfolioEntries).set(patch).where(eq(portfolioEntries.id, entry.id)).run();

  const updated = findEntry(db, entry.id);
  if (!updated) throw new ApiError("internal");
  return c.json(entryJson(updated, findArtifact(db, entry.artifactId)));
}

/** DELETE /portfolio/:entryId (parent): entry + its artifact file (§5.7). */
export async function deletePortfolioEntry(c: Context<AppEnv>): Promise<Response> {
  const session = requireParent(c);
  const db = c.get("db");
  const entry = findEntry(db, pathParam(c, "entryId"));
  if (!entry) throw new ApiError("not_found");
  const child = findChild(db, entry.childId);
  assertFamily(session, child.familyId); // cross-family delete answers 404

  const artifact = findArtifact(db, entry.artifactId);
  // One entry per artifact (unique index), so the artifact goes with it.
  db.transaction((tx) => {
    tx.delete(portfolioEntries).where(eq(portfolioEntries.id, entry.id)).run();
    if (artifact) tx.delete(artifacts).where(eq(artifacts.id, artifact.id)).run();
  });
  if (artifact) deleteArtifactFile(c.get("artifactDir"), artifact.storageKey);

  writeAudit(db, {
    actorType: "parent",
    actorId: session.userId,
    action: "portfolio.delete",
    targetType: "portfolio_entry",
    targetId: entry.id,
    meta: artifact ? { artifact_id: artifact.id } : {}, // ids only (§7)
  });
  return c.json({ deleted: true });
}

/** DELETE /artifacts/:artifactId (parent): individual artifact removal. */
export async function deleteArtifact(c: Context<AppEnv>): Promise<Response> {
  const session = requireParent(c);
  const db = c.get("db");
  const artifact = findArtifact(db, pathParam(c, "artifactId"));
  if (!artifact) throw new ApiError("not_found");
  const child = findChild(db, artifact.childId);
  assertFamily(session, child.familyId);

  // Entries must keep pointing at existing artifacts (invariant 4), so
  // removing the artifact removes the entries that reference it too.
  const entries = db
    .select()
    .from(portfolioEntries)
    .where(eq(portfolioEntries.artifactId, artifact.id))
    .all();
  db.transaction((tx) => {
    tx.delete(portfolioEntries).where(eq(portfolioEntries.artifactId, artifact.id)).run();
    tx.delete(artifacts).where(eq(artifacts.id, artifact.id)).run();
  });
  deleteArtifactFile(c.get("artifactDir"), artifact.storageKey);

  writeAudit(db, {
    actorType: "parent",
    actorId: session.userId,
    action: "artifact.delete",
    targetType: "artifact",
    targetId: artifact.id,
    meta: { entries_deleted: entries.length },
  });
  return c.json({ deleted: true, entries_deleted: entries.length });
}

/** GET /artifacts/:artifactId/file (parent, child own): safe serve (T10). */
export async function getArtifactFile(c: Context<AppEnv>): Promise<Response> {
  const session = requireSession(c);
  const db = c.get("db");
  const artifact = findArtifact(db, pathParam(c, "artifactId"));
  if (!artifact) throw new ApiError("not_found");
  accessibleChild(db, session, artifact.childId);

  const bytes = readArtifactFile(c.get("artifactDir"), artifact.storageKey);
  if (!bytes) {
    // Operational detail by id only — no personal data in logs (§3/§7).
    console.error(`[${c.get("requestId")}] missing artifact file ${artifact.id}`);
    throw new ApiError("not_found");
  }
  // Stored mime is allowlisted at upload; attachment + nosniff means nothing
  // ever renders or executes inline (SECURITY.md T10).
  c.header("Content-Type", artifact.mime);
  c.header("Content-Disposition", `attachment; filename="${artifact.storageKey}"`);
  return c.body(new Uint8Array(bytes));
}

/* -------------------------------------------------- P1-11 safety endpoints
 * API_SPEC §5.8: the parent sees safety events sorted by severity — the
 * rows derived from `ai.safety.flagged` sync events (SAFETY.md §2: every
 * blocked or redirected exchange creates a row; enum fields only, never
 * message text). Reviewing is a parent acknowledgement; it is not an
 * auth/security action, so it writes no audit row (§7 list).
 */

const SAFETY_SEVERITY_RANK: Readonly<Record<string, number>> = { high: 0, warn: 1, info: 2 };

export async function listSafetyEvents(c: Context<AppEnv>): Promise<Response> {
  const session = requireParent(c);
  const db = c.get("db");
  const child = findChild(db, pathParam(c, "childId"));
  assertFamily(session, child.familyId); // cross-family reads answer 404 (§6 rule 1)

  const rows = db.select().from(safetyEvents).where(eq(safetyEvents.childId, child.id)).all();
  const sorted = [...rows].sort((a, b) => {
    const rank = (SAFETY_SEVERITY_RANK[a.severity] ?? 3) - (SAFETY_SEVERITY_RANK[b.severity] ?? 3);
    if (rank !== 0) return rank;
    if (a.createdAt !== b.createdAt) return a.createdAt < b.createdAt ? 1 : -1; // newest first
    return a.id < b.id ? -1 : 1; // ids are time-sortable; deterministic tie-break
  });
  return c.json({
    child_id: child.id,
    events: sorted.map((row) => ({
      id: row.id,
      kind: row.kind,
      severity: row.severity,
      source: row.source,
      action_taken: row.actionTaken,
      reviewed: row.reviewedByParent === 1,
      created_at: row.createdAt,
    })),
  });
}

export async function reviewSafetyEvent(c: Context<AppEnv>): Promise<Response> {
  const session = requireParent(c);
  const db = c.get("db");
  const rows = db
    .select()
    .from(safetyEvents)
    .where(eq(safetyEvents.id, pathParam(c, "eventId")))
    .all();
  const row = rows[0];
  if (!row) throw new ApiError("not_found");
  const child = findChild(db, row.childId ?? ""); // childId is nullable in the §2 DDL
  assertFamily(session, child.familyId); // cross-family review answers 404

  db.update(safetyEvents).set({ reviewedByParent: 1 }).where(eq(safetyEvents.id, row.id)).run();
  return c.json({ id: row.id, reviewed: true });
}
