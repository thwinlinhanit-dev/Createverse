# DESIGN_SYSTEM.md — CREATEVERSE

Status: **Draft v0.1 for owner review**
Read with: Master Spec sections 24, 26, 27; `PRODUCT_SPEC.md`; `SAFETY.md` section 6; `ARCHITECTURE.md` section 12

One design system for child and parent apps. Token-driven. Three stage presets. Light theme first.

---

## 1. Direction

> Calm, warm, playful, accessible. A friendly workshop, not a casino.

- **Warm and clear** surfaces with generous space. Not a dense dashboard.
- **Subtle game-world warmth** (rounded shapes, gentle motion, friendly illustrations) without arcade pressure.
- **Depth by shadow and layering.** Translucent "glass" effects are optional and only on navigation if they stay fast and readable. Avoid heavy blur (performance and readability on mid-range phones).
- **No engagement visuals:** no streak flames, no point counters, no level bars, no pulsing "come back" badges, no confetti loops.
- Child and parent areas share tokens but use different compositions: child is playful and spacious, parent is clearer and denser.

---

## 2. Tokens

Tokens live in `packages/design-tokens` as JSON, compiled to CSS variables (`--cv-*`). Components use **semantic tokens only**, never raw values.

### 2.1 Color (light theme)

All pairs below were checked for contrast. Text pairs meet WCAG AA (4.5:1 or better). Control boundaries and focus rings meet 3:1 or better.

| Token | Value | Use | Check |
|---|---|---|---|
| `color.bg` | `#FFF9F0` | App background (warm cream) | |
| `color.surface` | `#FFFFFF` | Cards, sheets | |
| `color.surfaceAlt` | `#F5EFE4` | Secondary surfaces, chips | |
| `color.text` | `#1F2430` | Body text | 14.8:1 on bg |
| `color.textMuted` | `#4A5160` | Secondary text | 7.6:1 on bg, 7.0:1 on surfaceAlt |
| `color.primary` | `#0F766E` | Main actions, selected state (calm teal) | 5.2:1 on bg |
| `color.onPrimary` | `#FFFFFF` | Text on primary | 5.5:1 |
| `color.accent` | `#FFC857` | Highlights, friendly emphasis (warm yellow) | |
| `color.onAccent` | `#1F2430` | Text on accent | 10.1:1 |
| `color.success` | `#1B7F4D` | Success feedback | 5.0:1 with white text |
| `color.danger` | `#B3261E` | Errors, destructive actions | 6.5:1 with white text |
| `color.info` | `#1F5FBF` | Information, focus ring | 6.1:1 with white text, 5.8:1 on bg |
| `color.warningText` | `#8A5A00` | Warning text | 5.7:1 on bg |
| `color.border` | `#7A808C` | Control boundaries | 3.8:1 on bg, 4.0:1 on surface |
| `color.focusRing` | `#1F5FBF` | Focus outline (3 px) | 5.8:1 on bg |
| `color.stress.compression` | `#1F5FBF` | Force view: squeezed | Always paired with diagonal-stripe pattern |
| `color.stress.tension` | `#C2410C` | Force view: stretched | Always paired with dotted pattern |

Rules:
- Meaning is **never** carried by color alone (see section 8).
- Failure is not red-alarm. Use `info` or neutral styling with kind words. `danger` is for destructive parent actions and real errors.
- A dark theme is a later token set. Do not hard-code light values anywhere.

### 2.2 Typography

Font stack (no web fonts, offline-friendly, fast):

```css
--cv-font: system-ui, -apple-system, "Segoe UI", Roboto,
           "PingFang TC", "Noto Sans TC", "Microsoft JhengHei", sans-serif;
```

| Token | Junior | Explorer | Maker | Parent |
|---|---|---|---|---|
| `font.size.body` | 24 px | 18 px | 16 px | 16 px |
| `font.size.title` | 32 px | 26 px | 22 px | 22 px |
| `font.size.small` | 20 px | 15 px | 14 px | 14 px |
| `font.lineHeight` | 1.5 | 1.5 | 1.45 | 1.45 |

