import type { Locale } from "@createverse/shared-types";
import { useT } from "../i18n";
import { Button } from "../components/ui";

/**
 * Read-aloud for prompts and hints (spec `ui.read_aloud`, ARCHITECTURE §12).
 * On-device speech synthesis first: free and offline-capable where the
 * device supports it. Silent no-op when unavailable — the button hides
 * instead of promising what it cannot do (P1-17 owns device-voice quality).
 */

export function isSpeechAvailable(): boolean {
  return (
    typeof window !== "undefined" &&
    "speechSynthesis" in window &&
    typeof window.speechSynthesis?.speak === "function"
  );
}

function voiceLang(locale: Locale): string {
  return locale === "zh-Hant" ? "zh-HK" : "en-US";
}

export function speakText(text: string, locale: Locale): void {
  if (!isSpeechAvailable()) return;
  const synth = window.speechSynthesis;
  synth.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = voiceLang(locale);
  const voices = synth.getVoices();
  const match = voices.find((v) => v.lang.startsWith(voiceLang(locale).slice(0, 2)));
  if (match) utterance.voice = match;
  synth.speak(utterance);
}

export function stopSpeaking(): void {
  if (!isSpeechAvailable()) return;
  window.speechSynthesis.cancel();
}

export function ReadAloudButton({ text, locale }: { text: string; locale: Locale }) {
  const t = useT();
  if (!isSpeechAvailable()) return null;
  return (
    <div className="cv-page-actions">
      <Button label={t("runner.listen")} secondary onClick={() => speakText(text, locale)} />
    </div>
  );
}
