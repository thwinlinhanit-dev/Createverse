function registerSW() {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) {
    return;
  }
  // sw.js is served from the project root by Vite (public/).
  navigator.serviceWorker
    .register("/sw.js")
    .then(
      () => {
        // Shell registered; the app remains usable online and offline.
      },
      () => {
        // Service worker registration failed (private mode, odd browser, etc.).
        // The app still runs online; we just do not cache the shell.
      },
    )
    .catch(() => {
      // Registration threw — leave the user online only.
    });
}

export { registerSW };
