import { useT } from "../../i18n";
import { Card, Chip } from "../../components/ui";

export default function ProgressPage() {
  const t = useT();

  return (
    <>
      <h2 className="cv-page-title">{t("progress.title")}</h2>
      <p className="cv-page-lead">{t("progress.lead")}</p>

      <section className="cv-parent-grid">
        <Card
          label={t("progress.activities.label")}
          body={t("progress.activities.body")}
        />
        <Card label={t("progress.last.label")} body={t("progress.last.body")} />
      </section>

      <section className="cv-page-section">
        <h3 className="cv-page-section-title">{t("progress.recent.title")}</h3>
        <p className="cv-page-empty">{t("progress.recent.empty")}</p>
        <div className="cv-page-empty-small">
          <Chip label={t("progress.recent.chip")} />
        </div>
      </section>

      <section className="cv-page-section">
        <h3 className="cv-page-section-title">{t("progress.how.title")}</h3>
        <p className="cv-page-empty">{t("progress.how.body")}</p>
        <Chip label={t("progress.how.saved")} />
        <Chip label={t("progress.how.offline")} />
        <Chip label={t("progress.how.notime")} />
      </section>
    </>
  );
}
