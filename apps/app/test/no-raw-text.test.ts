/**
 * P1-02 ACCEPTANCE: "lint fails on a raw string".
 *
 * Runs the cv/no-raw-text rule through ESLint's Linter on fixtures — the same
 * rule and config `pnpm lint` applies to every TSX file — so a regression
 * either way (rule stops catching raw copy, or rule starts blocking t())
 * fails here.
 */
import { Linter } from "eslint";
import tseslint from "typescript-eslint";
import { describe, expect, it } from "vitest";
import { noRawText } from "../../../scripts/eslint-rules/no-raw-text.mjs";

/** Mirrors the cv/no-raw-text block in eslint.config.js. */
const config = [
  {
    files: ["**/*.tsx"],
    plugins: {
      cv: { rules: { "no-raw-text": noRawText } },
    },
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: { ecmaFeatures: { jsx: true }, sourceType: "module" },
    },
    rules: {
      "cv/no-raw-text": "error",
    },
  },
] satisfies Linter.Config[];

function lint(code: string): Linter.LintMessage[] {
  return new Linter().verify(code, config, "fixture.tsx");
}

function errorTexts(code: string): string[] {
  return lint(code).map((message) => message.message);
}

describe("cv/no-raw-text (P1-02 acceptance: lint fails on a raw string)", () => {
  it("flags raw JSX text", () => {
    const messages = lint(`export const Title = () => <h2>Home</h2>;`);
    expect(messages).toHaveLength(1);
    expect(messages[0]?.message).toContain("Home");
    expect(messages[0]?.message).toContain('t("key")');
  });

  it("flags a raw string attribute on a text prop", () => {
    const messages = lint(`export const C = () => <Chip label="No creations" />;`);
    expect(messages).toHaveLength(1);
    expect(messages[0]?.message).toContain("No creations");
  });

  it("flags bilingual ternaries inside JSX expressions", () => {
    const messages = lint(
      `export const C = () => <p>{isEn ? "Continue" : "繼續"}</p>;`,
    );
    // One report per raw string: both branches must move to the catalog.
    expect(messages).toHaveLength(2);
    const text = messages.map((m) => m.message).join("\n");
    expect(text).toContain("Continue");
    expect(text).toContain("繼續");
  });

  it("flags a raw string behind a text-bearing object key", () => {
    const messages = lint(
      `export const C = () => <Chip label={pick()} />;\n` +
        `const opts = [{ label: isEn ? "Stage" : "階段" }];`,
    );
    // Both branches of the ternary are raw strings.
    expect(messages).toHaveLength(2);
    const text = messages.map((m) => m.message).join("\n");
    expect(text).toContain("Stage");
    expect(text).toContain("階段");
  });

  it("flags raw aria-label text", () => {
    const messages = lint(`export const C = () => <div aria-label="Language" />;`);
    expect(messages).toHaveLength(1);
  });

  it("passes t() calls, identifiers and code-valued attributes", () => {
    const good = `
      export const C = () => {
        const t = useT();
        const brand = "Createverse";
        navigateTo("#explore");
        return (
          <div className="cv-page" role="group" aria-labelledby="stage-label">
            <h2 className="cv-page-title">{t("nav.child.home")}</h2>
            <Icon name="lock" label={t("gate.icon")} />
            <Chip label={t("projects.chip.story")} icon="book" />
            <p>{isEn ? t("me.title") : t("me.title")}</p>
            <p aria-label={t("layout.language")}>·</p>
            <span>{brand}</span>
            <button
              className={\`cv-nav-item\${active ? " cv-nav-item--active" : ""}\`}
              aria-current={active ? "page" : undefined}
              data-selected={selected ? "true" : undefined}
            >
              {t("nav.child.home")}
            </button>
          </div>
        );
      };
    `;
    expect(errorTexts(good)).toEqual([]);
  });

  it("passes punctuation-only and numeric JSX text", () => {
    expect(errorTexts(`export const C = () => <span> · 0 </span>;`)).toEqual([]);
  });
});
