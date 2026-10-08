import { type ReactNode } from "react";
import { createTranslator } from "@createverse/i18n";
import { AppContext, createAppContext } from "./AppContext";
import Layout from "./Layout";
import {
  isChildRoute,
  isParentRoute,
  type ChildRoute,
  type ParentRoute,
  type Route,
} from "./routes";
import HomePage from "./pages/child/Home";
import ExplorePage from "./pages/child/Explore";
import CreatePage from "./pages/child/Create";
import ProjectsPage from "./pages/child/Projects";
import MePage from "./pages/child/Me";
import ProjectDetailPage from "./pages/child/ProjectDetail";
import StepRunnerPage from "./pages/child/StepRunner";
import OverviewPage from "./pages/parent/Overview";
import ProgressPage from "./pages/parent/Progress";
import PortfolioPage from "./pages/parent/Portfolio";
import SafetyPage from "./pages/parent/Safety";
import SettingsPage from "./pages/parent/Settings";
import ParentGateModal from "./pages/ParentGateModal";

const CHILD_PAGES: Record<ChildRoute, React.ComponentType> = {
  home: HomePage,
  explore: ExplorePage,
  create: CreatePage,
  projects: ProjectsPage,
  me: MePage,
  project: ProjectDetailPage,
  projectStep: StepRunnerPage,
};

const PARENT_PAGES: Record<ParentRoute, React.ComponentType> = {
  "parent:overview": OverviewPage,
  "parent:progress": ProgressPage,
  "parent:portfolio": PortfolioPage,
  "parent:safety": SafetyPage,
  "parent:settings": SettingsPage,
};

function pageFor(route: Route, area: "child" | "parent"): React.ComponentType | undefined {
  if (area === "child" && isChildRoute(route)) return CHILD_PAGES[route];
  if (area === "parent" && isParentRoute(route)) return PARENT_PAGES[route];
  return undefined;
}

export default function AppShell() {
  const { value } = createAppContext();
  const { route, area, isParentGateOpen } = value;
  // AppShell owns the context provider, so it binds t() directly to the
  // profile language instead of going through useT() (which needs the provider).
  const t = createTranslator(value.profile.language);

  let shell: ReactNode;
  try {
    const Page = pageFor(route, area);

    if (!Page) {
      shell = (
        <Layout>
          <div className="cv-page">
            <h2 className="cv-page-title">{t("app.fallback.title")}</h2>
            <p className="cv-page-empty">{t("app.fallback.body")}</p>
          </div>
        </Layout>
      );
    } else if (area === "parent" && isParentGateOpen) {
      shell = (
        <Layout>
          <ParentGateModal />
        </Layout>
      );
    } else {
      shell = (
        <Layout>
          <Page />
        </Layout>
      );
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    const stack = e instanceof Error ? e.stack : undefined;
    console.error("AppShell render error:", message, stack);
    shell = (
      <Layout>
        <div className="cv-page">
          <h2 className="cv-page-title">{t("app.error.title")}</h2>
          <pre className="cv-page-empty">{message}</pre>
        </div>
      </Layout>
    );
  }

  return <AppContext.Provider value={value}>{shell}</AppContext.Provider>;
}
