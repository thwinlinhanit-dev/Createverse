import { useState } from "react";
import { useApp } from "../../AppContext";
import { stageAgeKey, useT } from "../../i18n";
import { Button, Chip } from "../../components/ui";
import {
  getLiveAiChoice,
  setLiveAiChoice,
  type LiveAiChoice,
} from "../../mentor/settings.ts";

export default function SettingsPage() {
  const { profile, setProfileStage, setProfileLanguage } = useApp();
  const t = useT();
  // P1-07: the parent live-AI switch is real — MentorService reads it on
  // every request (default off; Junior is never allowed regardless).
  const [liveChoice, setLiveChoice] = useState<LiveAiChoice>(() => getLiveAiChoice());

  function chooseLiveAi(choice: LiveAiChoice): void {
    setLiveAiChoice(choice);
    setLiveChoice(choice);
  }

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
          <Chip
            label={t("settings.ai.off")}
            selected={liveChoice === "off"}
            onClick={() => chooseLiveAi("off")}
          />
          <Chip
            label={t("settings.ai.explorer")}
            selected={liveChoice === "explorer"}
            onClick={() => chooseLiveAi("explorer")}
          />
          <Chip
            label={t("settings.ai.maker")}
            selected={liveChoice === "maker"}
            onClick={() => chooseLiveAi("maker")}
          />
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
          {/* P1-12 shipped the tested API behind these (API_SPEC §5.10); they
              stay disabled until the app-side identity task (P1-18) wires a
              parent session client — the app has no parent login yet. */}
          <Button label={t("settings.export.action")} secondary disabled />
          <Button label={t("settings.delete.action")} secondary disabled />
        </div>
        <p className="cv-page-empty">{t("settings.export.body")}</p>
      </section>
    </>
  );
}
