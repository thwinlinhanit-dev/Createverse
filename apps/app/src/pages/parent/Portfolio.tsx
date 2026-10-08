import { useT } from "../../i18n";
import { Button, Chip } from "../../components/ui";

export default function PortfolioPage() {
  const t = useT();

  return (
    <>
      <h2 className="cv-page-title">{t("portfolio.title")}</h2>
      <p className="cv-page-lead">{t("portfolio.lead")}</p>

      <section className="cv-page-section">
        <h3 className="cv-page-section-title">{t("portfolio.entries.title")}</h3>
        <p className="cv-page-empty">{t("portfolio.entries.empty")}</p>
        <div className="cv-page-empty-small">
          <Chip label={t("portfolio.entries.chip")} />
        </div>
      </section>

      <section className="cv-page-section">
        <h3 className="cv-page-section-title">{t("portfolio.contains.title")}</h3>
        <div className="cv-parent-meta">
          <Chip label={t("portfolio.contains.design")} />
          <Chip label={t("portfolio.contains.testlog")} />
          <Chip label={t("portfolio.contains.reflection")} />
        </div>
        <p className="cv-page-empty">{t("portfolio.entries.body")}</p>
        <div className="cv-page-actions">
          {/* Disabled until P1-09 ships portfolio entries and artifacts. */}
          <Button label={t("portfolio.entries.action")} secondary disabled />
        </div>
      </section>

      <section className="cv-page-section">
        <h3 className="cv-page-section-title">{t("portfolio.access.title")}</h3>
        <p className="cv-page-empty">{t("portfolio.access.body")}</p>
      </section>
    </>
  );
}
