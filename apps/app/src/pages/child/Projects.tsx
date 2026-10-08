import { useApp } from "../../AppContext";
import { useT } from "../../i18n";
import { Button, Card, Chip } from "../../components/ui";

export default function ProjectsPage() {
  const { navigateTo } = useApp();
  const t = useT();

  return (
    <>
      <h2 className="cv-page-title">{t("projects.title")}</h2>
      <p className="cv-page-lead">{t("projects.lead")}</p>

      <section className="cv-page-section">
        <h3 className="cv-page-section-title">{t("projects.inProgress")}</h3>
        <Card label={t("project.bridge.title")} body={t("project.bridge.body")} />
        <div className="cv-page-actions">
          <Button label={t("button.continue")} onClick={() => navigateTo("#explore")} />
          <Button
            label={t("projects.seeWork")}
            secondary
            onClick={() => navigateTo("#me")}
          />
        </div>
      </section>

      <section className="cv-page-section">
        <h3 className="cv-page-section-title">{t("projects.finished")}</h3>
        <p className="cv-page-empty">{t("projects.finishedEmpty")}</p>
        <div className="cv-page-empty-small">
          <Chip label={t("projects.noFinished")} />
        </div>
      </section>

      <section className="cv-page-section">
        <h3 className="cv-page-section-title">{t("projects.what")}</h3>
        <p className="cv-page-empty">{t("projects.whatBody")}</p>
        <Chip label={t("projects.chip.story")} icon="book" />
        <Chip label={t("projects.chip.try")} icon="create" />
        <Chip label={t("projects.chip.challenge")} icon="speaker" />
        <Chip label={t("projects.chip.think")} icon="lock" />
      </section>
    </>
  );
}
