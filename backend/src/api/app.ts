import { Hono } from "hono";
import type { AppEnv, OverviewContent } from "./middleware.ts";
import { requireRole, securityHeaders } from "./middleware.ts";
import { ROUTES, fullPath } from "./routeTable.ts";
import { ApiError, errorBody } from "./errors.ts";
import type { Db } from "../db/index.ts";
import type { WebAuthnConfig } from "../modules/identity/passkeys.ts";
import * as handlers from "./handlers.ts";

export interface AppOptions {
  db: Db;
  /** One-time setup secret for POST /setup/bootstrap (null disables setup). */
  setupSecret: string | null;
  /** Only this origin may call the API with CORS (API_SPEC §1). */
  allowedOrigin: string | null;
  webauthn: WebAuthnConfig;
  /** Content inputs for the parent overview (compiled bundle; fixtures in tests). */
  overviewContent?: OverviewContent;
  /** Artifact file directory (P1-09); defaults to `var/artifacts`. */
  artifactDir?: string;
  /** Injectable clock for tests. */
  now?: () => Date;
  /** Rate-limit overrides (API_SPEC §4 defaults shown in LIMITS). */
  limits?: Partial<typeof LIMITS>;
}

/**
 * Rate limits (API_SPEC §4): auth 10/min per IP, others 120/min per session.
 */
const LIMITS = {
  auth: { kind: "auth" as const, max: 10, windowMs: 60_000 },
  session: { kind: "session" as const, max: 120, windowMs: 60_000 },
  device: { kind: "device" as const, max: 30, windowMs: 60_000 },
  none: { kind: "none" as const, max: 0, windowMs: 60_000 },
};

/** Handler lookup keyed by "METHOD path" from the route table. */
const HANDLERS: Record<string, (c: Parameters<typeof handlers.health>[0]) => Promise<Response>> = {
  "POST /setup/bootstrap": handlers.bootstrap,
  "POST /auth/passkeys/register/options": handlers.registerOptions,
  "POST /auth/passkeys/register/verify": handlers.registerVerify,
  "POST /auth/login/options": handlers.loginOptions,
  "POST /auth/login/verify": handlers.loginVerify,
  "POST /auth/fresh": handlers.freshVerify,
  "POST /auth/logout": handlers.logout,
  "GET /auth/session": handlers.getSession,
  "GET /family": handlers.getFamily,
  "GET /devices": handlers.listDevices,
  "POST /devices": handlers.registerDevice,
  "DELETE /devices/:deviceId": handlers.revokeDevice,
  "GET /children": handlers.listChildren,
  "POST /children": handlers.createChild,
  "PATCH /children/:childId": handlers.patchChild,
  "PATCH /children/:childId/pin": handlers.setPin,
  "POST /children/:childId/open": handlers.openChild,
  "POST /sync/events": handlers.syncEvents,
  "GET /children/:childId/export/events": handlers.exportChildEvents,
  "GET /children/:childId/export/portfolio": handlers.exportChildPortfolio,
  "POST /children/:childId/delete": handlers.deleteChild,
  "POST /children/:childId/delete/cancel": handlers.cancelChildDelete,
  "POST /family/delete": handlers.familyDelete,
  "GET /audit": handlers.listAudit,
  "GET /children/:childId/overview": handlers.getChildOverview,
  "PATCH /children/:childId/settings": handlers.patchChildSettings,
  "POST /artifacts": handlers.createArtifact,
  "POST /portfolio": handlers.createPortfolioEntry,
  "GET /children/:childId/portfolio": handlers.listPortfolio,
  "GET /portfolio/:entryId": handlers.getPortfolioEntry,
  "PATCH /portfolio/:entryId": handlers.patchPortfolioEntry,
  "DELETE /portfolio/:entryId": handlers.deletePortfolioEntry,
  "DELETE /artifacts/:artifactId": handlers.deleteArtifact,
  "GET /artifacts/:artifactId/file": handlers.getArtifactFile,
  "GET /children/:childId/safety-events": handlers.listSafetyEvents,
  "POST /safety-events/:eventId/review": handlers.reviewSafetyEvent,
  "GET /health": handlers.health,
};

export function createApp(options: AppOptions): Hono<AppEnv> {
  const app = new Hono<AppEnv>();
  const limits = { ...LIMITS, ...options.limits };

  // Per-app config + request identity on every request.
  app.use("*", async (c, next) => {
    c.set("db", options.db);
    c.set("setupSecret", options.setupSecret);
    c.set("allowedOrigin", options.allowedOrigin);
    c.set("requestId", `r_${crypto.randomUUID()}`);
    c.set("session", null);
    c.set("deviceId", null);
    c.set("now", (options.now?.() ?? new Date()).toISOString());
    c.set("webauthn", options.webauthn);
    c.set("overviewContent", options.overviewContent ?? null);
    c.set("artifactDir", options.artifactDir ?? "var/artifacts");
    await next();
  });
  app.use("*", securityHeaders());

  // Register every route from the table with its declared role + limit.
  for (const route of ROUTES) {
    const handler = HANDLERS[`${route.method} ${route.path}`];
    if (!handler) {
      throw new Error(`No handler for ${route.method} ${route.path}`);
    }
    const gate = requireRole(route.role, limits[route.limit ?? "session"]);
    app.on(route.method, fullPath(route), gate, async (c) => handler(c));
  }

  // Step-up challenge (empty body) and verification (assertion body) share
  // the single POST /auth/fresh route from API_SPEC §5.1 — already registered
  // from the table above.

  // CORS preflight for the app origin. Returns via the context so the
  // securityHeaders middleware's CORS headers are applied — a raw Response
  // would drop them and break browser preflights of Authorization requests.
  app.options("*", (c) => c.body(null, 204));

  // Unknown routes → 404 envelope (deny by default, SECURITY.md §5).
  app.notFound((c) =>
    c.json(errorBody("not_found", c.get("requestId") ?? "r_unknown"), 404),
  );

  // Error envelope (API_SPEC §3); anything unexpected is a generic 500.
  app.onError((err, c) => {
    const requestId = c.get("requestId") ?? "r_unknown";
    if (err instanceof ApiError) {
      return c.json(errorBody(err.code, requestId), err.status as 400);
    }
    // Operational detail goes to the log by request id only (API_SPEC §3).
    console.error(`[${requestId}]`, err instanceof Error ? err.message : err);
    return c.json(errorBody("internal", requestId), 500);
  });

  return app;
}
