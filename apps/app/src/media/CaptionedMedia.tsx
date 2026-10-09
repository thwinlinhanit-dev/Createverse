import { useApp } from "../AppContext";
import { useT } from "../i18n";

/**
 * Captions hook (DESIGN_SYSTEM §8: "captions for any recorded audio/video —
 * a hook in Phase 1", task P1-13).
 *
 * Phase 1 records no media yet, so no screen renders this today. When
 * recording arrives, this is the supported way to play a recording back: it
 * always attaches a `<track kind="captions">` for the child's active locale
 * (ADR-0008), so a caption can only be missing by bypassing this hook — and
 * captions.test.tsx fails the build if an `<audio>`/`<video>` element appears
 * anywhere else in `src/`.
 */
export function CaptionedMedia({
  src,
  mimeType,
  captionsSrc,
  video = false,
}: {
  /** Recorded media source (blob: URL or same-origin https: URL). */
  readonly src: string;
  /** MIME type of the recording (e.g. "audio/webm"). */
  readonly mimeType: string;
  /** WebVTT caption file matching the child's active locale. */
  readonly captionsSrc: string;
  /** Render a `<video>` element instead of an `<audio>` element. */
  readonly video?: boolean;
}) {
  const t = useT();
  const { profile } = useApp();
  const captionsLabel = t("media.captions.label");
  const sourceType = mimeType;
  const track = (
    <track
      kind="captions"
      src={captionsSrc}
      srcLang={profile.language}
      label={captionsLabel}
      default
    />
  );

  if (video) {
    return (
      <video controls preload="metadata">
        <source src={src} type={sourceType} />
        {track}
      </video>
    );
  }
  return (
    <audio controls preload="metadata">
      <source src={src} type={sourceType} />
      {track}
    </audio>
  );
}