- Traditional Chinese: line-height at least 1.6, no italics, no letter-spacing, avoid very light weights, allow natural CJK line breaking. Verify on the real devices.
- Text must scale to **200 percent** without clipping or overlap. Use relative units (`rem`).
- Weights: regular (400) and semibold (600). Sparing use of bold.
- Junior screens use short phrases. Long text is read aloud, not shown.

### 2.3 Spacing, radius, elevation, motion

| Token group | Values |
|---|---|
| Spacing (4 px grid) | 4, 8, 12, 16, 24, 32, 48, 64. Stage presets scale the default gap |
| Radius | small 8, medium 16, large 24, pill 999. Junior prefers large |
| Elevation | level 0 none, 1 soft shadow for cards, 2 for sheets and dialogs. Shadows are soft and low contrast |
| Motion duration | quick 120 ms, base 200 ms, slow 320 ms |
| Motion easing | ease-out for entering, ease-in for leaving. No bounce loops |

Reduced motion (system setting or parent setting): remove non-essential animation, replace movement with fades, no auto-playing loops. The simulation itself still runs, but without camera shake or particles.

### 2.4 Icons

- Simple, consistent, rounded icons. Always paired with a text label, except in the Junior preset where picture-first is the rule and each icon has a spoken label.
- Use inline SVG from a small permissive open-source set chosen in task P0-04 (adding a dependency needs a short written justification).
- Every icon-only button has an accessible name in both languages.

---

## 3. Stage presets

Presets override tokens. The same components and screens adapt.

| Setting | Junior (3 to 5) | Explorer (6 to 8) | Maker (8 to 10) |
|---|---|---|---|
| Minimum touch target | 64 px | 56 px | 48 px |
| Body text | 24 px | 18 px | 16 px |
| Text policy | Almost none. Icons, pictures, spoken prompts | Short sentences, read-aloud available | Fuller text, technical words explained |
| Layout density | Very spacious, 1 main action per screen | Spacious | Moderate, test log and controls visible |
| Radius | large | medium to large | medium |
| Feedback | Big, gentle, spoken | Friendly short text | Informative: what happened and why |
| Controls | Drag with snap, big handles, no precision | Snap to grid, undo | Snap optional, undo and redo, force view, test log |
| Motion | Gentle, slow | Gentle | Light |
| Mentor | Pre-written hints only, spoken | Hints plus optional limited help | Hints plus optional help |

Preset follows the child's stage and a parent can change it. A stage never auto-promotes.

---

## 4. Layout and responsiveness

| Context | Rule |
|---|---|
| Phone portrait | Bottom navigation (5 items). Single column. Content in the thumb zone |
| Phone landscape | Experiences use the full width. Navigation collapses |
| Tablet | Navigation rail or bar. Two-column layouts where useful (story and activity). Experiences prefer landscape |
| Safe areas | Respect notches and home indicators (`env(safe-area-inset-*)`) |
| Breakpoints | compact under 600 px, medium 600 to 1024 px, expanded above 1024 px |

- Avoid hover-only interactions. Everything works by touch.
- Avoid edge gestures that conflict with system navigation.
- Experiences handle rotation without losing state.

---

## 5. Components

Built in `packages/ui`, each with documented states (default, pressed, focus, disabled, loading, error where relevant), both languages, all three presets.

