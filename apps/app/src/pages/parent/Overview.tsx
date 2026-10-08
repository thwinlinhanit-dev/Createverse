import { useApp } from "../../AppContext";
import { stageAgeKey, useT } from "../../i18n";
import { Button, Card, Chip } from "../../components/ui";

export default function OverviewPage() {
  const { profile, navigateTo } = useApp();
  const t = useT();

  const stageLabel = t(stageAgeKey(profile.stage));

  return (
    <>
      <h2 className="cv-page-title">{t("overview.title")}</h2>
      <p className="cv-page-lead">{t("overview.lead")}</p>

      <section className="cv-parent-grid">
        <Card
          label={t("overview.stage.label")}
          body={t("overview.stage.body", { stage: stageLabel })}
        />
        <Card
          label={t("overview.concepts.label")}
          body={t("overview.concepts.body")}
        />
        <Card label={t("overview.skills.label")} body={t("overview.skills.body")} />
      </section>

      <section className="cv-page-section">
        <h3 className="cv-page-section-title">{t("overview.completed.title")}</h3>
        <div className="cv-parent-meta">
          <Chip label="0" />
          <Chip label={t("project.bridge.title")} />
        </div>
        <p className="cv-page-empty">
          {t("overview.completed.count", { count: 0 })}
        </p>
      </section>

      <section className="cv-page-section">
        <h3 className="cv-page-section-title">{t("overview.interests.title")}</h3>
        <div className="cv-parent-meta">
          <Chip label={t("overview.interests.likes")} />
          <Chip label={t("overview.interests.struggles")} />
        </div>
        <p className="cv-page-empty">{t("overview.interests.empty")}</p>
      </section>

      <section className="cv-page-section">
        <h3 className="cv-page-section-title">{t("overview.suggest.title")}</h3>
        <div className="cv-parent-suggest">
          <Card label={t("project.bridge.title")} body={t("project.bridge.body")} />
          <div className="cv-page-actions">
            <Button
              label={t("overview.suggest.open")}
              onClick={() => navigateTo("#parent/progress")}
            />
          </div>
        </div>
      </section>

      <section className="cv-page-section">
        <h3 className="cv-page-section-title">{t("overview.time.title")}</h3>
        <p className="cv-page-empty">{t("overview.time.body")}</p>
      </section>
    </>
  );
}
