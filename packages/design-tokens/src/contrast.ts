/**
 * Color contrast math (WCAG 2.1 relative luminance and contrast ratio).
 * DESIGN_SYSTEM.md §2/§8: text pairs ≥ 4.5:1, controls and focus rings ≥ 3:1.
 */

export type Rgb = readonly [number, number, number];

export function hexToRgb(hex: string): Rgb {
  const match = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!match || !match[1]) {
    throw new Error(`not a 6-digit hex color: ${hex}`);
  }
  const value = Number.parseInt(match[1], 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

function channel(rgb: Rgb, index: 0 | 1 | 2): number {
  const value = rgb[index];
  if (value === undefined) throw new Error("rgb channel missing");
  return value;
}

function channelLuminance(value: number): number {
  const s = value / 255;
  return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}

export function relativeLuminance(hex: string): number {
  const rgb = hexToRgb(hex);
  return (
    0.2126 * channelLuminance(channel(rgb, 0)) +
    0.7152 * channelLuminance(channel(rgb, 1)) +
    0.0722 * channelLuminance(channel(rgb, 2))
  );
}

/** WCAG contrast ratio in the range 1 to 21. */
export function contrastRatio(hexA: string, hexB: string): number {
  const a = relativeLuminance(hexA);
  const b = relativeLuminance(hexB);
  const lighter = Math.max(a, b);
  const darker = Math.min(a, b);
  return (lighter + 0.05) / (darker + 0.05);
}
