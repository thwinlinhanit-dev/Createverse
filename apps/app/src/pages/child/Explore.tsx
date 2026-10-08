import { useApp } from "../../AppContext";
import { useT } from "../../i18n";
import { Button, Card, Chip } from "../../components/ui";

/**
 * Explore: the project shelf. "Start" and "Read the story" both open the
 * real Build a Bridge project detail (P1-05) for the child's stage.
 */
export default function ExplorePage() {
  const { openProject } = useApp();
  const t = useT();
  const openBridge = () => openProject("project.bridge");

  return (
    <>
      <h2 className="cv-page-title">{t("explore.title")}</h2>
      <p className="cv-page-lead">{t("explore.lead")}</p>

      <section className="cv-page-section">
        <Card label={t("project.bridge.title")} body={t("project.bridge.body")} />
        <div className="cv-page-actions">
          <Button label={t("explore.start")} onClick={openBridge} />
          <Button
            label={t("explore.story")}
            secondary
            onClick={openBridge}
          />
        </div>
      </section>

      <section className="cv-page-section">
        <h3 className="cv-page-section-title">{t("explore.build.title")}</h3>
        <div className="cv-page-build">
          {[
            {
              name: t("explore.build.car"),
              icon: "create" as const,
            },
            {
              name: t("explore.build.strong"),
              icon: "projects" as const,
            },
            {
              name: t("explore.build.tune"),
              icon: "speaker" as const,
            },
          ].map((item) => (
            <Chip key={item.name} label={item.name} icon={item.icon} />
          ))}
        </div>
        <p className="cv-page-empty">{t("explore.empty")}</p>
      </section>
    </>
  );
}
