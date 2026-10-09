import { createHash } from "node:crypto";
import type { ReplayAssessment } from "@createverse/learning-core";
import type { Context, Next } from "hono";
import { eq } from "drizzle-orm";
import { ApiError, errorBody } from "./errors.ts";
import type { Role } from "./routeTable.ts";
import type { SessionContext } from "../modules/identity/sessions.ts";
import { resolveSession } from "../modules/identity/sessions.ts";
import { FRESH_WINDOW_MS } from "../modules/identity/passkeys.ts";
import type { WebAuthnConfig } from "../modules/identity/passkeys.ts";
import type { Db } from "../db/index.ts";
import { devices } from "../db/schema.ts";

/**
 * Request context attached by middleware (API_SPEC §2 roles).
 * `session` is set for any-session/parent/child roles; `deviceId` for the
 * device-credential role; `requestId` identifies the request in errors/logs.
 * `db`, `setupSecret` and `allowedOrigin` are per-app config injected once.
 */
export interface AppVars {
  requestId: string;
  session: SessionContext | null;
  deviceId: string | null;
  now: string;
  db: Db;
  setupSecret: string | null;
  allowedOrigin: string | null;
  webauthn: WebAuthnConfig;
  /** Content inputs for the parent overview (API_SPEC §5.8); injected once per app. */
  overviewContent: OverviewContent | null;
}

export interface AppEnv {
  Variables: AppVars;
}

/** Constant-time string compare for secrets. */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

/** Device credentials are stored only as SHA-256 hashes (SECURITY.md §6). */
export function hashCredential(cred: string): string {
  return createHash("sha256").update(cred).digest("hex");
}

/**
 * Resolves the bearer session token (Authorization header — keeps the API
 * stateless and testable; the PWA holds the token in memory only).
 * Expired/revoked tokens resolve to null (SECURITY.md §4).
 */
function readSession(c: Context<AppEnv>): SessionContext | null {
  const header = c.req.header("authorization");
  if (!header || !header.toLowerCase().startsWith("bearer ")) return null;
  const token = header.slice(7).trim();
  if (!token) return null;
  return resolveSession(c.get("db"), token, c.get("now"));
}

/** Device credential: X-Device-Credential header, resolved to a live device. */
function readDevice(c: Context<AppEnv>): string | null {
  const cred = c.req.header("x-device-credential");
  if (!cred) return null;
  const rows = c
    .get("db")
    .select()
    .from(devices)
    .where(eq(devices.credentialHash, hashCredential(cred)))
    .all();
  const device = rows[0];
  if (!device || device.revokedAt !== null) return null;
  return device.id;
}

/**
 * Role gate — deny by default (SECURITY.md §5). Errors follow API_SPEC §3:
 * 401 unauthenticated (no/expired session), 401 fresh_auth_required (step-up
 * window passed), 403 forbidden (wrong role — e.g. child calling a parent
 * endpoint, API_SPEC §6 rule 2).
 *
 * Also stamps requestId/session/deviceId on every request and runs the
 * per-route rate limit (API_SPEC §4).
 */
export function requireRole(
  role: Role,
  limit?: { kind: "auth" | "session" | "device" | "none"; max: number; windowMs: number },
) {
  return async (c: Context<AppEnv>, next: Next): Promise<Response | void> => {
    const session = readSession(c);
    const deviceId = readDevice(c);
    c.set("session", session);
    c.set("deviceId", deviceId);

    if (limit && limit.kind !== "none") {
      const limited = applyRateLimit(c, limit);
      if (limited) return limited;
    }

    if (role === "public") return next();

    if (role === "any-session") {
      if (!session) return unauthenticated(c);
      return next();
    }

    if (role === "device") {
      // A parent/child session alone is not a device credential (API_SPEC §2).
      if (!deviceId) return unauthenticated(c);
      return next();
    }

    if (!session) return unauthenticated(c);

    if (role === "parent" || role === "parent+fresh") {
      if (session.kind !== "parent") return forbidden(c);
      if (role === "parent+fresh") {
        const freshAt = session.freshAt ? Date.parse(session.freshAt) : 0;
        if (Date.parse(c.get("now")) - freshAt > FRESH_WINDOW_MS) {
          return c.json(errorBody("fresh_auth_required", c.get("requestId")), 401);
        }
      }
      return next();
    }

    if (role === "child") {
      if (session.kind !== "child") return forbidden(c);
      return next();
    }

    return forbidden(c);
  };
}

function unauthenticated(c: Context<AppEnv>): Response {
  return c.json(errorBody("unauthenticated", c.get("requestId")), 401);
}

function forbidden(c: Context<AppEnv>): Response {
  return c.json(errorBody("forbidden", c.get("requestId")), 403);
}

/** Asserts the resolved session is a parent session (handlers' second line). */
export function requireParent(c: Context<AppEnv>): SessionContext {
  const session = c.get("session");
  if (!session || session.kind !== "parent") throw new ApiError("forbidden");
  return session;
}

