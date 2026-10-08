/**
 * Authorization matrix (TESTING.md §6, SECURITY.md §5).
 *
 * The matrix is generated from ROUTES — the same table the app registers
 * handlers from — so a new endpoint cannot skip its role declaration: every
 * route is exercised under five credential scenarios (anonymous, fresh
 * parent, child session, device credential only, stale step-up window) and
 * must either pass the role gate or deny with the exact API_SPEC §3 error.
 */
import type { Hono } from "hono";
import { beforeEach, describe, expect, it } from "vitest";
import { ROUTES, fullPath } from "../src/api/routeTable.ts";
import type { Role, RouteDef } from "../src/api/routeTable.ts";
import type { AppEnv } from "../src/api/middleware.ts";
import {
  backdateFresh,
  buildApp,
  jsonHeaders,
  openChildSession,
  readJson,
  resetLimits,
  seedChild,
  seedDevice,
  seedFamily,
} from "./helpers.ts";
import type { FlowState } from "./helpers.ts";

type Expectation =
  | { allow: true }
  | { allow: false; status: number; code: string };

const allow: Expectation = { allow: true };
function deny(status: number, code: string): Expectation {
  return { allow: false, status, code };
}

interface Scenario {
  name: string;
  headers: () => Record<string, string>;
  expected: (role: Role) => Expectation;
}

const scenarios: Scenario[] = [
  {
    name: "anonymous",
    headers: () => ({}),
    expected: (role) =>
      role === "public" ? allow : deny(401, "unauthenticated"),
  },
  {
    name: "parent session (fresh)",
    headers: () => auth(state.parentToken),
    expected: (role) => {
      if (role === "child") return deny(403, "forbidden");
      if (role === "device") return deny(401, "unauthenticated");
      return allow; // public, parent, parent+fresh, any-session
    },
  },
  {
    name: "child session",
    headers: () => auth(state.childToken),
    expected: (role) => {
      if (role === "parent" || role === "parent+fresh") {
        return deny(403, "forbidden");
      }
      if (role === "device") return deny(401, "unauthenticated");
      return allow; // public, child, any-session
    },
  },
  {
    name: "device credential only",
    headers: () => ({ "x-device-credential": state.deviceCredential }),
    expected: (role) =>
      role === "public" || role === "device"
        ? allow
        : deny(401, "unauthenticated"),
  },
  {
    name: "parent session (step-up window expired)",
    headers: () => auth(state.staleToken),
    expected: (role) => {
      if (role === "parent+fresh") return deny(401, "fresh_auth_required");
      if (role === "parent" || role === "any-session" || role === "public") {
        return allow;
      }
      if (role === "child") return deny(403, "forbidden");
      return deny(401, "unauthenticated"); // device
    },
  },
];

function auth(token: string): Record<string, string> {
  return { authorization: `Bearer ${token}` };
}

interface State extends FlowState {
  childToken: string;
  deviceCredential: string;
}

let state: State;

/** Placeholder id for :param routes — matches no row → handler 400/404. */
const MISSING = "x_missing";

async function callRoute(
  app: Hono<AppEnv>,
  route: RouteDef,
  headers: Record<string, string>,
): Promise<Response> {
  const path = fullPath(route).replace(/:\w+/g, MISSING);
  const init: RequestInit = { method: route.method, headers: jsonHeaders(headers) };
  if (route.method === "POST" || route.method === "PATCH") init.body = "{}";
  return await app.request(path, init);
}

/**
 * POST /auth/logout is exercised last: it revokes the very session the
 * scenario authenticates with, and the matrix reads role-gate results in
 * table order (every route is still covered exactly once).
 */
function routeOrder(): RouteDef[] {
  const logout = ROUTES.filter((r) => r.path === "/auth/logout");
  const rest = ROUTES.filter((r) => r.path !== "/auth/logout");
  return [...rest, ...logout];
}

beforeEach(async () => {
  resetLimits();
  const { app, db } = buildApp();
  const family = await seedFamily(app);
  backdateFresh(db, family.staleToken);
  const device = await seedDevice(app, family.parentToken);
  const childId = await seedChild(app, family.parentToken);
  const openRes = await openChildSession(app, device.credential, childId);
  if (openRes.status !== 200) throw new Error(`child open failed: ${openRes.status}`);
  state = {
    ...family,
    childToken: (await readJson(openRes)).session_token as string,
    deviceCredential: device.credential,
  };
  currentApp = app;
});

let currentApp: Hono<AppEnv>;

describe("authorization matrix (generated from ROUTES)", () => {
  it("covers every route in the table", () => {
    expect(ROUTES.length).toBeGreaterThanOrEqual(18);
    const roles = new Set(ROUTES.map((r) => r.role));
    expect(roles.has("public")).toBe(true);
    expect(roles.has("parent")).toBe(true);
    expect(roles.has("parent+fresh")).toBe(true);
    expect(roles.has("device")).toBe(true);
    expect(roles.has("any-session")).toBe(true);
  });

  for (const scenario of scenarios) {
    it(`${scenario.name}: each route enforces its declared role`, async () => {
      const headers = scenario.headers();
      for (const route of routeOrder()) {
        const label = `${route.method} ${fullPath(route)} [${route.role}]`;
        const res = await callRoute(currentApp, route, headers);
        const expected = scenario.expected(route.role);
        if (expected.allow) {
          // The role gate passed. Handlers may still answer 400/404/409 —
          // those prove the request got past authentication/authorization.
          expect(
            res.status === 401 || res.status === 403,
            `${label} should pass the role gate, got ${res.status}`,
          ).toBe(false);
        } else {
          expect(res.status, label).toBe(expected.status);
          const body = await readJson(res);
          const error = body.error as
            | { code?: unknown; message?: unknown; request_id?: unknown }
            | undefined;
          expect(error, label).toBeDefined();
          expect(error?.code, label).toBe(expected.code);
          expect(typeof error?.message, label).toBe("string");
          expect(String(error?.request_id ?? ""), label).toMatch(/^r_/);
        }
      }
    });
  }
});
