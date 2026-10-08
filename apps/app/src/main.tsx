import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import AppShell from "./App";
import { registerSW } from "./registerSW";

// Design tokens + component styles come from the compiled CSS shipped in public/.
// App shell layout styles are token-only (DESIGN_SYSTEM §10).
import "./shell.css";

registerSW();

const rootEl = document.getElementById("root");
if (!rootEl) {
  throw new Error("apps/app/src/index.html must contain <div id=\"root\"></div>");
}

createRoot(rootEl).render(
  <StrictMode>
    <AppShell />
  </StrictMode>,
);
