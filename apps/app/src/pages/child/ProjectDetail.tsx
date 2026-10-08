import type { ContentBundle } from "@createverse/shared-types";
import { useApp } from "../../AppContext";
import { useT } from "../../i18n";
import { Button, Card } from "../../components/ui";
import { useBundle } from "../../content/useBundle.ts";
import { syncNow, useProgressStore } from "../../progress/useProgress.ts";

/**
 * Project detail: story → mission → lane steps (P1-05 state machine entry).
 * Loads the bundle for the child's (locale, stage) and shows the correct
 * Build a Bridge lane; Start/Continue opens the runner at the first
 * unfinished step. Draft content carries a grown-up preview notice
 * (SAFETY.md §9/§13: never silently served as approved).
 */
export default function ProjectDetailPage() {
  const { profile, projectId, navigateTo, openStep } = useApp();
  const t = useT();
  const stage = profile.stage === "parent" ? null : profile.stage;
  // Hooks cannot branch: load the junior bundle as a placeholder when the
  // profile has no child stage; the guard below renders the error instead.
  const { bundle, error, retry } = useBundle(profile.language, stage ?? "junior");
  const { store, ready } = useProgressStore(profile.id);

  const project = bundle ? projectOf(bundle, projectId) : undefined;
  if (stage === null || error !== null || (bundle !== null && project === undefined)) {
    return (
      <section className="cv-page">
        <h2 className="cv-page-title">{t("runner.loadError.title")}</h2>
        <p className="cv-page-empty">{t("runner.loadError.body")}</p>
        <div className="cv-page-actions">
          <Button label={t("runner.retry")} onClick={retry} />
          <Button label={t("runner.back")} secondary onClick={() => navigateTo("#projects")} />
        </div>
      </section>
    );
  }

  if (bundle === null || !ready || store === null || project === undefined) {
    return (
      <section className="cv-page">
        <h2 className="cv-page-title">{t("runner.loading")}</h2>
      </section>
    );
  }

  const lane = project.lanes[stage];
  const steps = lane.steps
    .map((id) => bundle.steps.find((s) => s.id === id))
    .filter((s) => s !== undefined);
  const messages = bundle.messages;
  const instance = store.findOpenInstance(project.id);
  const attempts = instance ? store.getAttempts(instance.id) : [];
  const done = new Set(attempts.filter((a) => a.outcome !== null).map((a) => a.stepId));
  const firstOpen = lane.steps.find((id) => !done.has(id)) ?? lane.steps[0] ?? null;
  const finished = instance?.state === "completed";

  function begin(): void {
    if (firstOpen === null || stage === null) return;
    const activeStore = store;
    const activeProject = project;
    const activeLane = lane;
    if (activeStore === null || activeProject === undefined || activeLane === undefined) return;
    void activeStore
      .startProject(activeProject.id, stage, activeProject.version, activeLane.steps)
      .then(() => {
        openStep(activeProject.id, firstOpen);
        void syncNow(activeStore);
      });
  }

  return (
    <>
      <div className="cv-page-actions">
        <Button label={t("runner.back")} secondary onClick={() => navigateTo("#projects")} />
      </div>
      <h2 className="cv-page-title">{messages[project.title_key] ?? project.title_key}</h2>

      {project.status !== "approved" ? (
        <section className="cv-notice" aria-label={t("runner.draft.title")}>
          <h3>{t("runner.draft.title")}</h3>
          <p>{t("runner.draft.body")}</p>
        </section>
      ) : null}

      <section className="cv-page-section">
        <h3 className="cv-page-section-title">{t("project.detail.story")}</h3>
        <Card
          label={messages[project.story_key] ?? project.story_key}
          body={messages[project.mission_key] ?? project.mission_key}
        />
      </section>

      <section className="cv-page-section">
        <h3 className="cv-page-section-title">{t("project.detail.steps")}</h3>
        <ol className="cv-step-list">
          {steps.map((step, index) => {
            const isDone = done.has(step.id);
            const isNow = !isDone && (firstOpen === step.id || (firstOpen === null && index === 0));
            return (
              <li key={step.id} className="cv-step-item">
                <span className="cv-step-state">
                  {isDone
                    ? t("runner.step.state.done")
                    : isNow
                      ? t("runner.step.state.now")
                      : t("runner.step.state.later")}
                </span>{" "}
                {messages[step.prompt_key] ?? step.prompt_key}
              </li>
            );
          })}
        </ol>
        <div className="cv-page-actions">
          {finished ? (
            <Button label={t("runner.portfolio.view")} onClick={() => navigateTo("#me")} />
          ) : (
            <Button
              label={t(instance ? "project.detail.continue" : "project.detail.start")}
              onClick={begin}
            />
          )}
        </div>
      </section>

      <section className="cv-page-section">
        <h3 className="cv-page-section-title">{t("project.detail.safety")}</h3>
        <p className="cv-page-empty">{messages[project.safety.notes_key] ?? project.safety.notes_key}</p>
      </section>
    </>
  );
}

function projectOf(
  bundle: ContentBundle,
  wanted: string | null,
): ContentBundle["projects"][number] | undefined {
  return bundle.projects.find((p) => p.id === (wanted ?? "project.bridge"));
}