| Component | Notes |
|---|---|
| Button | Primary, secondary, quiet, destructive (parent only). Min target per preset. Label required |
| IconButton | Always has an accessible name. Junior adds a spoken label |
| Card | Surface with elevation 1. Used for project, activity, portfolio |
| Chip | Filters and tags. Never used as points or badges |
| Tabs / Navigation | Bottom bar (phone), rail (tablet). Current item has icon, label and shape change, not only color |
| Dialog and Sheet | Focus trapped, closable by button and by back gesture. Parent confirmations use clear verbs |
| ProgressRing | Shows position in a project (step 2 of 4). Never a score or a streak |
| ProjectCard | Title, story image, stage, "continue" or "start" |
| StepCard | Prompt, play-aloud button, action |
| MentorHint | A hint bubble with the level shown as small steps, a "need a bigger hint?" button, and a speaker button. Plain, no avatar that pretends to be a person |
| ExperienceHUD | Go, Try again, pieces left or coins, vehicle chooser, force view toggle (Maker), undo and redo. Placed to avoid covering the build area |
| SkillBadge | A calm label that says what the child can do ("I can test a bridge"). No levels or points |
| PortfolioCard | Snapshot, title, date, what I learned |
| ParentGate | Fresh passkey prompt for sensitive parent actions |
| SafetyNotice | Plain-language parent notice with severity and suggested next step |
| Timer-free session end | Calm "Great work. Want to save this and take a break?" screen |

**Mentor presentation rule:** the mentor is shown as a tool (a lightbulb or helper icon with a text label like "Help"), not as a character with a face or a name that implies friendship.

---

## 6. Content and tone for children

- Kind, plain, short. Say what happened and what to try, not who was right or wrong.
- Use "Not yet" and "Let's see what happened", not "Wrong" or "You failed".
- Celebrate effort and discovery: "You tried three ideas. Which worked best?"
- Never create urgency ("Hurry!", "Don't lose your streak").
- No comparison with other children.
- Name things precisely and consistently in both languages. Keep terms (plank, pillar, brace) the same across steps and hints.
- Illustrations are inclusive and avoid stereotypes. Keep illustrations simple vector shapes so they load fast and work offline.

---

## 7. Parent app composition

- Clearer, denser, calm. Plain language. Learning evidence first, time last.
- Safety and consent controls are prominent but not alarming.
- Sensitive actions use the ParentGate.
- Charts are simple, labeled, accessible (patterns and labels), no red-green only encodings.

---

## 8. Accessibility rules (required)

| Rule | Detail |
|---|---|
| Contrast | Text 4.5:1 or better, large text and controls 3:1 or better. Tests run on all tokens in every preset |
| Touch targets | 48 px minimum, 64 px in Junior, with spacing between targets |
| Not color alone | Force view uses blue plus diagonal stripes for compression and orange plus dots for tension, plus text labels in the legend. Success and failure always include an icon and words |
| Text scaling | Works to 200 percent. No fixed-height text containers |
| Focus | Visible 3 px focus ring, logical order, no keyboard traps |
| Screen readers | Landmarks, labels, live regions for experience results ("Your bridge held for 5 seconds") in both languages |
| Reduced motion | Honored everywhere (section 2.3) |
| Read-aloud | Speaker control on Junior and Explorer steps. Pause and stop always visible |
| Captions | Any recorded audio or video has captions |
| Simple-language mode | Hook for shorter text in any preset |
| Keyboard alternative | Experience placement can be done with keyboard or switch input (select, move, place) |
| Time | Nothing is timed against the child. Parent time limits end sessions calmly |

---

## 9. Theming

- Themes are token sets (color, type, spacing, radius, shadow, motion, iconography, elevation).
- Components must not change when a theme changes.
- Phase 1 ships one light theme. A dark theme and a child-selectable theme come later by adding token sets only.

---

## 10. Implementation notes for agents

- Tokens: JSON source of truth, generated CSS variables, TypeScript types.
- Presets are applied by a `data-stage` attribute on the app root.
- No inline hex values in components. Lint rule recommended.
- Provide a preview page that renders every component in every preset and both languages (task P0-04).
- Automated checks: contrast math over all token pairs, touch-target size assertions, axe, and screenshot snapshots per preset and language.
- Performance: no bundled web fonts, small SVG illustrations, avoid layout shifts, avoid large blur filters.
