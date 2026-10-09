import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { isParentRoute, routeFromHash, type Route } from "./routes";

/**
 * App shell context.
 *
 * Holds the bits of state the whole shell shares:
 *  - a placeholder child profile (stage + language) until P1-01/P1-02 wire a real
 *    profile from the backend; the header switchers drive it for the demo.
 *    The profile's `language` is the app's only locale source (ADR-0008) —
 *    `useT()` in `./i18n.ts` binds packages/i18n to it.
 *  - the current route (derived from `location.hash`)
 *  - parent-gate state: the parent area is not reachable without passing the gate
 *    (P1-01 auth). Entering the parent area from the child area opens the gate;
 *    navigating between parent routes does not re-open it.
 */

export interface ChildProfile {
  readonly id: string;
  readonly displayName: string;
  readonly stage: "junior" | "explorer" | "maker" | "parent";
  readonly language: "en" | "zh-Hant";
  /**
   * Simple-language mode (DESIGN_SYSTEM §8, P1-13): shorter `<key>.simple`
   * copy where the catalogs ship it. A profile-level preference like stage
   * and language — the translator in ./i18n.ts binds it.
   */
  readonly simpleLanguage: boolean;
}

interface AppState {
  readonly profile: ChildProfile;
  readonly route: Route;
  readonly area: "child" | "parent";
  readonly isParentGateOpen: boolean;
  /** P1-05 runner selection: which project (and step) the runner screens show. */
  readonly projectId: string | null;
  readonly stepId: string | null;
}

interface AppActions {
  setProfileStage: (stage: ChildProfile["stage"]) => void;
  setProfileLanguage: (language: ChildProfile["language"]) => void;
  setProfileSimpleLanguage: (simpleLanguage: boolean) => void;
  confirmParentGate: () => void;
  navigateTo: (hash: string) => void;
  openProject: (projectId: string) => void;
  openStep: (projectId: string, stepId: string) => void;
}

type AppContextValue = AppState & AppActions;

export const AppContext = createContext<AppContextValue | null>(null);

export const useApp = (): AppContextValue => {
  const ctx = useContext(AppContext);
  if (ctx === null) {
    throw new Error("useApp must be used inside <AppShell>");
  }
  return ctx;
};

const DEFAULT_PROFILE: ChildProfile = {
  id: "child-placeholder",
  // Profile data, not UI copy: shown only once real profiles arrive (P1-01+
  // backend). Not a catalog key.
  displayName: "Child",
  stage: "junior",
  language: "en",
  simpleLanguage: false,
};

export function createAppContext(initialProfile: ChildProfile = DEFAULT_PROFILE) {
  const [profile, setProfileRaw] = useState<ChildProfile>(initialProfile);
  const [route, setRoute] = useState<Route>(() => routeFromHash(location.hash));
  const [isParentGateOpen, setIsParentGateOpen] = useState(false);
  const [wereInParent, setWereInParent] = useState(false);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [stepId, setStepId] = useState<string | null>(null);

  const setProfileStage = (stage: ChildProfile["stage"]) =>
    setProfileRaw((prev) =>
      prev.stage !== stage ? { ...prev, stage } : prev,
    );

  const setProfileLanguage = (language: ChildProfile["language"]) =>
    setProfileRaw((prev) =>
      prev.language !== language ? { ...prev, language } : prev,
    );

  const setProfileSimpleLanguage = (simpleLanguage: boolean) =>
    setProfileRaw((prev) =>
      prev.simpleLanguage !== simpleLanguage ? { ...prev, simpleLanguage } : prev,
    );

  const confirmParentGate = () => setIsParentGateOpen(false);

  const navigateTo = (hash: string) => {
    const next = hash.startsWith("#") ? hash : `#${hash}`;
    if (location.hash !== next) {
      history.pushState(null, "", next);
      window.dispatchEvent(new HashChangeEvent("hashchange"));
    }
  };

  const openProject = (nextProjectId: string) => {
    setProjectId(nextProjectId);
    setStepId(null);
    navigateTo("#project");
  };

  const openStep = (nextProjectId: string, nextStepId: string) => {
    setProjectId(nextProjectId);
    setStepId(nextStepId);
    navigateTo("#project/step");
  };

  // Keep `route` in sync with the browser hash (back/forward buttons, deep links).
  useEffect(() => {
    function apply() {
      setRoute(routeFromHash(location.hash));
    }
    apply();
    window.addEventListener("hashchange", apply);
    return () => window.removeEventListener("hashchange", apply);
  }, []);

  // Screen readers must follow the language switch (DESIGN_SYSTEM §8: labels in
  // both languages). The shell sets <div lang> per area; keep the document-level
  // lang in sync too so assistive tech picks the right voice/pronunciation.
  useEffect(() => {
    document.documentElement.lang = profile.language;
  }, [profile.language]);

  // Parent-gate logic: entering the parent area from the child area opens the
  // gate; internal parent navigation does not re-open it.
  useEffect(() => {
    const nextArea: "child" | "parent" = isParentRoute(route) ? "parent" : "child";
    if (nextArea === "parent") {
      if (!wereInParent && !isParentGateOpen) {
        setIsParentGateOpen(true);
      }
      setWereInParent(true);
    } else {
      setWereInParent(false);
      setIsParentGateOpen(false);
    }
  }, [route]);

  const area: "child" | "parent" = isParentRoute(route) ? "parent" : "child";

  const value = useMemo(
    () => ({
      profile,
      route,
      area,
      isParentGateOpen,
      projectId,
      stepId,
      setProfileStage,
      setProfileLanguage,
      setProfileSimpleLanguage,
      confirmParentGate,
      navigateTo,
      openProject,
      openStep,
    }),
    [
      profile,
      route,
      area,
      isParentGateOpen,
      projectId,
      stepId,
      setProfileStage,
      setProfileLanguage,
      setProfileSimpleLanguage,
      confirmParentGate,
      navigateTo,
      openProject,
      openStep,
    ],
  );

  return { value, setProfileRaw };
}

export type AppShellValue = ReturnType<typeof createAppContext>["value"];