/**
 * Asserts family ownership of a row (API_SPEC §6 rule 1: never trust ids).
 * Uses 404 rather than 403 to avoid leaking existence across families.
 */
export function assertFamily(session: SessionContext, rowFamilyId: string): void {
  if (session.familyId !== rowFamilyId) throw new ApiError("not_found");
}

/**
 * In-memory fixed-window rate limiter (API_SPEC §4: auth 10/min per IP,
 * others 120/min per session). Single-process only — acceptable for the
 * private family deployment; a multi-isolate deployment needs a shared store
 * (recorded as a known limitation in the task file).
 */
const buckets = new Map<string, { count: number; resetAt: number }>();

function applyRateLimit(
  c: Context<AppEnv>,
  limit: { kind: "auth" | "session" | "device" | "none"; max: number; windowMs: number },
): Response | null {
  const now = Date.now();
  let key: string;
  if (limit.kind === "auth") {
    key = `auth:${c.req.header("x-forwarded-for") ?? c.req.header("x-real-ip") ?? "local"}`;
  } else if (limit.kind === "device") {
    key = `device:${c.get("deviceId") ?? "none"}`;
  } else {
    key = `session:${c.get("session")?.id ?? "anon"}`;
  }
  const entry = buckets.get(key);
  if (!entry || entry.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + limit.windowMs });
    return null;
  }
  entry.count += 1;
  if (entry.count > limit.max) {
    c.header("Retry-After", String(Math.ceil((entry.resetAt - now) / 1000)));
    return c.json(errorBody("rate_limited", c.get("requestId")), 429);
  }
  return null;
}

/** Test hook: clear limiter state between test cases. */
export function resetRateLimits(): void {
  buckets.clear();
}

/**
 * Response headers: no-store on API responses (API_SPEC §1) and
 * same-origin CORS only — a foreign Origin is rejected outright, matching
 * "CORS: only the app's own origin" (API_SPEC §1, SECURITY.md §8).
 */
export function securityHeaders(): (c: Context<AppEnv>, next: Next) => Promise<void> {
  return async (c, next) => {
    c.header("Cache-Control", "no-store");
    c.header("X-Content-Type-Options", "nosniff");
    const origin = c.req.header("origin");
    const allowed = c.get("allowedOrigin");
    if (origin && allowed) {
      if (origin !== allowed) throw new ApiError("forbidden");
      c.header("Access-Control-Allow-Origin", allowed);
      c.header("Vary", "Origin");
      c.header(
        "Access-Control-Allow-Headers",
        "content-type, authorization, x-device-credential",
      );
      c.header("Access-Control-Allow-Methods", "GET, POST, PATCH, DELETE, OPTIONS");
    }
    await next();
  };
}

/** Reads and parses a JSON body, enforcing the 64 KB cap (API_SPEC §4). */
export async function readJsonBody<T>(
  c: Context<AppEnv>,
  parse: (data: unknown) => T,
): Promise<T> {
  const contentLength = Number(c.req.header("content-length") ?? "0");
  if (contentLength > 64 * 1024) throw new ApiError("too_large");
  let data: unknown;
  try {
    data = await c.req.json();
  } catch {
    throw new ApiError("invalid_request");
  }
  if (JSON.stringify(data).length > 64 * 1024) throw new ApiError("too_large");
  return parse(data);
}

/** Zod parse result → invalid_request on failure (API_SPEC §3). */
export function zodParse<T>(result: { success: boolean; data?: T }): T {
  if (!result.success) throw new ApiError("invalid_request");
  return result.data as T;
}

/** Verifies the one-time setup secret for bootstrap (API_SPEC §5.1). */
export function checkSetupSecret(c: Context<AppEnv>, provided: string): boolean {
  const expected = c.get("setupSecret");
  if (!expected) return false;
  return safeEqual(provided, expected);
}

/* ---------------------------------------------------- P1-10 step-up helpers
 * Conditional freshness for endpoints where only some fields need the
 * step-up window (API_SPEC §5.3: "parent (+fresh for safety and AI fields)").
 * The role gate covers whole-route freshness; this covers per-body decisions.
 */

export function assertFresh(c: Context<AppEnv>, session: SessionContext): void {
  const freshAt = session.freshAt ? Date.parse(session.freshAt) : 0;
  if (Date.parse(c.get("now")) - freshAt > FRESH_WINDOW_MS) {
    throw new ApiError("fresh_auth_required");
  }
}

/**
 * Content inputs for the parent overview (API_SPEC §5.8). Injected once per
 * app — the compiled content bundle in production, fixtures in tests. Without
 * it the endpoint still serves event-derived evidence (default skill levels,
 * no content-aware suggestions).
 */
export interface OverviewContent {
  /** Skill id → configured level count (content/graph/skills.json). */
  readonly levelsBySkill?: Readonly<Record<string, number>>;
  /** Content assessments resolving event signals to skills/concepts (§2.5). */
  readonly assessments?: readonly ReplayAssessment[];
  /** Ordered experience ids; suggestions are the first uncompleted ones. */
  readonly experienceOrder?: readonly string[];
}
