import { useApp } from "../../AppContext";
import { useT } from "../../i18n";
import { Button, Card, Chip } from "../../components/ui";
import { useBundle } from "../../content/useBundle.ts";
import { useProgressStore } from "../../progress/useProgress.ts";

/**
 * Projects: active and finished work with real on-device state (P1-05).
 * "Continue" resumes the persisted runner position; finished projects list
 * completed instances. Before anything starts, the bridge card offers Start.
 */
export default function ProjectsPage() {
  const { profile, openProject, openStep, navigateTo } = useApp();
  const t = useT();
  const stage = profile.stage === "parent" ? null : profile.stage;
  const { bundle } = useBundle(profile.language, stage ?? "junior");
  const { store, ready } = useProgressStore(profile.id);

  const summary = ready && store ? store.summary() : null;
  const openInstances =
    summary?.projects.filter((p) => p.state === "in_progress" || p.state === "paused") ?? [];
  const finishedInstances =
    summary?.projects.filter((p) => p.state === "completed") ?? [];

  function titleFor(projectId: string): string {
    const project = bundle?.projects.find((p) => p.id === projectId);
    const key = project?.title_key;
    if (key && bundle) return bundle.messages[key] ?? projectId;
    return t("project.bridge.title");
  }

  function continueProject(projectId: string): void {
    // Same pre-ready guard as the render paths: getPosition() throws until
    // load() resolves, and a click can land in that window.
    if (!ready || !store || !bundle || stage === null) {
      openProject(projectId);
      return;
    }
    const position = store.getPosition();
    if (position && position.projectId === projectId && position.stepId) {
      openStep(projectId, position.stepId);
      return;
    }
    const project = bundle.projects.find((p) => p.id === projectId);
    const lane = project?.lanes[stage];
    const instance = store.findOpenInstance(projectId);
    const attempts = instance ? store.getAttempts(instance.id) : [];
    const done = new Set(attempts.filter((a) => a.outcome !== null).map((a) => a.stepId));
    const next = lane?.steps.find((id) => !done.has(id)) ?? lane?.steps[0];
    if (next) openStep(projectId, next);
    else openProject(projectId);
  }

  return (
    <>
      <h2 className="cv-page-title">{t("projects.title")}</h2>
      <p className="cv-page-lead">{t("projects.lead")}</p>

      <section className="cv-page-section">
        <h3 className="cv-page-section-title">{t("projects.inProgress")}</h3>
        {openInstances.length === 0 ? (
          <>
            <Card label={t("project.bridge.title")} body={t("project.bridge.body")} />
            <div className="cv-page-actions">
              <Button
                label={t("project.detail.start")}
                onClick={() => openProject("project.bridge")}
              />
              <Button
                label={t("projects.seeWork")}
                secondary
                onClick={() => navigateTo("#me")}
              />
            </div>
          </>
        ) : (
          openInstances.map((item) => (
            <div key={item.projectId}>
              <Card
                label={titleFor(item.projectId)}
                body={t("runner.stepOf", { current: item.stepsDone + 1, total: item.stepsTotal })}
              />
              <div className="cv-page-actions">
                <Button
                  label={t("button.continue")}
                  onClick={() => continueProject(item.projectId)}
                />
                <Button
                  label={t("projects.seeWork")}
                  secondary
                  onClick={() => navigateTo("#me")}
                />
              </div>
            </div>
          ))
        )}
      </section>

      <section className="cv-page-section">
        <h3 className="cv-page-section-title">{t("projects.finished")}</h3>
        {finishedInstances.length === 0 ? (
          <>
            <p className="cv-page-empty">{t("projects.finishedEmpty")}</p>
            <div className="cv-page-empty-small">
              <Chip label={t("projects.noFinished")} />
            </div>
          </>
        ) : (
          finishedInstances.map((item) => (
            <div key={item.projectId}>
              <Card label={titleFor(item.projectId)} body={t("runner.step.state.done")} />
              <div className="cv-page-actions">
                <Button
                  label={t("runner.portfolio.view")}
                  onClick={() => navigateTo("#me")}
                />
              </div>
            </div>
          ))
        )}
      </section>

      <section className="cv-page-section">
        <h3 className="cv-page-section-title">{t("projects.what")}</h3>
        <p className="cv-page-empty">{t("projects.whatBody")}</p>
        <Chip label={t("projects.chip.story")} icon="book" />
        <Chip label={t("projects.chip.try")} icon="create" />
        <Chip label={t("projects.chip.challenge")} icon="speaker" />
        <Chip label={t("projects.chip.think")} icon="lock" />
      </section>
    </>
  );
}
