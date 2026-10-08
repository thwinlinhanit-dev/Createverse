import { and, eq, isNull } from "drizzle-orm";
import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
} from "@simplewebauthn/server";
import type {
  AuthenticationResponseJSON,
  RegistrationResponseJSON,
} from "@simplewebauthn/server";
import type { Db } from "../../db/index.ts";
import { authChallenges, passkeyCredentials, users } from "../../db/schema.ts";
import { ids } from "./ids.ts";

/**
 * WebAuthn passkey ceremonies (SECURITY.md §4 passkey-first, API_SPEC §5.1).
 * Challenges are single-use rows with a short expiry; the raw public key is
 * stored, never any private material.
 */

export interface WebAuthnConfig {
  rpName: string;
  /** e.g. "localhost" — no scheme. */
  rpID: string;
  /** Exact browser origin(s), e.g. "http://localhost:5173". */
  expectedOrigins: string[];
}

export type { AuthenticationResponseJSON, RegistrationResponseJSON } from "@simplewebauthn/server";

const CHALLENGE_TTL_MS = 5 * 60 * 1000;
/** parent+fresh window (API_SPEC §2: "a passkey confirmation in the last few minutes"). */
export const FRESH_WINDOW_MS = 5 * 60 * 1000;

function storeChallenge(
  db: Db,
  challenge: string,
  purpose: "register" | "login" | "fresh",
  refs: { userId?: string; familyId?: string },
): void {
  const now = new Date();
  db.insert(authChallenges)
    .values({
      id: ids.challenge(),
      challenge,
      purpose,
      userId: refs.userId ?? null,
      familyId: refs.familyId ?? null,
      createdAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + CHALLENGE_TTL_MS).toISOString(),
      consumedAt: null,
    })
    .run();
}

/**
 * Consumes a challenge: must exist, match purpose, belong to the expected
 * user, be unexpired and unused. Returns true on success (single-use
 * challenges defeat replay, SECURITY.md §4).
 */
export function consumeChallenge(
  db: Db,
  challenge: string,
  purpose: "register" | "login" | "fresh",
  userId: string | undefined,
  nowIso: string,
): boolean {
  const rows = db
    .select()
    .from(authChallenges)
    .where(
      and(
        eq(authChallenges.challenge, challenge),
        eq(authChallenges.purpose, purpose),
        isNull(authChallenges.consumedAt),
      ),
    )
    .all();
  const row = rows[0];
  if (!row) return false;
  if (row.expiresAt <= nowIso) return false;
  if (userId !== undefined && row.userId !== userId) return false;
  db.update(authChallenges)
    .set({ consumedAt: nowIso })
    .where(eq(authChallenges.id, row.id))
    .run();
  return true;
}

function encodeUserId(userId: string) {
  return new TextEncoder().encode(userId);
}

/** Registration options for an existing parent user (new or second passkey). */
export async function registrationOptions(
  db: Db,
  cfg: WebAuthnConfig,
  user: { id: string; email: string },
): Promise<{ options: Awaited<ReturnType<typeof generateRegistrationOptions>> }> {
  const existing = db
    .select({ id: passkeyCredentials.id })
    .from(passkeyCredentials)
    .where(eq(passkeyCredentials.userId, user.id))
    .all();
  const options = await generateRegistrationOptions({
    rpName: cfg.rpName,
    rpID: cfg.rpID,
    userName: user.email,
    userID: encodeUserId(user.id),
    userDisplayName: user.email,
    attestationType: "none",
    excludeCredentials: existing.map((c) => ({ id: c.id })),
    authenticatorSelection: { residentKey: "preferred", userVerification: "preferred" },
  });
  storeChallenge(db, options.challenge, "register", { userId: user.id });
  return { options };
}

/** Verifies a registration response and stores the credential (public key only). */
export async function verifyRegistration(
  db: Db,
  cfg: WebAuthnConfig,
  userId: string,
  response: RegistrationResponseJSON,
  nowIso: string,
): Promise<{ verified: boolean; credentialId?: string }> {
  // clientDataJSON carries the challenge we issued; decode it to consume
  // the exact single-use row before full cryptographic verification.
  const clientData = JSON.parse(
    Buffer.from(response.response.clientDataJSON, "base64url").toString("utf8"),
  ) as { challenge?: string };
  if (typeof clientData.challenge !== "string") return { verified: false };
  if (!consumeChallenge(db, clientData.challenge, "register", userId, nowIso)) {
    return { verified: false };
  }
  const result = await verifyRegistrationResponse({
    response,
    expectedChallenge: clientData.challenge,
    expectedOrigin: cfg.expectedOrigins,
    expectedRPID: cfg.rpID,
    requireUserVerification: false,
  });
  if (!result.verified) return { verified: false };
  const credential = result.registrationInfo.credential;
  db.insert(passkeyCredentials)
    .values({
      id: credential.id,
      userId,
      publicKey: Buffer.from(credential.publicKey),
      signCount: credential.counter,
      label: null,
      createdAt: nowIso,
      lastUsedAt: null,
    })
    .run();
  return { verified: true, credentialId: credential.id };
}

