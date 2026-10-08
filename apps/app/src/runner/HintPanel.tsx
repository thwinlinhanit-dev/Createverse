import { getNextHint, type HintProgress } from "@createverse/learning-core";
import type { HintLadder } from "@createverse/shared-types";
import { useT } from "../i18n";

/**
 * Pre-written hint ladder (P1-05/P1-07 offline path).
 * Levels come from content, advance one at a time via `learning-core`, and
 * never consult live AI — the full journey works with live AI disabled.
 * Each shown hint is recorded by the caller (`recordHint`), which persists
 * the level so a reload resumes mid-ladder instead of restarting it.
 */
export function HintPanel({
  ladder,
  messages,
  progress,
  onHint,
}: {
  ladder: HintLadder;
  messages: Readonly<Record<string, string>>;
  progress: HintProgress;
  onHint: (level: number) => void;
}) {
  const t = useT();
  const next = getNextHint(ladder, progress);
  const shown = ladder.levels
    .filter((entry) => entry.level <= progress.levelReached)
    .map((entry) => ({
      level: entry.level,
      text: messages[entry.text_key] ?? entry.text_key,
    }));

  return (
    <section className="cv-hint-panel" aria-label={t("hint.get")}>
      {shown.map((hint) => (
        <p key={hint.level} className="cv-hint-text">
          <strong>{t("hint.of", { level: hint.level })}</strong>
          {": "}
          {hint.text}
        </p>
      ))}
      {next ? (
        <button
          type="button"
          className="cv-hint"
          aria-label={t("hint.getLevel", { level: next.level })}
          onClick={() => onHint(next.level)}
        >
          {t("hint.get")}
        </button>
      ) : (
        <p className="cv-page-empty">{t("hint.exhausted")}</p>
      )}
      <p className="cv-page-empty-small">{t("hint.used", { count: progress.levelReached })}</p>
    </section>
  );
}
