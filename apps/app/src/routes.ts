/**
 * Hash-based client router for the Createverse app shell.
 *
 * Reasons for hash routing in Phase 1 (P1-03):
 *  - Works offline with no server-side route config (PWA, SW-cached shell).
 *  - No extra dependency — the requirements are a small mapping from hash to
 *    screen, which we own.
 *  - Later, when the app is served from a real origin with real paths, we can
 *    switch to pathname routing without changing page components (they receive
 *    route keys, not hashes).
 *
 * Route keys (internal, never shown to the child):
 *  - Child area: "home", "explore", "create", "projects", "me"
 *  - Parent area: "parent:overview", "parent:progress", "parent:portfolio",
 *    "parent:safety", "parent:settings"
 *
 * The parent area is route-guarded: navigating to any `/parent/...` hash first
 * shows the parent gate (P1-01 auth not built yet). Auth wiring lives in P1-01;
 * this shell only enforces that the parent area is not reachable without passing
 * the gate.
 *
 * Icons are typed from @createverse/ui (IconName) so the nav never passes a
 * string that the Icon component cannot render.
 */

import type { IconName } from "@createverse/ui";
import type { MessageKey } from "@createverse/i18n";


export type ChildRoute = "home" | "explore" | "create" | "projects" | "me";
export type ParentRoute = "parent:overview" | "parent:progress" | "parent:portfolio" | "parent:safety" | "parent:settings";
export type Route = ChildRoute | ParentRoute;

/**
 * Map a location hash to a route key. Unknown hashes fall back to the child
 * home route so the app always shows a real screen.
 */
export function routeFromHash(hash: string): Route {
  const h = hash.trim().toLowerCase();
  if (h === "" || h === "#/" || h === "#home") return "home";
  if (h === "#explore") return "explore";
  if (h === "#create") return "create";
  if (h === "#projects") return "projects";
  if (h === "#me") return "me";
  if (h === "#parent/overview") return "parent:overview";
  if (h === "#parent/progress") return "parent:progress";
  if (h === "#parent/portfolio") return "parent:portfolio";
  if (h === "#parent/safety") return "parent:safety";
  if (h === "#parent/settings") return "parent:settings";
  return "home";
}

/**
 * The hash paths the nav UI exposes to the user (for wiring nav clicks and the
 * parent rail). Used by Layout and pages; not shown to the child. Labels are
 * catalog keys (P1-02): the visible text comes from t(link.labelKey).
 */
export const CHILD_LINKS: ReadonlyArray<{ route: ChildRoute; hash: string; labelKey: MessageKey; icon: IconName }> = [
  { route: "home", hash: "#/", labelKey: "nav.child.home", icon: "home" },
  { route: "explore", hash: "#explore", labelKey: "nav.child.explore", icon: "explore" },
  { route: "create", hash: "#create", labelKey: "nav.child.create", icon: "create" },
  { route: "projects", hash: "#projects", labelKey: "nav.child.projects", icon: "projects" },
  { route: "me", hash: "#me", labelKey: "nav.child.me", icon: "me" },
];

export const PARENT_LINKS: ReadonlyArray<{ route: ParentRoute; hash: string; labelKey: MessageKey; icon: IconName }> = [
  { route: "parent:overview", hash: "#parent/overview", labelKey: "nav.parent.overview", icon: "home" },
  { route: "parent:progress", hash: "#parent/progress", labelKey: "nav.parent.progress", icon: "speaker" },
  { route: "parent:portfolio", hash: "#parent/portfolio", labelKey: "nav.parent.portfolio", icon: "projects" },
  { route: "parent:safety", hash: "#parent/safety", labelKey: "nav.parent.safety", icon: "lock" },
  { route: "parent:settings", hash: "#parent/settings", labelKey: "nav.parent.settings", icon: "lock" },
];

/** Child area routes only (bottom nav). */
export function isChildRoute(route: Route): route is ChildRoute {
  return (route === "home" || route === "explore" || route === "create" || route === "projects" || route === "me");
}

/** Parent area routes only (hidden behind the gate). */
export function isParentRoute(route: Route): route is ParentRoute {
  return route.startsWith("parent:");
}

/**
 * Navigate to a route by setting `location.hash` and letting the router pick it
 * up on the next `hashchange`. Calling code should also update any "current"
 * indicators after the route actually changes (the hook does this).
 */
export function navigateTo(hash: string): void {
  // Normalize: always start with `#`.
  const next = hash.startsWith("#") ? hash : `#${hash}`;
  if (location.hash !== next) {
    history.pushState(null, "", next);
    // Dispatch a hashchange so the router picks it up even though we already
    // applied it synchronously (the hook reads the current hash on mount and
    // on hashchange).
    window.dispatchEvent(new HashChangeEvent("hashchange"));
  }
}
