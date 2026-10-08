import { useApp } from "../../AppContext";
import { stageKey, useT } from "../../i18n";
import { Button, Card, Chip } from "../../components/ui";

export default function MePage() {
  const { profile, navigateTo } = useApp();
  const t = useT();

  const skills = [t("me.skill.test"), t("me.skill.planks"), t("me.skill.explain")];

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
          {skills.map((skill) => (
            <Chip key={skill} label={skill} icon="check" />
          ))}
        </div>
        <p className="cv-page-empty">{t("me.skills.empty")}</p>
      </section>

      <section className="cv-page-section">
        <h3 className="cv-page-section-title">{t("me.portfolio.title")}</h3>
        <p className="cv-page-empty">{t("me.portfolio.body")}</p>
        <div className="cv-page-empty-small">
          <Chip label={t("me.portfolio.chip")} />
        </div>
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
