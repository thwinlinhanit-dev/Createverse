import { useApp } from "../../AppContext";
import { stageAgeKey, useT } from "../../i18n";
import { Button, Card, Chip } from "../../components/ui";
import { useBundle } from "../../content/useBundle.ts";
import { useProgressStore } from "../../progress/useProgress.ts";

/**
 * Overview: learning evidence first, time last (DESIGN_SYSTEM §7).
 * Completed-project count, concepts and skills are real on-device data
 * (P1-05 store); interests and suggestions stay descriptive until P1-06.
 */
export default function OverviewPage() {
  const { profile, navigateTo } = useApp();
  const t = useT();
  const stage = profile.stage === "parent" ? null : profile.stage;
  const { bundle } = useBundle(profile.language, stage ?? "junior");
  const { store, ready } = useProgressStore(profile.id);

  const summary = ready && store ? store.summary() : null;
  const stageLabel = t(stageAgeKey(profile.stage));

  function conceptName(id: string): string {
    const node = bundle?.graph.concepts.find((c) => c.id === id);
    const key = node?.name_key;
    if (key && bundle) return bundle.messages[key] ?? id;
    return id;
  }

  function skillName(id: string): string {
    const node = bundle?.graph.skills.find((s) => s.id === id);
    const key = node?.name_key;
    if (key && bundle) return bundle.messages[key] ?? id;
    return id;
  }

  const concepts = summary && summary.conceptsSeen.length > 0
    ? summary.conceptsSeen.map(conceptName).join(" · ")
    : null;
  const skills = summary && summary.skillsPracticed.length > 0
    ? summary.skillsPracticed.map(skillName).join(" · ")
    : null;
  const completed = summary?.completedCount ?? 0;

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
          body={concepts ?? t("overview.concepts.body")}
        />
        <Card label={t("overview.skills.label")} body={skills ?? t("overview.skills.body")} />
      </section>

      <section className="cv-page-section">
        <h3 className="cv-page-section-title">{t("overview.completed.title")}</h3>
        <div className="cv-parent-meta">
          <Chip label={String(completed)} />
          <Chip label={t("project.bridge.title")} />
        </div>
        <p className="cv-page-empty">
          {t("overview.completed.count", { count: completed })}
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