/** Assertion options for login (no user context yet — discoverable credentials). */
export async function loginChallengeOptions(
  db: Db,
  cfg: WebAuthnConfig,
): Promise<{ options: Awaited<ReturnType<typeof generateAuthenticationOptions>> }> {
  const options = await generateAuthenticationOptions({
    rpID: cfg.rpID,
    userVerification: "preferred",
  });
  storeChallenge(db, options.challenge, "login", {});
  return { options };
}

export interface LoginVerification {
  verified: boolean;
  userId?: string;
  familyId?: string;
  credentialId?: string;
  newCounter?: number;
}

/**
 * Verifies a login assertion: resolves the user from the credential id,
 * consumes the single-use challenge, and checks the signature.
 */
export async function verifyLogin(
  db: Db,
  cfg: WebAuthnConfig,
  response: AuthenticationResponseJSON,
  nowIso: string,
): Promise<LoginVerification> {
  const credRows = db
    .select()
    .from(passkeyCredentials)
    .where(eq(passkeyCredentials.id, response.id))
    .all();
  const credential = credRows[0];
  if (!credential) return { verified: false };
  const userRows = db
    .select()
    .from(users)
    .where(eq(users.id, credential.userId))
    .all();
  const user = userRows[0];
  if (!user) return { verified: false };

  const clientData = JSON.parse(
    Buffer.from(response.response.clientDataJSON, "base64url").toString("utf8"),
  ) as { challenge?: string };
  if (typeof clientData.challenge !== "string") return { verified: false };
  if (!consumeChallenge(db, clientData.challenge, "login", undefined, nowIso)) {
    return { verified: false };
  }

  const result = await verifyAuthenticationResponse({
    response,
    expectedChallenge: clientData.challenge,
    expectedOrigin: cfg.expectedOrigins,
    expectedRPID: cfg.rpID,
    credential: {
      id: credential.id,
      publicKey: new Uint8Array(credential.publicKey),
      counter: credential.signCount,
    },
    requireUserVerification: false,
  });
  if (!result.verified) return { verified: false };

  const newCounter = result.authenticationInfo.newCounter;
  if (newCounter > 0) {
    // Counter regression would suggest a cloned authenticator (SECURITY.md §4).
    if (newCounter < credential.signCount) return { verified: false };
    db.update(passkeyCredentials)
      .set({ signCount: newCounter, lastUsedAt: nowIso })
      .where(eq(passkeyCredentials.id, credential.id))
      .run();
  } else {
    db.update(passkeyCredentials)
      .set({ lastUsedAt: nowIso })
      .where(eq(passkeyCredentials.id, credential.id))
      .run();
  }
  return {
    verified: true,
    userId: user.id,
    familyId: user.familyId,
    credentialId: credential.id,
    newCounter,
  };
}

/**
 * Step-up (parent+fresh): verifies a fresh assertion from an already
 * authenticated parent (API_SPEC §5.1 POST /auth/fresh).
 */
export async function verifyFreshAssertion(
  db: Db,
  cfg: WebAuthnConfig,
  userId: string,
  response: AuthenticationResponseJSON,
  nowIso: string,
): Promise<{ verified: boolean }> {
  const clientData = JSON.parse(
    Buffer.from(response.response.clientDataJSON, "base64url").toString("utf8"),
  ) as { challenge?: string };
  if (typeof clientData.challenge !== "string") return { verified: false };
  if (!consumeChallenge(db, clientData.challenge, "fresh", userId, nowIso)) {
    return { verified: false };
  }
  const credRows = db
    .select()
    .from(passkeyCredentials)
    .where(and(eq(passkeyCredentials.id, response.id), eq(passkeyCredentials.userId, userId)))
    .all();
  const credential = credRows[0];
  if (!credential) return { verified: false };
  const result = await verifyAuthenticationResponse({
    response,
    expectedChallenge: clientData.challenge,
    expectedOrigin: cfg.expectedOrigins,
    expectedRPID: cfg.rpID,
    credential: {
      id: credential.id,
      publicKey: new Uint8Array(credential.publicKey),
      counter: credential.signCount,
    },
    requireUserVerification: false,
  });
  return { verified: result.verified };
}

/** Fresh assertion options for an authenticated parent (step-up challenge). */
export async function freshChallengeOptions(
  db: Db,
  cfg: WebAuthnConfig,
  userId: string,
): Promise<{ options: Awaited<ReturnType<typeof generateAuthenticationOptions>> }> {
  const userCreds = db
    .select({ id: passkeyCredentials.id })
    .from(passkeyCredentials)
    .where(eq(passkeyCredentials.userId, userId))
    .all();
  const options = await generateAuthenticationOptions({
    rpID: cfg.rpID,
    allowCredentials: userCreds.map((c) => ({ id: c.id })),
    userVerification: "preferred",
  });
  storeChallenge(db, options.challenge, "fresh", { userId });
  return { options };
}
