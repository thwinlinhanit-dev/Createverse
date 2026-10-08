import { useApp } from "../../AppContext";
import { useT } from "../../i18n";
import { Button, Card, Chip } from "../../components/ui";
import { useProgressStore } from "../../progress/useProgress.ts";

export default function HomePage() {
  const { profile, openProject, openStep } = useApp();
  const t = useT();
  const { store, ready } = useProgressStore(profile.id);

  // Time-of-day period for the ICU select in home.greeting (code, not copy).
  const hour = new Date().getHours();
  const period = hour < 12 ? "morning" : hour < 18 ? "afternoon" : "evening";
  const greeting = t("home.greeting", { period });

  function continueBuilding(): void {
    if (ready && store) {
      const position = store.getPosition();
      if (position && position.stepId) {
        openStep(position.projectId, position.stepId);
        return;
      }
      if (store.findOpenInstance("project.bridge")) {
        openProject("project.bridge");
        return;
      }
    }
    openProject("project.bridge");
  }

  return (
    <>
      <h2 className="cv-page-title">{greeting}</h2>
      <p className="cv-page-lead">{t("home.lead")}</p>

      <section className="cv-page-section">
        <h3 className="cv-page-section-title">{t("home.continue.title")}</h3>
        <Card label={t("project.bridge.title")} body={t("project.bridge.body")} />
        <div className="cv-page-actions">
          <Button label={t("button.continue")} onClick={continueBuilding} />
        </div>
      </section>

      <section className="cv-page-section">
        <h3 className="cv-page-section-title">{t("home.challenge.title")}</h3>
        <p className="cv-page-challenge">{t("home.challenge.body")}</p>
        <div className="cv-page-actions">
          <Button
            label={t("home.challenge.cta")}
            secondary
            onClick={() => openProject("project.bridge")}
          />
        </div>
      </section>

      <section className="cv-page-section">
        <h3 className="cv-page-section-title">{t("home.recent.title")}</h3>
        <div className="cv-page-recent">
          <Chip label={t("home.recent.bridge")} icon="projects" />
          <Chip label={t("home.recent.wood")} icon="create" />
          <Chip label={t("home.recent.seconds")} icon="speaker" />
        </div>
        <p className="cv-page-empty">{t("home.recent.empty")}</p>
      </section>
    </>
  );
}
