import { useEffect, useRef, type KeyboardEvent } from "react";
import { useApp } from "../AppContext";
import { useT } from "../i18n";
import Icon from "../Icon";

/**
 * Route guard for the parent area (P1-03): the parent screens never render
 * until the gate is confirmed. Until P1-01 wires real passkey auth, "confirm"
 * stands in for the passkey ceremony.
 *
 * Accessibility (DESIGN_SYSTEM §5, §8): real dialog semantics (role/aria-modal,
 * labelled by its heading), focus moves into the dialog on open, Tab is trapped
 * inside it, Escape and "Not now" both leave the parent area for the child home.
 */
export default function ParentGateModal() {
  const { confirmParentGate, navigateTo } = useApp();
  const t = useT();

  const dialogRef = useRef<HTMLDivElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);

  // Move focus into the dialog when it opens (no keyboard trap outside it).
  useEffect(() => {
    confirmRef.current?.focus();
  }, []);

  const leaveParentArea = () => {
    confirmParentGate();
    navigateTo("#/");
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Escape") {
      e.preventDefault();
      leaveParentArea();
      return;
    }
    if (e.key !== "Tab") return;

    // Trap: keep Tab / Shift+Tab cycling through the dialog's own buttons.
    const focusables = dialogRef.current?.querySelectorAll<HTMLButtonElement>("button");
    if (!focusables || focusables.length === 0) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (!first || !last) return;

    const active = document.activeElement;
    if (e.shiftKey && (active === first || !dialogRef.current?.contains(active))) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && active === last) {
      e.preventDefault();
      first.focus();
    }
  };

  return (
    <div className="cv-gate-backdrop" onKeyDown={onKeyDown}>
      <div
        className="cv-gate-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="cv-gate-title"
        aria-describedby="cv-gate-reason"
        ref={dialogRef}
      >
        <div className="cv-gate-card">
          <div className="cv-gate-card-head">
            <Icon name="lock" label={t("gate.icon")} />
            <h2 className="cv-gate-title" id="cv-gate-title">
              {t("gate.title")}
            </h2>
          </div>

          <p className="cv-gate-reason" id="cv-gate-reason">
            {t("gate.reason")}
          </p>

          <p className="cv-gate-note">
            {t("gate.note")}
          </p>

          <div className="cv-gate-card-actions">
            <button
              type="button"
              className="cv-button"
              ref={confirmRef}
              onClick={confirmParentGate}
            >
              {t("gate.confirm")}
            </button>
            <button
              type="button"
              className="cv-button cv-button--secondary"
              onClick={leaveParentArea}
            >
              {t("gate.notNow")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
