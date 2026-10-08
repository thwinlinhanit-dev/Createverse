import { type ReactNode } from "react";
import { CHILD_LINKS, PARENT_LINKS } from "./routes";
import { useApp } from "./AppContext";
import { stageKey, useT } from "./i18n";
import Icon from "./Icon";

/**
 * Shell chrome for the whole app.
 *
 * Composition follows DESIGN_SYSTEM §4 / §7:
 *  - Child area: top header (brand + stage + language) + single-column main +
 *    bottom nav on compact (phone portrait), 5 items, current item has icon +
 *    label + shape/color change, not color alone.
 *  - Parent area: clearer, denser (§7). A top rail with parent links replaces the
 *    child bottom nav; parent pages sit in a denser layout where useful. Sensitive
 *    actions use the ParentGate component from @createverse/ui.
 *
 * Safe areas: the bottom nav respects the home indicator on phones
 * (env(safe-area-inset-bottom)). The layout uses CSS variables only
 * (var(--cv-*)); no inline hex in components (DESIGN_SYSTEM §10).
 *
 * Every string comes from packages/i18n via t("key") (ADR-0008, P1-02); the
 * brand is intentionally not translated (invariant proper name).
 */
export default function Layout({ children }: { children: ReactNode }) {
  const { profile, route, area, navigateTo, setProfileStage, setProfileLanguage } =
    useApp();
  const t = useT();

  const onNav = (hash: string) => () => navigateTo(hash);
  const toggleLanguage = () =>
    setProfileLanguage(profile.language === "en" ? ("zh-Hant" as const) : ("en" as const));

  // Brand stays Latin in both languages (no invented Chinese brand name).
  const brand = "Createverse";
  const childTag = t("layout.tagline.child");
  const parentTag = t("layout.tagline.parent");

  const stageLabel = t("layout.stage");
  const languageLabel = t("layout.language");
  const childNavLabel = t("nav.child.aria");
  const parentNavLabel = t("nav.parent.aria");

  if (area === "parent") {
    return (
      <div
        className="cv-app cv-parent-layout"
        data-stage={profile.stage}
        lang={profile.language}
      >
        <header className="cv-header cv-parent-header">
          <div className="cv-header-inner">
            <div className="cv-brand">
              <h1 className="cv-title">{brand}</h1>
              <p className="cv-tag">{parentTag}</p>
            </div>
            <div className="cv-controls">
              <div className="cv-control">
                <span className="cv-control-label" id="parent-stage-label">
                  {stageLabel}
                </span>
                <div className="cv-segment" role="group" aria-labelledby="parent-stage-label">
                  <StageChip
                    stage={profile.stage}
                    currentStage={profile.stage}
                    onChange={(stage) => {
                      // A parent sets the child's stage in real life (P1-02); for the
                      // shell demo the header switcher drives it. A real parent setting
                      // page would gate this behind the parent gate.
                      setProfileStage(stage);
                      navigateTo("#parent/overview");
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
        </header>

        <nav className="cv-parent-rail" aria-label={parentNavLabel}>
          {PARENT_LINKS.map((link) => {
            const active = route === link.route;
            const label = t(link.labelKey);
            return (
              <button
                key={link.hash}
                type="button"
                className={`cv-nav-item cv-parent-rail-item${
                  active ? " cv-nav-item--active" : ""
                }`}
                aria-current={active ? "page" : undefined}
                onClick={onNav(link.hash)}
              >              <span className="cv-nav-icon">
                {/* Visible text label below = the accessible name; icon is decoration. */}
                <Icon name={link.icon} />
              </span>
              <span className="cv-nav-label">{label}</span>
            </button>
          );
          })}
        </nav>

        <main className="cv-parent-main">
          <div className="cv-page cv-parent-page">{children}</div>
        </main>
      </div>
    );
  }

  // Child area.
  return (
    <div
      className="cv-app cv-child-layout"
      data-stage={profile.stage}
      lang={profile.language}
    >
      <header className="cv-header">
        <div className="cv-header-inner">
          <div className="cv-brand">
            <h1 className="cv-title">{brand}</h1>
            <p className="cv-tag">{childTag}</p>
          </div>
          <div className="cv-controls">
            <div className="cv-control">
              <span className="cv-control-label" id="stage-label">
                {stageLabel}
              </span>
              <div className="cv-segment" role="group" aria-labelledby="stage-label">
                <StageChip
                  stage={profile.stage}
                  currentStage={profile.stage}
                  onChange={(stage) => {
                    // Switching stage follows the child's profile in real life (P1-02);
                    // the header switcher drives it for the demo.
                    setProfileStage(stage);
                    navigateTo("#/");
                  }}
                />
              </div>
            </div>
            <div className="cv-control">
              <span className="cv-control-label" id="lang-label">
                {languageLabel}
              </span>
              <div className="cv-segment" role="group" aria-labelledby="lang-label">
                <LanguageChip language={profile.language} onChange={toggleLanguage} />
              </div>
            </div>
          </div>
        </div>
      </header>

      <nav className="cv-nav" aria-label={childNavLabel}>
        {CHILD_LINKS.map((link) => {
          const active = route === link.route;
          const label = t(link.labelKey);
          return (
            <button
              key={link.hash}
              type="button"
              className={`cv-nav-item${active ? " cv-nav-item--active" : ""}`}
              aria-current={active ? "page" : undefined}
              onClick={onNav(link.hash)}
            >
              <span className="cv-nav-icon">
                {/* Visible text label below = the accessible name; icon is decoration. */}
                <Icon name={link.icon} />
              </span>
              <span className="cv-nav-label">{label}</span>
            </button>
          );
        })}
      </nav>

      <main className="cv-main">
        <div className="cv-page">{children}</div>
      </main>
    </div>
  );
}

// ---- small chip controls ----

function StageChip({
  stage,
  currentStage,
  onChange,
}: {
  stage: "junior" | "explorer" | "maker" | "parent";
  currentStage: "junior" | "explorer" | "maker" | "parent";
  onChange: (stage: "junior" | "explorer" | "maker" | "parent") => void;
}) {
  const t = useT();
  const pressed = stage === currentStage;
  return (
    <button
      type="button"
      className={`cv-stage-chip${pressed ? " cv-stage-chip--active" : ""}`}
      aria-pressed={pressed}
      onClick={() => onChange(stage)}
    >
      {t(stageKey(stage))}
    </button>
  );
}

function LanguageChip({
  language,
  onChange,
}: {
  language: "en" | "zh-Hant";
  onChange: () => void;
}) {
  const t = useT();
  return (
    <div className="cv-segment" role="group" aria-label={t("layout.language")}>
      <button
        type="button"
        className={`cv-lang-chip${language === "en" ? " cv-lang-chip--active" : ""}`}
        aria-pressed={language === "en"}
        onClick={onChange}
      >
        {language === "en" ? t("lang.zhHant") : t("lang.en")}
      </button>
      <button
        type="button"
        className={`cv-lang-chip${language === "zh-Hant" ? " cv-lang-chip--active" : ""}`}
        aria-pressed={language === "zh-Hant"}
        onClick={onChange}
      >
        {language === "en" ? t("lang.en") : t("lang.zhHant")}
      </button>
    </div>
  );
}
