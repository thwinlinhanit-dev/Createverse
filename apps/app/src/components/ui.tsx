import type { IconName } from "@createverse/ui";
import Icon from "../Icon";

/**
 * React wrappers for the @createverse/ui string renderers.
 *
 * @createverse/ui renders components to HTML strings (used by the preview page
 * and by server-side/newsletter contexts). The React app uses these thin wrappers
 * so the same tokens, CSS classes, accessible names and escaping rules apply in
 * both places, without copying rendering logic.
 *
 * Labels are bilingual stubs (en + zh-Hant) until P1-02 wires packages/i18n.
 * No inline hex in components — styling comes from the .cv-* CSS (token-only).
 */

// ---- Button -----------------------------------------------------------------

export interface ButtonProps {
  readonly label: string;
  readonly secondary?: boolean;
  readonly disabled?: boolean;
  readonly onClick?: () => void;
}

export function Button(props: ButtonProps) {
  const isSecondary = props.secondary === true;
  return (
    <button
      type="button"
      className={`cv-button${isSecondary ? " cv-button--secondary" : ""}`}
      onClick={props.onClick}
      disabled={props.disabled === true}
    >
      {props.label}
    </button>
  );
}

// ---- Card -------------------------------------------------------------------

export interface CardProps {
  readonly label: string;
  readonly body: string;
}

export function Card(props: CardProps) {
  return (
    <section className="cv-card">
      <h2>{props.label}</h2>
      <p>{props.body}</p>
    </section>
  );
}

// ---- Chip -------------------------------------------------------------------

export interface ChipProps {
  readonly label: string;
  readonly selected?: boolean;
  readonly icon?: IconName;
  readonly onClick?: () => void;
}

export function Chip(props: ChipProps) {
  const selected = props.selected === true;
  const chip: React.ReactElement = (
    <span
      className={`cv-chip${selected ? " cv-chip--selected" : ""}${props.onClick ? " cv-chip--pressable" : ""}`}
      data-selected={selected ? "true" : undefined}
      onClick={props.onClick}
      role={props.onClick ? "button" : undefined}
      tabIndex={props.onClick ? 0 : undefined}
      onKeyDown={props.onClick ? (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          props.onClick?.();
        }
      } : undefined}
    >
      {props.icon ? <Icon name={props.icon} label={undefined} /> : null}
      {selected ? <Icon name="check" label={undefined} /> : null}
      {props.label}
    </span>
  );
  return chip;
}

// ---- Icon (re-export so pages import from one place) -----------------------
export { default as Icon } from "../Icon";
export type { IconName } from "@createverse/ui";
