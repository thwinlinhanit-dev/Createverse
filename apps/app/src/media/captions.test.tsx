// @vitest-environment jsdom
/**
 * P1-13 (DESIGN_SYSTEM §8): captions are a hook in Phase 1.
 *
 * Two halves:
 *  1. CaptionedMedia always renders a <track kind="captions"> whose srcLang
 *     and label follow the child's active locale (en + zh-Hant).
 *  2. A source guard: any future <audio>/<video> element added anywhere else
 *     in src/ fails this test until it routes through CaptionedMedia, so a
 *     recording can never ship without captions.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { AppContext, createAppContext, type ChildProfile } from "../AppContext";
import { CaptionedMedia } from "./CaptionedMedia.tsx";

const PROFILE_EN: ChildProfile = {
  id: "child-test",
  displayName: "Child",
  stage: "junior",
  language: "en",
  simpleLanguage: false,
};

function Harness({
  profile,
  children,
}: {
  profile: ChildProfile;
  children: React.ReactNode;
}) {
  const { value } = createAppContext(profile);
  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
    true;
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => {
    root.unmount();
  });
  container.remove();
});

async function renderMedia(profile: ChildProfile, video = false): Promise<void> {
  await act(async () => {
    root.render(
      <Harness profile={profile}>
        <CaptionedMedia
          src="blob:recording"
          mimeType={video ? "video/webm" : "audio/webm"}
          captionsSrc="captions.vtt"
          video={video}
        />
      </Harness>,
    );
  });
}

describe("CaptionedMedia (captions hook)", () => {
  it("attaches an English captions track to audio", async () => {
    await renderMedia(PROFILE_EN);
    const audio = container.querySelector("audio");
    expect(audio).not.toBeNull();
    const track = audio?.querySelector("track");
    expect(track?.getAttribute("kind")).toBe("captions");
    expect(track?.getAttribute("srcLang")).toBe("en");
    expect(track?.getAttribute("label")).toBe("Captions");
    expect(track?.getAttribute("src")).toBe("captions.vtt");
    expect(audio?.querySelector("source")?.getAttribute("type")).toBe("audio/webm");
  });

  it("follows the active locale for zh-Hant and for video", async () => {
    await renderMedia({ ...PROFILE_EN, language: "zh-Hant" }, true);
    const video = container.querySelector("video");
    expect(video).not.toBeNull();
    const track = video?.querySelector("track");
    expect(track?.getAttribute("kind")).toBe("captions");
    expect(track?.getAttribute("srcLang")).toBe("zh-Hant");
    expect(track?.getAttribute("label")).toBe("字幕");
    expect(video?.querySelector("source")?.getAttribute("type")).toBe("video/webm");
  });
});

describe("source guard (captions cannot be skipped)", () => {
  it("has no raw <audio>/<video> elements outside CaptionedMedia", () => {
    const srcRoot = path.resolve(import.meta.dirname, "..");
    const offenders: string[] = [];

    function walk(dir: string): void {
      for (const entry of readdirSync(dir)) {
        const full = path.join(dir, entry);
        if (statSync(full).isDirectory()) {
          walk(full);
          continue;
        }
        if (!entry.endsWith(".tsx")) continue;
        if (entry === "CaptionedMedia.tsx" || entry.endsWith(".test.tsx")) continue;
        const text = readFileSync(full, "utf8");
        if (/<(audio|video)[\s>]/.test(text)) offenders.push(full);
      }
    }

    walk(srcRoot);
    expect(offenders).toEqual([]);
  });
});
