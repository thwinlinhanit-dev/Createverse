import { escapeHtml } from "./escape.ts";

/**
 * Small self-authored icon set (DESIGN_SYSTEM.md §2.4).
 *
 * No icon dependency was added: these are simple 24×24 rounded stroke drawings
 * on `currentColor`, so there is nothing to justify under the "adding a
 * dependency needs a written justification" rule. Every icon is paired with a
 * text label in the UI; icons alone carry no meaning.
 */

export type IconName =
  | "home"
  | "explore"
  | "create"
  | "projects"
  | "me"
  | "hint"
  | "speaker"
  | "play"
  | "undo"
  | "redo"
  | "lock"
  | "close"
  | "check"
  | "warning"
  | "info"
  | "arrowLeft"
  | "book";

interface IconShape {
  readonly stroke?: readonly string[];
  readonly fill?: readonly string[];
}

const ICONS: Readonly<Record<IconName, IconShape>> = {
  home: { stroke: ["M4 11.5 12 4l8 7.5", "M6.5 10.5V20h11v-9.5"] },
  explore: {
    stroke: ["M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Z", "m15.5 8.5-2.2 4.8-4.8 2.2 2.2-4.8Z"],
  },
  create: { stroke: ["m14.5 3.5 6 6-3 3-6-6Z", "M13 10 4 19", "M3.5 20.5l1.5-2"] },
  projects: { stroke: ["M4 7h5l2 2.5h9V19H4Z", "M4 7V5.5h4.5L10.5 7"] },
  me: { stroke: ["M12 4.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7Z", "M5.5 20a6.5 6.5 0 0 1 13 0"] },
  hint: {
    stroke: [
      "M12 3.5a5.5 5.5 0 0 0-3.2 9.96V17h6.4v-3.54A5.5 5.5 0 0 0 12 3.5Z",
      "M9.5 20h5",
    ],
  },
  speaker: {
    stroke: [
      "M4 9.5h3.5L12 6v12l-4.5-3.5H4Z",
      "M15.5 9.5a4 4 0 0 1 0 5",
      "M18 7a7.5 7.5 0 0 1 0 10",
    ],
  },
  play: { fill: ["M8.5 5.5v13l10-6.5Z"] },
  undo: { stroke: ["m8 6.5-3.5 3.5L8 13.5", "M4.5 10h9a5.5 5.5 0 0 1 0 11h-2.5"] },
  redo: { stroke: ["m16 6.5 3.5 3.5L16 13.5", "M19.5 10h-9a5.5 5.5 0 0 0 0 11H13"] },
  lock: { stroke: ["M6.5 11h11v9h-11Z", "M9 11V8a3 3 0 0 1 6 0v3"] },
  close: { stroke: ["m6 6 12 12", "M18 6 6 18"] },
  check: { stroke: ["m5 12.5 4.5 4.5L19 7.5"] },
  warning: {
    stroke: ["M12 4 2.5 20.5h19Z", "M12 10v4", "M12 17h.01"],
  },
  info: { stroke: ["M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Z", "M12 11v5", "M12 8h.01"] },
  arrowLeft: { stroke: ["M19.5 12H5", "m11 6-6 6 6 6"] },
  book: { stroke: ["M4 5h12", "M4 12h12", "M4 19h12"] },
};

export const ICON_NAMES = Object.keys(ICONS) as IconName[];
export { ICONS };


export interface IconProps {
  readonly name: IconName;
  /**
   * Accessible name. Omit when the icon sits next to a visible text label —
   * then the icon is `aria-hidden` decoration (DESIGN_SYSTEM.md §5, §8).
   */
  readonly label?: string;
}

export function renderIcon(props: IconProps): string {
  const shape = ICONS[props.name];
  const strokes = (shape.stroke ?? [])
    .map((d) => `<path d="${d}"></path>`)
    .join("");
  const fills = (shape.fill ?? [])
    .map((d) => `<path d="${d}" fill="currentColor" stroke="none"></path>`)
    .join("");
  const group = `<g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${strokes}${fills}</g>`;
  const accessible = props.label
    ? ` role="img" aria-label="${escapeHtml(props.label)}"`
    : ` aria-hidden="true" focusable="false"`;
  return `<svg class="cv-icon" viewBox="0 0 24 24" width="24" height="24"${accessible}>${group}</svg>`;
}
