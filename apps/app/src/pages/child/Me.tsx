import { useApp } from "../../AppContext";
import { stageKey, useT } from "../../i18n";
import { Button, Card, Chip } from "../../components/ui";
import { useBundle } from "../../content/useBundle.ts";
import { useProgressStore } from "../../progress/useProgress.ts";

/**
 * Me: real growth evidence from the on-device store (P1-05).
 * Practiced skills resolve to their bundle names; portfolio entries show
 * finished work. Empty states keep the shipped copy until the child builds.
 */
export default function MePage() {
  const { profile, navigateTo } = useApp();
  const t = useT();
  const stage = profile.stage === "parent" ? null : profile.stage;
  const { bundle } = useBundle(profile.language, stage ?? "junior");
  const { store, ready } = useProgressStore(profile.id);

  const summary = ready && store ? store.summary() : null;
  const entries = ready && store ? store.getPortfolio() : [];

  function skillName(id: string): string {
    const skill = bundle?.graph.skills.find((s) => s.id === id);
    const key = skill?.name_key;
    if (key && bundle) return bundle.messages[key] ?? id;
    return id;
  }

  const realSkills = summary && summary.skillsPracticed.length > 0
    ? summary.skillsPracticed.map(skillName)
    : null;
  const staticSkills = [t("me.skill.test"), t("me.skill.planks"), t("me.skill.explain")];

  // Preserves the shipped copy: en labels the card "Stage", zh labels it with
  // the stage name itself (the body names the stage in both locales).
  const aboutLabel =
    profile.language === "en" ? t("layout.stage") : t(stageKey(profile.stage));

  return (
    <>
      <h2 className="cv-page-title">{t("me.title")}</h2>
      <p className="cv-page-lead">{t("me.lead")}</p>

      <section className="cv-page-section">
        <h3 className="cv-page-section-title">{t("me.skills.title")}</h3>
        <div className="cv-page-skills">
          {(realSkills ?? staticSkills).map((skill) => (
            <Chip key={skill} label={skill} icon="check" />
          ))}
        </div>
        {realSkills ? null : <p className="cv-page-empty">{t("me.skills.empty")}</p>}
      </section>

      <section className="cv-page-section">
        <h3 className="cv-page-section-title">{t("me.portfolio.title")}</h3>
        {entries.length === 0 ? (
          <>
            <p className="cv-page-empty">{t("me.portfolio.body")}</p>
            <div className="cv-page-empty-small">
              <Chip label={t("me.portfolio.chip")} />
            </div>
          </>
        ) : (
          entries.map((entry) => (
            <Card
              key={entry.id}
              label={entry.title}
              body={entry.whatILearned || t("runner.finish.body")}
            />
          ))
        )}
      </section>

      <section className="cv-page-section">
        <h3 className="cv-page-section-title">{t("me.about.title")}</h3>
        <Card
          label={aboutLabel}
          body={t("me.about.body", { stage: t(stageKey(profile.stage)) })}
        />
        <div className="cv-page-actions">
          <Button
            label={t("me.back")}
            secondary
            onClick={() => navigateTo("#/")}
          />
        </div>
      </section>
    </>
  );
}
