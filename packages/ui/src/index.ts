export * from "./base.ts";
export * from "./escape.ts";
export * from "./Icon.ts";
export * from "./Button.ts";
export * from "./components.ts";
export * from "./styles.ts";
export * from "./preview.ts";

// PWA shell: do not add Vite plugin or workbox deps here — that wiring stays in
// apps/app/vite.config.ts. This package is framework-free by design (ADR-0002);
// the app shell owns SW registration and the manifest.
