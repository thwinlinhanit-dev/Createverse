import type { IconName } from "@createverse/ui";
import { ICONS } from "@createverse/ui";

interface IconProps {
  readonly name: IconName;
  readonly label?: string;
  readonly size?: number;
}

/**
 * Inline SVG icon rendered as real DOM, not an HTML string.
 *
 * The icon shapes live in @createverse/ui (ICONS). This component is the
 * React-side renderer; packages/ui's renderIcon() is the string renderer used
 * by the preview page. Both render the same shapes, so the app and the preview
 * stay visually identical.
 *
 * When a visible text label sits next to the icon, omit `label` so the icon is
 * aria-hidden decoration (DESIGN_SYSTEM.md §5, §8).
 */
export default function Icon(props: IconProps) {
  const shape = ICONS[props.name];
  if (!shape) {
    // Should be impossible for a typed IconName, but render nothing rather
    // than throwing in a render function.
    return null;
  }

  const strokes = shape.stroke ?? [];
  const fills = shape.fill ?? [];

  const strokePaths = strokes.map((d) => (
    <path key={d} d={d} />
  ));
  const fillPaths = fills.map((d) => (
    <path key={d} d={d} fill="currentColor" stroke="none" />
  ));

  const described = props.label ? { "aria-label": props.label, role: "img" as const } : { "aria-hidden": true, focusable: false };
  const attrs = described as React.SVGAttributes<SVGSVGElement> & { focusable?: false };

  return (
    <svg
      className="cv-icon"
      viewBox="0 0 24 24"
      width={props.size ?? 24}
      height={props.size ?? 24}
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...attrs}
    >
      <g>
        {strokePaths}
        {fillPaths}
      </g>
    </svg>
  );
}
