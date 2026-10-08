import { dataStage, type CvComponentProps } from "./base.ts";
import { escapeHtml } from "./escape.ts";
import { renderIcon } from "./Icon.ts";

/** ` data-stage="..."` only when the stage is given explicitly (DESIGN_SYSTEM.md §10). */
function stageAttr(stage: CvComponentProps["stage"]): string {
  const attrs = dataStage(stage);
  return attrs["data-stage"] ? ` data-stage="${attrs["data-stage"]}"` : "";
}

export interface CardProps extends CvComponentProps {
  readonly body: string;
}

export function renderCard(props: CardProps): string {
  return (
    `<section class="cv-card"${stageAttr(props.stage)}>` +
    `<h2>${escapeHtml(props.label)}</h2><p>${escapeHtml(props.body)}</p></section>`
  );
}

export interface ChipProps extends CvComponentProps {
  readonly selected?: boolean;
}

export function renderChip(props: ChipProps): string {
  // Selected state carries a check icon, not color alone (DESIGN_SYSTEM.md §8).
  const mark = props.selected ? renderIcon({ name: "check" }) : "";
  return (
    `<span class="cv-chip${props.selected ? " cv-chip--selected" : ""}"${stageAttr(props.stage)}` +
    `${props.selected ? ' data-selected="true"' : ""}>${mark}${escapeHtml(props.label)}</span>`
  );
}

export interface TabsProps {
  readonly stage?: CvComponentProps["stage"];
  readonly tabs: readonly string[];
  readonly active: number;
}

export function renderTabs(props: TabsProps): string {
  const items = props.tabs
    .map(
      (tab, index) =>
        `<button type="button" role="tab" aria-selected="${index === props.active}">${escapeHtml(tab)}</button>`,
    )
    .join("");
  return `<div class="cv-tabs" role="tablist"${stageAttr(props.stage)}>${items}</div>`;
}

export interface DialogProps extends CvComponentProps {
  readonly body: string;
  readonly open: boolean;
}

export function renderDialog(props: DialogProps): string {
  if (!props.open) return "";
  return (
    `<div class="cv-dialog" role="dialog" aria-label="${escapeHtml(props.label)}"${stageAttr(props.stage)}>` +
    `<h2>${escapeHtml(props.label)}</h2><p>${escapeHtml(props.body)}</p></div>`
  );
}

export interface StepProgressProps {
  readonly stage?: CvComponentProps["stage"];
  readonly current: number;
  readonly total: number;
  /** Accessible label; defaults to English "Step X of Y" (localized via P1-02). */
  readonly label?: string;
}

export function renderStepProgress(props: StepProgressProps): string {
  const label = props.label ?? `Step ${props.current} of ${props.total}`;
  return (
    `<progress class="cv-steps" max="${props.total}" value="${props.current}"${stageAttr(props.stage)}` +
    ` aria-label="${escapeHtml(label)}"></progress>`
  );
}

export interface HintButtonProps {
  readonly stage?: CvComponentProps["stage"];
  readonly level: number;
  /** Visible label next to the hint icon (DESIGN_SYSTEM.md §5: lightbulb + text). */
  readonly label?: string;
  /** Accessible name; defaults to English (localized via P1-02). */
  readonly ariaLabel?: string;
  readonly disabled?: boolean;
}

export function renderHintButton(props: HintButtonProps): string {
  const label = props.label ?? "Help";
  const ariaLabel =
    props.ariaLabel ?? (props.level > 1 ? `Get hint level ${props.level}` : "Get a hint");
  return (
    `<button type="button" class="cv-hint"${stageAttr(props.stage)}` +
    ` aria-label="${escapeHtml(ariaLabel)}"${props.disabled ? " disabled" : ""}>` +
    `${renderIcon({ name: "hint" })}${escapeHtml(label)}</button>`
  );
}

export interface PortfolioCardProps extends CvComponentProps {
  readonly detail: string;
  readonly date: string;
}

export function renderPortfolioCard(props: PortfolioCardProps): string {
  return (
    `<article class="cv-portfolio"${stageAttr(props.stage)}>` +
    `<h3>${escapeHtml(props.label)}</h3>` +
    `<time>${escapeHtml(props.date)}</time><p>${escapeHtml(props.detail)}</p></article>`
  );
}

export interface ParentGateProps {
  readonly stage?: CvComponentProps["stage"];
  readonly reason: string;
  /** Visible button label; defaults to English (localized via P1-02). */
  readonly actionLabel?: string;
}

export function renderParentGate(props: ParentGateProps): string {
  const actionLabel = props.actionLabel ?? "Confirm with passkey";
  return (
    `<div class="cv-parent-gate" role="alert"${stageAttr(props.stage)}>` +
    `<p>${renderIcon({ name: "lock" })}${escapeHtml(props.reason)}</p>` +
    `<button type="button">${escapeHtml(actionLabel)}</button></div>`
  );
}

export interface SafetyNoticeProps {
  readonly stage?: CvComponentProps["stage"];
  readonly severity: "info" | "warning";
  readonly message: string;
  readonly nextStep: string;
  /** Severity word for the icon's accessible name; defaults to English. */
  readonly severityLabel?: string;
}

export function renderSafetyNotice(props: SafetyNoticeProps): string {
  // Severity shows as icon + word + border shape, never color alone (§8).
  const defaultLabel = props.severity === "warning" ? "Warning" : "Information";
  const icon = renderIcon({
    name: props.severity === "warning" ? "warning" : "info",
    label: props.severityLabel ?? defaultLabel,
  });
  return (
    `<div class="cv-safety cv-safety--${props.severity}" role="status"${stageAttr(props.stage)}>` +
    `<p>${icon}${escapeHtml(props.message)}</p><p>${escapeHtml(props.nextStep)}</p></div>`
  );
}
