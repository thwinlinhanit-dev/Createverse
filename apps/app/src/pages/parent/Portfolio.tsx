import { useApp } from "../../AppContext";
import { useT } from "../../i18n";
import { Button, Card, Chip } from "../../components/ui";
import { useProgressStore } from "../../progress/useProgress.ts";

/**
 * Portfolio: local entries created when a project completes (P1-05).
 * Each entry points at its artifact record (DATA_MODEL invariant 4).
 * Uploads, parent deletion and the "see artifacts" action arrive with P1-09.
 */
export default function PortfolioPage() {
  const { profile } = useApp();
  const t = useT();
  const { store, ready } = useProgressStore(profile.id);

  const entries = ready && store ? store.getPortfolio() : [];

  function dayOf(iso: string): string {
    try {
      return new Date(iso).toLocaleDateString(profile.language);
    } catch {
      return iso;
    }
  }

  return (
    <>
      <h2 className="cv-page-title">{t("portfolio.title")}</h2>
      <p className="cv-page-lead">{t("portfolio.lead")}</p>

      <section className="cv-page-section">
        <h3 className="cv-page-section-title">{t("portfolio.entries.title")}</h3>
        {entries.length === 0 ? (
          <>
            <p className="cv-page-empty">{t("portfolio.entries.empty")}</p>
            <div className="cv-page-empty-small">
              <Chip label={t("portfolio.entries.chip")} />
            </div>
          </>
        ) : (
          entries.map((entry) => (
            <div key={entry.id}>
              <Card
                label={entry.title}
                body={`${entry.whatILearned || t("runner.finish.body")} · ${dayOf(entry.createdAt)}`}
              />
            </div>
          ))
        )}
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
          {/* Enabled with P1-09 artifact uploads; entries already exist locally. */}
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
