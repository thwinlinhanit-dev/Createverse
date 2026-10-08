import { cx, dataStage, type CvComponentProps } from "./base.ts";
import { escapeHtml } from "./escape.ts";

export interface ButtonProps extends CvComponentProps {
  readonly variant?: "primary" | "secondary";
  readonly disabled?: boolean;
  /** Loading state: sets `aria-busy` and disables the button (§5 states). */
  readonly loading?: boolean;
}

export function renderButton(props: ButtonProps): string {
  const stage = dataStage(props.stage);
  const stageAttr = stage["data-stage"] ? ` data-stage="${stage["data-stage"]}"` : "";
  const busy = props.loading === true;
  return (
    `<button type="button" class="${cx("cv-button", props.variant === "secondary" && "cv-button--secondary")}"` +
    stageAttr +
    `${busy ? ' aria-busy="true"' : ""}` +
    `${props.disabled || busy ? " disabled" : ""}>${escapeHtml(props.label)}</button>`
  );
}
