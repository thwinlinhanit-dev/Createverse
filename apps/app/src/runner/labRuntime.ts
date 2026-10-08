import type {
  ExperienceRuntime,
  ForceViewEntry,
} from "@createverse/experience-runtime";

/**
 * Runtime factory for the bridge lab.
 *
 * The type imports above are erased at compile time; the implementation is
 * loaded with a dynamic `import()` so matter-js travels in its own lazy
 * chunk and the app shell stays under its JS budget (ARCHITECTURE.md §13:
 * experiences lazy-loaded). Tests inject their own factory (usually the same
 * WebExperienceRuntime in headless mode) through the lab's props.
 */
export async function createWebRuntime(): Promise<ExperienceRuntime> {
  const mod = await import("@createverse/experience-runtime");
  return new mod.WebExperienceRuntime();
}

/** Read-only HUD facts. WebExperienceRuntime implements this; the shared
 * ExperienceRuntime interface deliberately stays minimal (§8). */
export interface RuntimeHud {
  getDesignInfo(): {
    pieces: number;
    cost: number;
    budget: number;
    maxPieces: number;
    vehicleId: string;
    buildEnabled: boolean;
  };
  getForceView(): ForceViewEntry[];
}

export function asHud(runtime: ExperienceRuntime): RuntimeHud {
  return runtime as unknown as RuntimeHud;
}
