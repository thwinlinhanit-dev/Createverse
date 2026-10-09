import type { MessageKey } from "@createverse/i18n";
import type { ProgressEvent } from "@createverse/shared-types";
import { useApp } from "../../AppContext";
import { useT } from "../../i18n";
import { Card, Chip } from "../../components/ui";
import { useBundle } from "../../content/useBundle.ts";
import { listMentorTurns } from "../../mentor/index.ts";
import { useProgressStore } from "../../progress/useProgress.ts";

/**
 * Progress: real on-device learning evidence (P1-05/P1-08 client).
 * Counts, last activity and recent events replay from the append-only event
 * log on this device. Family sync arrives with P1-08; until then the pending
 * note says plainly what is saved where.
 */

const KNOWN_EVENT_DESCRIPTIONS: Record<string, MessageKey> = {
  "child.project.started": "progress.last.project",
  "child.activity.completed": "progress.last.activity",
  "child.experiment.executed": "progress.last.experiment",
  "child.reflection.submitted": "progress.last.reflection",
  "child.project.completed": "progress.last.completed",
  "ai.hint.requested": "progress.last.hint",
};

export default function ProgressPage() {
  const { profile } = useApp();
  const t = useT();
  const stage = profile.stage === "parent" ? null : profile.stage;
  const { bundle } = useBundle(profile.language, stage ?? "junior");
  const { store, ready } = useProgressStore(profile.id);

  const summary = ready && store ? store.summary() : null;
  const recent: readonly ProgressEvent[] =
    ready && store ? store.recentEvents(5).filter((e) => KNOWN_EVENT_DESCRIPTIONS[e.type]) : [];
  // P1-07: parent-visible mentor transcript (ids and enums only).
  const turns = ready ? listMentorTurns(profile.id).slice(0, 10) : [];

  function projectTitleFor(contentId: string | undefined): string {
    if (!contentId) return t("project.bridge.title");
    if (bundle) {
      const project = bundle.projects.find((p) => p.id === contentId);
      if (project) return bundle.messages[project.title_key] ?? contentId;
      if (stage) {
        for (const candidate of bundle.projects) {
          if (candidate.lanes[stage].steps.includes(contentId)) {
            return bundle.messages[candidate.title_key] ?? candidate.id;
          }
        }
      }
    }
    return contentId;
  }

  function describe(event: ProgressEvent): string {
    const key = KNOWN_EVENT_DESCRIPTIONS[event.type];
    if (!key) return event.type;
    return t(key, { project: projectTitleFor(event.content_id) });
  }

  function dayString(iso: string): string {
    try {
      return new Date(iso).toLocaleDateString(profile.language);
    } catch {
      return iso;
    }
  }

  function dayOf(event: ProgressEvent): string {
    return dayString(event.occurred_at);
  }

  function stepTitleFor(stepId: string): string {
    const step = bundle?.steps.find((s) => s.id === stepId);
    const key = step?.prompt_key;
    if (key && bundle) return bundle.messages[key] ?? stepId;
    return stepId;
  }

  const hasData = summary !== null && summary.totalEvents > 0;
  const last = recent[0];

  return (
    <>
      <h2 className="cv-page-title">{t("progress.title")}</h2>
      <p className="cv-page-lead">{t("progress.lead")}</p>

      <section className="cv-parent-grid">
        <Card
          label={t("progress.activities.label")}
          body={
            hasData && summary
              ? t("progress.activities.real", {
                  activities: summary.activitiesCompleted,
                  hints: summary.hintsUsed,
                  experiments: summary.experimentsRun,
                })
              : t("progress.activities.body")
          }
        />
        <Card
          label={t("progress.last.label")}
          body={last ? `${describe(last)} · ${dayOf(last)}` : t("progress.last.body")}
        />
      </section>

      <section className="cv-page-section">
        <h3 className="cv-page-section-title">{t("progress.recent.title")}</h3>
        {recent.length === 0 ? (
          <>
            <p className="cv-page-empty">{t("progress.recent.empty")}</p>
            <div className="cv-page-empty-small">
              <Chip label={t("progress.recent.chip")} />
            </div>
          </>
        ) : (
          <ol className="cv-step-list">
            {recent.map((event) => (
              <li key={event.event_id} className="cv-step-item">
                {describe(event)} · {dayOf(event)}
              </li>
            ))}
          </ol>
        )}
      </section>

      <section className="cv-page-section">
        <h3 className="cv-page-section-title">{t("progress.mentor.title")}</h3>
        {turns.length === 0 ? (
          <p className="cv-page-empty">{t("progress.mentor.empty")}</p>
        ) : (
          <ol className="cv-step-list">
            {turns.map((turn) => (
              <li key={turn.id} className="cv-step-item">
                {turn.hintLevel > 0
                  ? t("progress.mentor.item", {
                      step: stepTitleFor(turn.stepId),
                      level: turn.hintLevel,
                      date: dayString(turn.at),
                    })
                  : t("progress.mentor.fallback", {
                      step: stepTitleFor(turn.stepId),
                      date: dayString(turn.at),
                    })}
              </li>
            ))}
          </ol>
        )}
      </section>

      <section className="cv-page-section">
        <h3 className="cv-page-section-title">{t("progress.how.title")}</h3>
        <p className="cv-page-empty">{t("progress.how.body")}</p>
        <Chip label={t("progress.how.saved")} />
        <Chip label={t("progress.how.offline")} />
        <Chip label={t("progress.how.notime")} />
        {summary ? (
          <p className="cv-page-empty">{t("progress.sync.pending", { count: summary.pendingSync })}</p>
        ) : null}
      </section>
    </>
  );
}
