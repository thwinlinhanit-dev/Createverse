import { useApp } from "../../AppContext";
import { useT } from "../../i18n";
import { Button, Card, Chip } from "../../components/ui";

export default function CreatePage() {
  const { openProject } = useApp();
  const t = useT();

  return (
    <>
      <h2 className="cv-page-title">{t("create.title")}</h2>
      <p className="cv-page-lead">{t("create.lead")}</p>

      <section className="cv-page-section">
        <h3 className="cv-page-section-title">{t("create.mine")}</h3>
        <p className="cv-page-empty">{t("create.empty")}</p>
        <div className="cv-page-empty-small">
          <Chip label={t("create.noChips")} />
        </div>
      </section>

      <section className="cv-page-section">
        <h3 className="cv-page-section-title">{t("create.quick")}</h3>
        <div className="cv-page-quick">
          <Card label={t("project.bridge.title")} body={t("project.bridge.body")} />
          <div className="cv-page-actions">
            <Button
              label={t("create.start")}
              onClick={() => openProject("project.bridge")}
            />
          </div>
        </div>
        <p className="cv-page-empty">{t("create.note")}</p>
      </section>
    </>
  );
}
