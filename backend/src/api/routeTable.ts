/**
 * Route table — the single source of truth for endpoints and their required
 * role (API_SPEC §5). The app registers handlers from this table, and the
 * authorization-matrix test (TESTING.md §6) is generated from it, so a new
 * endpoint cannot skip its role declaration or its matrix row.
 */

export type Role =
  | "public"
  | "parent"
  | "parent+fresh"
  | "child"
  | "device"
  | "any-session";

export type RouteMethod = "GET" | "POST" | "PATCH" | "DELETE";

export interface RouteDef {
  method: RouteMethod;
  /** Hono path pattern under /api/v1 (e.g. "/children/:childId"). */
  path: string;
  role: Role;
  /**
   * Rate-limit bucket (API_SPEC §4): auth routes are limited per IP,
   * others per session. Defaults to "session".
   */
  limit?: "auth" | "session" | "device" | "none";
  /** Human note from API_SPEC §5 for docs/debugging. */
  note?: string;
}

export const ROUTES: RouteDef[] = [
  // API_SPEC §5.1 — setup and authentication
  { method: "POST", path: "/setup/bootstrap", role: "public", limit: "auth", note: "Create family + first parent, needs setup secret" },
  { method: "POST", path: "/auth/passkeys/register/options", role: "parent+fresh", limit: "auth", note: "Registration ceremony options" },
  { method: "POST", path: "/auth/passkeys/register/verify", role: "parent+fresh", limit: "auth", note: "Store new passkey" },
  { method: "POST", path: "/auth/login/options", role: "public", limit: "auth", note: "Assertion options" },
  { method: "POST", path: "/auth/login/verify", role: "public", limit: "auth", note: "Open parent session" },
  { method: "POST", path: "/auth/fresh", role: "parent", limit: "auth", note: "Step-up confirmation" },
  { method: "POST", path: "/auth/logout", role: "any-session", limit: "none", note: "End the session" },
  { method: "GET", path: "/auth/session", role: "any-session", limit: "none", note: "Role, family id, child id" },

  // API_SPEC §5.2 — family and devices
  { method: "GET", path: "/family", role: "parent", limit: "session", note: "Family info, guardians" },
  { method: "GET", path: "/devices", role: "parent", limit: "session", note: "List devices" },
  { method: "POST", path: "/devices", role: "parent+fresh", limit: "session", note: "Register this device" },
  { method: "DELETE", path: "/devices/:deviceId", role: "parent+fresh", limit: "session", note: "Revoke device + sessions" },

  // API_SPEC §5.3 — children and settings (P1-01 subset: profiles, PIN)
  { method: "GET", path: "/children", role: "parent", limit: "session", note: "List profiles" },
  { method: "POST", path: "/children", role: "parent+fresh", limit: "session", note: "Create child (child cannot self-register)" },
  { method: "PATCH", path: "/children/:childId", role: "parent", limit: "session", note: "Edit name, stage, locale, avatar" },
  { method: "PATCH", path: "/children/:childId/pin", role: "parent+fresh", limit: "session", note: "Set or clear PIN" },
  { method: "POST", path: "/children/:childId/open", role: "device", limit: "auth", note: "Open child profile on device" },

  // API_SPEC §5.11 — health
  { method: "GET", path: "/health", role: "public", limit: "none", note: "Liveness" },
];

/** Full path as registered on the app (base path API_SPEC §1). */
export function fullPath(route: RouteDef): string {
  return `/api/v1${route.path}`;
}
