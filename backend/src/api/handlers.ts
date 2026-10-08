import { z } from "zod";
import { eq } from "drizzle-orm";
import type { Context } from "hono";
import type { AppEnv } from "./middleware.ts";
import {
  assertFamily,
  checkSetupSecret,
  hashCredential,
  readJsonBody,
  requireParent,
  zodParse,
} from "./middleware.ts";
import { ApiError } from "./errors.ts";
import type { Db } from "../db/index.ts";
import { childSettings, children, devices, families, users } from "../db/schema.ts";
import { ids, newToken } from "../modules/identity/ids.ts";
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
