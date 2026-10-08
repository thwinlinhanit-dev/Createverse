/**
 * Success condition parsing (EXPERIENCE_RUNTIME.md §6).
 * An unknown condition rejects the spec with a clear error — never silently ignored.
 */

export type ParsedCondition =
  | { readonly id: string; readonly kind: "crosses" }
  | { readonly id: string; readonly kind: "holds"; readonly seconds: number }
  | { readonly id: string; readonly kind: "cost_within_budget" }
  | { readonly id: string; readonly kind: "pieces_within_max" };

const HOLDS_PATTERN = /^bridge_holds_(\d+)s$/;

export function parseConditions(raw: readonly string[]): ParsedCondition[] {
  return raw.map((id) => {
    if (id === "vehicle_crosses" || id === "car_crosses") {
      return { id, kind: "crosses" } as const;
    }
    const match = HOLDS_PATTERN.exec(id);
    if (match && match[1]) {
      return { id, kind: "holds", seconds: Number(match[1]) } as const;
    }
    if (id === "cost<=budget") return { id, kind: "cost_within_budget" } as const;
    if (id === "pieces<=max") return { id, kind: "pieces_within_max" } as const;
    throw new Error(
      `unknown success condition "${id}" — spec rejected (EXPERIENCE_RUNTIME.md §6)`,
    );
  });
}
