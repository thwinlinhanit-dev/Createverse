import { useApp } from "../../AppContext";
import { stageAgeKey, useT } from "../../i18n";
import { Button, Chip } from "../../components/ui";

export default function SettingsPage() {
  const { profile, setProfileStage, setProfileLanguage } = useApp();
  const t = useT();

  const stageOptions = [
    { value: "junior" as const, label: t(stageAgeKey("junior")) },
    { value: "explorer" as const, label: t(stageAgeKey("explorer")) },
    { value: "maker" as const, label: t(stageAgeKey("maker")) },
  ];

  return (
    <>
      <h2 className="cv-page-title">{t("settings.title")}</h2>
      <p className="cv-page-lead">{t("settings.lead")}</p>

      <section className="cv-page-section">
        <h3 className="cv-page-section-title">{t("settings.stage.title")}</h3>
        <div className="cv-settings-group">
          {stageOptions.map((opt) => (
            <Chip
              key={opt.value}
              label={opt.label}
              selected={profile.stage === opt.value}
              onClick={() => {
                setProfileStage(opt.value);
              }}
            />
          ))}
        </div>
        <p className="cv-page-empty">{t("settings.stage.body")}</p>
      </section>

      <section className="cv-page-section">
        <h3 className="cv-page-section-title">{t("settings.lang.title")}</h3>
        <div className="cv-settings-group">
          <Chip
            label={t("lang.en")}
            selected={profile.language === "en"}
            onClick={() => setProfileLanguage("en")}
          />
          <Chip
            label={t("lang.zhHant")}
            selected={profile.language === "zh-Hant"}
            onClick={() => setProfileLanguage("zh-Hant")}
          />
        </div>
        <p className="cv-page-empty">{t("settings.lang.body")}</p>
      </section>

      <section className="cv-page-section">
        <h3 className="cv-page-section-title">{t("settings.time.title")}</h3>
        <p className="cv-page-empty">{t("settings.time.body")}</p>
        <div className="cv-settings-group">
          <Chip label={t("settings.time.none")} />
          <Chip label={t("settings.time.hour1")} />
          <Chip label={t("settings.time.hour2")} />
        </div>
      </section>

      <section className="cv-page-section">
        <h3 className="cv-page-section-title">{t("settings.ai.title")}</h3>
        <div className="cv-settings-group">
          <Chip label={t("settings.ai.off")} selected={true} />
          <Chip label={t("settings.ai.explorer")} />
          <Chip label={t("settings.ai.maker")} />
        </div>
        <p className="cv-page-empty">{t("settings.ai.body")}</p>
      </section>

      <section className="cv-page-section">
        <h3 className="cv-page-section-title">{t("settings.read.title")}</h3>
        <div className="cv-settings-group">
          <Chip label={t("settings.read.junior")} selected />
          <Chip label={t("settings.read.explorer")} />
          <Chip label={t("settings.read.off")} />
        </div>
        <p className="cv-page-empty">{t("settings.read.body")}</p>
      </section>

      <section className="cv-page-section">
        <h3 className="cv-page-section-title">{t("settings.export.title")}</h3>
        <div className="cv-page-actions">
          {/* Disabled until P1-12 ships export/delete; the copy below says so. */}
          <Button label={t("settings.export.action")} secondary disabled />
          <Button label={t("settings.delete.action")} secondary disabled />
        </div>
        <p className="cv-page-empty">{t("settings.export.body")}</p>
      </section>
    </>
  );
}
