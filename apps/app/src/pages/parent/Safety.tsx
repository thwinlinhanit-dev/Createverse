import { useT } from "../../i18n";
import { Card, Chip } from "../../components/ui";

export default function SafetyPage() {
  const t = useT();

  return (
    <>
      <h2 className="cv-page-title">{t("safety.title")}</h2>
      <p className="cv-page-lead">{t("safety.lead")}</p>

      <section className="cv-page-section">
        <h3 className="cv-page-section-title">{t("safety.settings.title")}</h3>
        <Card label={t("safety.ai.label")} body={t("safety.ai.body")} />
        <Card label={t("safety.risk.label")} body={t("safety.risk.body")} />
        <Card label={t("safety.realworld.label")} body={t("safety.realworld.body")} />
      </section>

      <section className="cv-page-section">
        <h3 className="cv-page-section-title">{t("safety.events.title")}</h3>
        <p className="cv-page-empty">{t("safety.events.empty")}</p>
        <div className="cv-page-empty-small">
          <Chip label={t("safety.events.chip")} />
        </div>
      </section>

      <section className="cv-page-section">
        <h3 className="cv-page-section-title">{t("safety.how.title")}</h3>
        <div className="cv-parent-meta">
          <Chip label={t("safety.how.input")} />
          <Chip label={t("safety.how.output")} />
          <Chip label={t("safety.how.age")} />
          <Chip label={t("safety.how.privacy")} />
        </div>
        <p className="cv-page-empty">{t("safety.how.body")}</p>
      </section>
    </>
  );
}
