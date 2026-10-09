import { CONCEPT_MAX_LEVEL } from "@createverse/shared-types";
import { DEFAULT_SKILL_LEVELS } from "@createverse/learning-core";
import { useApp } from "../../AppContext";
import { stageAgeKey, useT } from "../../i18n";
import { Button, Card, Chip } from "../../components/ui";
import { useBundle } from "../../content/useBundle.ts";
import { useProgressStore } from "../../progress/useProgress.ts";

/**
 * Overview: learning evidence first, time last (DESIGN_SYSTEM §7).
 * Completed-project count is real on-device data (P1-05 store); concepts and
 * skills render the P1-06 evidence rows replayed from the event log — numeric
 * levels live here because FR-40 is the parent view (the child's Me screen
 * keeps "no levels", PRODUCT_SPEC §Me). Interests and suggestions stay
 * descriptive until P1-10's server-backed slice.
 */
export default function OverviewPage() {
  const { profile, navigateTo } = useApp();
  const t = useT();
  const stage = profile.stage === "parent" ? null : profile.stage;
  const { bundle } = useBundle(profile.language, stage ?? "junior");
  const { store, ready } = useProgressStore(profile.id);

  const summary = ready && store ? store.summary() : null;
  const stageLabel = t(stageAgeKey(profile.stage));

  // P1-06 evidence replay: configured skill levels and assessment signals
  // come from the content bundle; the store itself never holds content.
  const levelsBySkill: Record<string, number> = bundle
    ? Object.fromEntries(bundle.graph.skills.map((s) => [s.id, s.levels] as const))
    : {};
  const evidence =
    ready && store
      ? store.skillEvidence({ levelsBySkill, assessments: bundle?.assessments ?? [] })
      : null;

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

  // Evidence rows (name + numeric level + evidence count) are the headline;
  // summary names remain as the fallback for logs written before P1-06.
  const conceptRowText = (evidence?.concepts ?? []).map((row) =>
    t("overview.concepts.row", {
      name: conceptName(row.conceptId),
      level: row.level,
      levels: CONCEPT_MAX_LEVEL,
    }),
  );
  const skillRowText = (evidence?.skills ?? []).map((row) =>
    t("overview.skills.row", {
      name: skillName(row.skillId),
      level: row.level,
      levels: levelsBySkill[row.skillId] ?? DEFAULT_SKILL_LEVELS,
      count: row.evidenceCount,
    }),
  );

  const concepts =
    conceptRowText.length > 0
      ? conceptRowText.join(" · ")
      : summary && summary.conceptsSeen.length > 0
        ? summary.conceptsSeen.map(conceptName).join(" · ")
        : null;
  const skills =
    skillRowText.length > 0
      ? skillRowText.join(" · ")
      : summary && summary.skillsPracticed.length > 0
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
