/**
 * P1-14 — Smoke journey 2 + the GOAL journey (TESTING.md §8): the child
 * starts Build a Bridge, uses a hint, finishes the lane and finds the
 * portfolio entry — on phone and tablet viewports, in both languages, with
 * live AI off (the default run: MentorService answers from the pre-written
 * ladder, and the parent Settings "Off (default)" chip proves the switch).
 *
 * Deterministic details:
 *  - Maker stage: its experience is the one that ships `test_log`, so each
 *    lab run appends `lab-log-N` — the sync point between the three runs
 *    (no fixed sleeps, TESTING.md §8 hygiene).
 *  - The no-pressure move-on path (SAFETY.md §9) finishes each lab step after
 *    three failed tests instead of requiring a solved bridge — the sanctioned
 *    route a real child takes when the physics does not cooperate. P1-15
 *    expanded the lane to five steps (learn → build → test → change →
 *    report), so the walk crosses three lab steps before reflection.
 *  - Reload mid-lane proves the position survives a fresh page load; stage
 *    and language are re-applied afterwards because the profile itself is
 *    still the shell placeholder until the app identity/profile client
 *    (P1-01/P1-02 wiring, P1-18) lands.
 *  - The API side of "child opens the profile" (device credential → child
 *    session) is covered by auth.spec.ts.
 */
import { expect, test, type Page } from "@playwright/test";

interface Copy {
  gateConfirm: string;
  aiOff: string;
  stageMaker: string;
  start: string;
  detailStart: string;
  stepOf: (n: number) => string;
  finishStep: string;
  hintButton: string;
  hint1: string;
  testGo: string;
  moveOn: string;
  next: string;
  seeWork: string;
  projectTitle: string;
}

const COPY: Record<"en" | "zh-Hant", Copy> = {
  en: {
    gateConfirm: "Confirm with passkey",
    aiOff: "Off (default)",
    stageMaker: "Maker (8–10)",
    start: "Start",
    detailStart: "Start building",
    stepOf: (n) => `Step ${n} of 5`,
    finishStep: "I finished this step",
    hintButton: "Get hint 1",
    hint1: "Hint 1",
    testGo: "Test it!",
    moveOn: "Move on for now",
    next: "Next step",
    seeWork: "See my work",
    projectTitle: "Build a Bridge",
  },
  "zh-Hant": {
    gateConfirm: "用通行密鑰確認",
    aiOff: "關閉（預設）",
    stageMaker: "創作者（8–10 歲）",
    start: "開始",
    detailStart: "開始蓋",
    stepOf: (n) => `第 ${n} 步，共 5 步`,
    finishStep: "我完成這一步了",
    hintButton: "拿第 1 個提示",
    hint1: "提示 1",
    testGo: "測測看！",
    moveOn: "先跳過",
    next: "下一步",
    seeWork: "看我的作品",
    projectTitle: "蓋一座橋",
  },
};

/** The header chip that flips the profile to zh-Hant (label is stable in en). */
const TO_ZH = "繁體中文";

async function openSettings(page: Page, copy: Copy): Promise<void> {
  await page.goto("/#parent/settings");
  await page.getByRole("button", { name: copy.gateConfirm }).click();
}

for (const lang of ["en", "zh-Hant"] as const) {
  const copy = COPY[lang];

  test(`child journey: bridge lane start → hint → finish → portfolio (${lang})`, async ({
    page,
  }) => {
    await page.goto("/");
    if (lang === "zh-Hant") await page.getByRole("button", { name: TO_ZH }).click();

    // Parent controls first: live AI off (the run this task requires) and the
    // Maker stage (its lab ships the test log used as the run barrier).
    await openSettings(page, copy);
    await expect(page.getByRole("button", { name: copy.aiOff })).toHaveAttribute(
      "data-selected",
      "true",
    );
    await page.getByRole("button", { name: copy.stageMaker }).click();
    await page.goto("/#explore");

    // Choose the project and start building.
    await page.getByRole("button", { name: copy.start, exact: true }).click();
    await expect(page).toHaveURL(/#project$/);
    await page.getByRole("button", { name: copy.detailStart }).click();
    await expect(page).toHaveURL(/#project\/step$/);
    await expect(page.getByRole("progressbar", { name: copy.stepOf(1) })).toBeVisible();

    // AI hint: MentorService with live AI off → pre-written ladder level 1.
    await page.getByRole("button", { name: copy.hintButton }).click();
    await expect(page.getByText(copy.hint1).first()).toBeVisible();

    // Finish step 1 (learn) → the first lab step. P1-15: five-step lane —
    // build, test and change are the lab steps 2–4, the report is step 5.
    await page.getByRole("button", { name: copy.finishStep }).click();
    await expect(page.getByRole("progressbar", { name: copy.stepOf(2) })).toBeVisible();

    // Progress saved: a fresh page load resumes at step 2. Stage and language
    // live on the placeholder profile only (P1-18), so re-apply them.
    await page.reload();
    if (lang === "zh-Hant") await page.getByRole("button", { name: TO_ZH }).click();
    await openSettings(page, copy);
    await page.getByRole("button", { name: copy.stageMaker }).click();
    await page.goto("/#project/step");
    await expect(page.getByRole("progressbar", { name: copy.stepOf(2) })).toBeVisible();

    // Lab steps 2–4: three failed tests each (empty design) → the no-pressure
    // move-on. Each run appends lab-log-N (1-based, restarting per step), so
    // waiting on it makes the loop deterministic.
    for (let step = 2; step <= 4; step += 1) {
      if (step > 2) {
        await expect(page.getByRole("progressbar", { name: copy.stepOf(step) })).toBeVisible();
      }
      const testButton = page.getByRole("button", { name: copy.testGo });
      for (let run = 1; run <= 3; run += 1) {
        await testButton.click();
        await expect(page.getByTestId(`lab-log-${run}`)).toBeVisible();
      }
      await page.getByRole("button", { name: copy.moveOn }).click();
    }

    // Step 5 (report): finish it to reach reflection.
    await expect(page.getByRole("progressbar", { name: copy.stepOf(5) })).toBeVisible();
    await page.getByRole("button", { name: copy.finishStep }).click();

    // Reflect (both prompts; Maker also shows the optional text fields).
    await page.getByTestId("reflect-done-0").click();
    await page.getByTestId("reflect-done-1").click();
    await page.getByRole("button", { name: copy.next }).click();

    // Portfolio entry exists and shows under Me.
    await expect(page.getByRole("button", { name: copy.seeWork })).toBeVisible();
    await page.getByRole("button", { name: copy.seeWork }).click();
    await expect(page).toHaveURL(/#me$/);
    await expect(page.getByText(copy.projectTitle)).toBeVisible();

    // No raw catalog keys leaked into the visible copy (TESTING.md §8).
    const mainText = await page.locator("main").innerText();
    expect(mainText).not.toMatch(/\b[a-z]+(?:\.[a-z]+){2,}\b/);
  });
}
