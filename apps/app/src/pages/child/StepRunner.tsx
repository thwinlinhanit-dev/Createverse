import { useEffect, useState } from "react";
import { useApp } from "../../AppContext";
import { useT } from "../../i18n";
import { Button, Card } from "../../components/ui";
import { useBundle } from "../../content/useBundle.ts";
import { syncNow, useProgressStore } from "../../progress/useProgress.ts";
import type {
  ActivityAttemptRecord,
  ProjectInstanceRecord,
  SavedLabDesign,
} from "../../progress/store.ts";
import BridgeLab, { type LabRunResult } from "../../runner/BridgeLab.tsx";
import { HintPanel } from "../../runner/HintPanel.tsx";
import { ReadAloudButton } from "../../runner/ReadAloud.tsx";

/**
 * Project runner: story → steps → reflect → portfolio (P1-05).
 *
 * One lane step per screen, driven by content: intro/learn steps show the
 * prompt with pre-written hints; activity/experiment/challenge steps embed
 * the bridge lab. Lab steps need a successful test before continuing, with
 * a no-pressure "move on for now" after three tries (SAFETY.md §9: failure
 * is information, never pressure). Completing the lane opens reflection,
 * then a local portfolio entry. Everything persists in the on-device store,
 * so killing the app mid-step resumes without data loss.
 */

const REFLECT_STEP = "__reflect";
const PORTFOLIO_STEP = "__portfolio";
const MOVE_ON_AFTER_RUNS = 3;
const LAB_INTERACTIVE_MODE = "interactive" as const;

type LabMode = "interactive" | "headless";
let labModeOverride: LabMode | null = null;
/** Render tests run the real runtime headless (same code path, no rAF). */
export function setLabModeForTests(mode: LabMode | null): void {
  labModeOverride = mode;
}

interface Boot {
  readonly instance: ProjectInstanceRecord;
  readonly attempt: ActivityAttemptRecord | null;
}

