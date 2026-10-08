import { useCallback, useEffect, useState } from "react";
import type { Locale, Stage } from "@createverse/shared-types";
import { BundleLoadError, loadBundle, type ContentBundle } from "./bundles.ts";

/**
 * Load the compiled bundle for the child's (locale, stage).
 * A `BundleLoadError` becomes a calm fallback screen, never a half-loaded
 * project (P1-04: rejected at load as well as at build).
 */
export function useBundle(
  locale: Locale,
  stage: Stage,
): {
  bundle: ContentBundle | null;
  error: BundleLoadError | null;
  retry: () => void;
} {
  const [bundle, setBundle] = useState<ContentBundle | null>(null);
  const [error, setError] = useState<BundleLoadError | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let live = true;
    setBundle(null);
    setError(null);
    loadBundle(locale, stage).then(
      (loaded) => {
        if (live) setBundle(loaded);
      },
      (err) => {
        if (live) {
          setError(
            err instanceof BundleLoadError
              ? err
              : new BundleLoadError("network", String(err)),
          );
        }
      },
    );
    return () => {
      live = false;
    };
  }, [locale, stage, attempt]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);
  return { bundle, error, retry };
}
