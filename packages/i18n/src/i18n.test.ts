import { describe, expect, it } from "vitest";
import {
  LOCALES,
  catalogs,
  createTranslator,
  hasKey,
  translate,
  type MessageKey,
} from "./index.ts";
import { en } from "./messages.en.ts";
import { zhHant } from "./messages.zhHant.ts";

/** Placeholder names referenced by an ICU message (args and branch subjects). */
function placeholders(message: string): Set<string> {
  const names = new Set<string>();
  for (const match of message.matchAll(/\{\s*([A-Za-z_]\w*)\s*([,}])/g)) {
    const name = match[1];
    if (name !== undefined) names.add(name);
  }
  return names;
}

describe("catalogs (TESTING.md section 6: key lookup)", () => {
  it("ships exactly the locales ADR-0008 defines", () => {
    expect([...LOCALES]).toEqual(["en", "zh-Hant"]);
    expect(Object.keys(catalogs).sort()).toEqual(["en", "zh-Hant"]);
  });

  it("zh-Hant has every en key and no extra keys", () => {
    const enKeys = Object.keys(en).sort();
    const zhKeys = Object.keys(zhHant).sort();
    expect(zhKeys).toEqual(enKeys);
    // Sanity: the shell's strings actually moved in (not an empty catalog).
    expect(enKeys.length).toBeGreaterThan(100);
  });

  it("has no empty messages in either catalog", () => {
    for (const locale of LOCALES) {
      for (const [key, message] of Object.entries(catalogs[locale])) {
        expect(message.trim().length, `${locale}:${key}`).toBeGreaterThan(0);
      }
    }
  });

  it("uses the same ICU placeholders in both locales", () => {
    for (const [key, message] of Object.entries(en)) {
      const enPlaceholders = placeholders(message);
      const zhPlaceholders = placeholders(zhHant[key as MessageKey]);
      expect(zhPlaceholders, key).toEqual(enPlaceholders);
    }
  });

  it("hasKey answers for real keys and rejects invented ones", () => {
    expect(hasKey("nav.child.home")).toBe(true);
    expect(hasKey("not.a.key")).toBe(false);
  });
});

describe("translate (key lookup per locale)", () => {
  it("returns the locale's message", () => {
    expect(translate("en", "nav.child.home")).toBe("Home");
    expect(translate("zh-Hant", "nav.child.home")).toBe("首頁");
    expect(translate("en", "project.bridge.title")).toBe("Build a Bridge");
    expect(translate("zh-Hant", "project.bridge.title")).toBe("蓋一座橋");
  });
});

describe("ICU messages (TESTING.md section 6: ICU plurals)", () => {
  it("selects the greeting by period in both locales", () => {
    expect(translate("en", "home.greeting", { period: "morning" })).toBe(
      "Good morning, and ready to build?",
    );
    expect(translate("en", "home.greeting", { period: "afternoon" })).toBe(
      "Good afternoon, and ready to build?",
    );
    expect(translate("en", "home.greeting", { period: "evening" })).toBe(
      "Good evening, and ready to build?",
    );
    expect(translate("zh-Hant", "home.greeting", { period: "morning" })).toBe(
      "早上好，準備好建造了嗎？",
    );
    expect(translate("zh-Hant", "home.greeting", { period: "evening" })).toBe(
      "晚上好，準備好建造了嗎？",
    );
  });

  it("formats plurals, including the =0 exact branch", () => {
    expect(
      translate("en", "overview.completed.count", { count: 0 }),
    ).toContain("No projects finished yet");
    expect(
      translate("en", "overview.completed.count", { count: 3 }),
    ).toContain("3 projects finished");
    expect(
      translate("zh-Hant", "overview.completed.count", { count: 0 }),
    ).toContain("還沒有完成的專案");
    expect(
      translate("zh-Hant", "overview.completed.count", { count: 3 }),
    ).toContain("已完成 3 個專案");
  });

  it("interpolates named placeholders", () => {
    expect(
      translate("en", "overview.stage.body", { stage: "Explorer (6–8)" }),
    ).toBe("Exploring as Explorer (6–8). Set by a grown-up.");
    expect(
      translate("zh-Hant", "me.about.body", { stage: "探索者" }),
    ).toContain("你正以「探索者」的身份探索");
  });
});

describe("fallback (TESTING.md section 6: fallback to en)", () => {
  it("falls back to the en message when a locale misses a key", () => {
    const source = {
      en: { "nav.child.home": "Home" },
      "zh-Hant": {},
    };
    const t = createTranslator("zh-Hant", source);
    expect(t("nav.child.home")).toBe("Home");
  });

  it("returns the key itself for an unknown key instead of throwing", () => {
    const t = createTranslator("en");
    expect(t("does.not.exist" as MessageKey)).toBe("does.not.exist");
  });
});