export default function StepRunnerPage() {
  const { profile, projectId, stepId, navigateTo, openStep } = useApp();
  const t = useT();
  const stage = profile.stage === "parent" ? null : profile.stage;
  const { bundle, error, retry } = useBundle(profile.language, stage ?? "junior");
  const { store, ready } = useProgressStore(profile.id);

  const [boot, setBoot] = useState<Boot | null>(null);
  const [runCount, setRunCount] = useState(0);
  const [lastSuccess, setLastSuccess] = useState(false);
  const [lastLab, setLastLab] = useState<{
    pieces: number;
    vehicle: string;
    success: boolean;
    cost: number;
  } | null>(null);
  const [reflectDone, setReflectDone] = useState<readonly boolean[]>([]);
  const [reflectText, setReflectText] = useState<readonly string[]>([]);
  const [, setHintTick] = useState(0);

  const wantedProject = projectId ?? store?.getPosition()?.projectId ?? "project.bridge";
  const project = bundle ? bundle.projects.find((p) => p.id === wantedProject) : undefined;
  const lane = project && stage ? project.lanes[stage] : undefined;
  const wantedStep = stepId ?? store?.getPosition()?.stepId ?? lane?.steps[0] ?? null;
  const isReflect = wantedStep === REFLECT_STEP;
  const isPortfolio = wantedStep === PORTFOLIO_STEP;
  const step =
    !isReflect && !isPortfolio && lane
      ? lane.steps
          .map((id) => bundle?.steps.find((s) => s.id === id))
          .find((s) => s?.id === wantedStep)
      : undefined;

  // Reset per-step session state when the runner moves.
  useEffect(() => {
    setBoot(null);
    setRunCount(0);
    setLastSuccess(false);
    setLastLab(null);
    setReflectDone([]);
    setReflectText([]);
    setHintTick(0);
  }, [wantedProject, wantedStep]);

  // Bootstrap the instance + attempt + persisted position.
  useEffect(() => {
    if (!ready || store === null || project === undefined || lane === undefined || stage === null) {
      return;
    }
    if (wantedStep === null || isReflect || isPortfolio) {
      // Pseudo-steps (and the impossible null) need an open instance but no
      // attempt; without one there is nothing to resume — back to detail.
      const open = store.findOpenInstance(project.id);
      if (!open) return;
      void store.setPosition({ projectId: project.id, instanceId: open.id, stepId: wantedStep });
      setBoot({ instance: open, attempt: null });
      return;
    }
    if (step === undefined) return;
    const activeStore = store;
    const activeStep = step;
    let live = true;
    void (async () => {
      const started = await activeStore.startProject(
        project.id,
        stage,
        project.version,
        lane.steps,
      );
      const prior = activeStore
        .getAttempts(started.instance.id)
        .filter((a) => a.stepId === activeStep.id);
      const attempt =
        prior[prior.length - 1] ?? (await activeStore.beginAttempt(started.instance.id, activeStep.id));
      await activeStore.setPosition({
        projectId: project.id,
        instanceId: started.instance.id,
        stepId: activeStep.id,
      });
      if (live) setBoot({ instance: started.instance, attempt });
    })();
    return () => {
      live = false;
    };
  }, [ready, store, project, lane, wantedStep, isReflect, isPortfolio, step, stage]);

  if (
    stage === null ||
    error !== null ||
    wantedStep === null ||
    (bundle !== null && project === undefined)
  ) {
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
  if (
    bundle === null ||
    !ready ||
    store === null ||
    project === undefined ||
    lane === undefined ||
    boot === null
  ) {
    return (
      <section className="cv-page">
        <h2 className="cv-page-title">{t("runner.loading")}</h2>
      </section>
    );
  }

  const messages = bundle.messages;
  const activeStore = store;
  const activeProject = project;
  const activeLane = lane;

  function advance(): void {
    if (isReflect || isPortfolio || step === undefined) return;
    const index = activeLane.steps.indexOf(step.id);
    const next = index >= 0 ? activeLane.steps[index + 1] : undefined;
    if (next) openStep(activeProject.id, next);
    else openStep(activeProject.id, REFLECT_STEP);
  }

  async function finishCurrentStep(outcome: "success" | "partial"): Promise<void> {
    if (boot === null || boot.attempt === null || step === undefined) return;
    const hintsUsed = activeStore.getHintProgress(step.id).levelReached;
    await activeStore.finishAttempt(boot.attempt.id, outcome, {
      hintsUsed,
      iterations: boot.attempt.iterations,
      concepts: [...step.concepts],
      skills: [...step.skills],
      content: { id: step.id, version: step.version },
    });
    advance();
  }

  function onRunFinished(result: LabRunResult): void {
    if (boot === null || boot.attempt === null || step === undefined) return;
    const attemptId = boot.attempt.id;
    const experienceId = step.experience_ref ?? step.id;
    void activeStore.addIteration(attemptId).then(() => {
      setRunCount((n) => n + 1);
      if (result.success) setLastSuccess(true);
      setLastLab((prev) => ({
        pieces: prev?.pieces ?? 0,
        vehicle: result.vehicle,
        success: result.success,
        cost: result.cost,
      }));
      void activeStore.recordExperiment(
        { id: activeProject.id, version: activeProject.version },
        {
          experienceId,
          vehicle: result.vehicle,
          success: result.success,
          reasons: result.reasons,
          cost: result.cost,
          peakLoadRatio: result.peakLoadRatio,
          iterations: 1,
        },
      );
    });
  }

  // ---- reflect + portfolio pseudo-steps ------------------------------------
  if (isReflect) {
    const prompts = activeProject.reflection_prompts;
    const done = prompts.map((_, i) => reflectDone[i] === true);
    const allDone = prompts.length === 0 || done.every(Boolean);
    return (
      <>
        <div className="cv-page-actions">
          <Button label={t("runner.back")} secondary onClick={() => navigateTo("#project")} />
        </div>
        <h2 className="cv-page-title">{t("runner.reflect.title")}</h2>
        {prompts.map((key, i) => (
          <section key={key} className="cv-page-section">
            <p className="cv-page-lead">{messages[key] ?? key}</p>
            {stage !== "junior" ? (
              <label className="cv-field">
                <span className="cv-field-label">{t("runner.reflect.write")}</span>
                <input
                  className="cv-field-input"
                  type="text"
                  value={reflectText[i] ?? ""}
                  onChange={(e) => {
                    const next = [...reflectText];
                    next[i] = e.target.value;
                    setReflectText(next);
                  }}
                />
              </label>
            ) : null}
            <div className="cv-page-actions">
              <button
                type="button"
                data-testid={`reflect-done-${i}`}
                className={`cv-button${done[i] === true ? "" : " cv-button--secondary"}`}
                aria-pressed={done[i] === true}
                onClick={() => {
                  const next = [...reflectDone];
                  next[i] = !(next[i] === true);
                  setReflectDone(next);
                }}
              >
                {t("runner.reflect.done")}
              </button>
            </div>
          </section>
        ))}
        <div className="cv-page-actions">
          <Button
            label={t("runner.step.next")}
            disabled={!allDone}
            onClick={() => {
              const answers = reflectText.filter((s) => s.trim().length > 0);
              void (async () => {
                await activeStore.submitReflection(boot.instance.id, [...prompts], answers);
                await activeStore.completeProject(boot.instance.id, {
                  title: messages[activeProject.title_key] ?? activeProject.title_key,
                  stageAtCreation: stage,
                  skills: [...activeProject.required_skills],
                  concepts: [...activeProject.learning_objectives],
                  whatILearned: answers[0] ?? "",
                  whatIWouldImprove: answers[1] ?? "",
                  design: {
                    pieces: lastLab?.pieces ?? 0,
                    vehicle: lastLab?.vehicle ?? "",
                    success: lastLab?.success ?? false,
                    cost: lastLab?.cost ?? 0,
                  },
                });
                await syncNow(activeStore);
                openStep(activeProject.id, PORTFOLIO_STEP);
              })();
            }}
          />
        </div>
      </>
    );
  }

  if (isPortfolio) {
    const entries = activeStore
      .getPortfolio()
      .filter((e) => e.projectInstanceId === boot.instance.id);
    const entry = entries[entries.length - 1];
    return (
      <>
        <h2 className="cv-page-title">{t("runner.portfolio.title")}</h2>
        {entry ? (
          <Card
            label={entry.title}
            body={entry.whatILearned || t("runner.finish.body")}
          />
        ) : (
          <p className="cv-page-empty">{t("runner.finish.body")}</p>
        )}
        <div className="cv-page-actions">
          <Button label={t("runner.portfolio.view")} onClick={() => navigateTo("#me")} />
          <Button label={t("runner.back")} secondary onClick={() => navigateTo("#projects")} />
        </div>
      </>
    );
  }

  // ---- lane step ------------------------------------------------------------
  if (step === undefined) {
    return (
      <section className="cv-page">
        <h2 className="cv-page-title">{t("runner.loadError.title")}</h2>
        <p className="cv-page-empty">{t("runner.loadError.body")}</p>
        <div className="cv-page-actions">
          <Button label={t("runner.back")} secondary onClick={() => navigateTo("#project")} />
        </div>
      </section>
    );
  }

  const activeStep = step;
  const stepIndex = activeLane.steps.indexOf(activeStep.id);
  const experience = activeStep.experience_ref
    ? bundle.experiences.find((e) => e.experience_id === activeStep.experience_ref)
    : undefined;
  const isLab =
    activeStep.type !== "intro" && activeStep.type !== "learn" && experience !== undefined;
  const attemptDone = boot.attempt?.outcome !== null;
  const ladder = activeStep.hint_ladder
    ? bundle.ladders.find((l) => l.id === activeStep.hint_ladder)
    : undefined;
  const hintProgress = activeStore.getHintProgress(activeStep.id);
  const canAdvance = lastSuccess || runCount >= MOVE_ON_AFTER_RUNS;

  return (
    <>
      <div className="cv-page-actions">
        <Button label={t("runner.back")} secondary onClick={() => navigateTo("#project")} />
      </div>
      <progress
        className="cv-steps"
        max={activeLane.steps.length}
        value={Math.min(stepIndex + 1, activeLane.steps.length)}
        aria-label={t("runner.stepOf", { current: stepIndex + 1, total: activeLane.steps.length })}
      />
      <h2 className="cv-page-title">{messages[activeStep.prompt_key] ?? activeStep.prompt_key}</h2>
      <ReadAloudButton
        text={messages[activeStep.prompt_key] ?? activeStep.prompt_key}
        locale={profile.language}
      />

      {ladder ? (
        <HintPanel
          ladder={ladder}
          messages={messages}
          progress={{
            levelReached: hintProgress.levelReached,
            attemptCount: hintProgress.attemptCount,
          }}
          onHint={(level) => {
            void activeStore
              .recordHint(activeStep.id, level)
              .then(() => setHintTick((n) => n + 1));
          }}
        />
      ) : null}

      {attemptDone ? (
        <section className="cv-page-section">
          <p className="cv-page-empty">{t("runner.step.state.done")}</p>
          <div className="cv-page-actions">
            <Button label={t("runner.step.next")} onClick={advance} />
          </div>
        </section>
      ) : isLab && experience ? (
        <section className="cv-page-section">
          <BridgeLab
            key={activeStep.id}
            spec={experience}
            messages={messages}
            stepId={activeStep.id}
            mode={labModeOverride ?? LAB_INTERACTIVE_MODE}
            initialDesign={activeStore.getLabDesign(
              activeStep.id,
              experience.experience_id,
              experience.version,
            )}
            onDesignChange={(design: SavedLabDesign) => {
              setLastLab((prev) => ({
                pieces: design.design.length,
                vehicle: design.vehicleId,
                success: prev?.success ?? false,
                cost: prev?.cost ?? 0,
              }));
              void activeStore.setLabDesign(activeStep.id, design);
            }}
            onRunFinished={onRunFinished}
          />
          <p className="cv-page-empty">{t("runner.step.needSuccess")}</p>
          <div className="cv-page-actions">
            <Button
              label={t("runner.step.next")}
              disabled={!canAdvance}
              onClick={() => void finishCurrentStep(lastSuccess ? "success" : "partial")}
            />
            {!lastSuccess && runCount >= MOVE_ON_AFTER_RUNS ? (
              <Button
                label={t("runner.moveOn")}
                secondary
                onClick={() => void finishCurrentStep("partial")}
              />
            ) : null}
          </div>
          {!lastSuccess && runCount >= MOVE_ON_AFTER_RUNS ? (
            <p className="cv-page-empty">{t("runner.moveOn.body", { count: runCount })}</p>
          ) : null}
        </section>
      ) : (
        <section className="cv-page-section">
          <div className="cv-page-actions">
            <Button label={t("runner.step.done")} onClick={() => void finishCurrentStep("success")} />
          </div>
        </section>
      )}
    </>
  );
}
