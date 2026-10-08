/**
 * English message catalog — the source of truth for message keys (ADR-0008).
 *
 * Every user-visible string in the app is a key here; `MessageKey` is derived
 * from this object, so `messages.zhHant.ts` cannot miss or invent a key
 * (compile-time parity, asserted again at runtime in i18n.test.ts).
 *
 * Values use ICU message syntax (placeholders, select, plural) — never string
 * concatenation (ADR-0008 consequences).
 */
export const en = {
  // ---- app chrome / fallbacks -------------------------------------------
  "app.fallback.title": "Home",
  "app.fallback.body": "Load failed. Tap a nav item to return.",
  "app.error.title": "Error",

  // ---- shared buttons ----------------------------------------------------
  "button.continue": "Continue",

  // ---- project (shared demo copy) ---------------------------------------
  "project.bridge.title": "Build a Bridge",
  "project.bridge.body": "Put the planks together so the toy car can cross.",

  // ---- layout / header ---------------------------------------------------
  "layout.stage": "Stage",
  "layout.language": "Language",
  "layout.tagline.child": "One calm learning space",
  "layout.tagline.parent": "Parent",

  // ---- navigation --------------------------------------------------------
  "nav.child.aria": "Page sections",
  "nav.parent.aria": "Parent sections",
  "nav.child.home": "Home",
  "nav.child.explore": "Explore",
  "nav.child.create": "Create",
  "nav.child.projects": "Projects",
  "nav.child.me": "Me",
  "nav.parent.overview": "Overview",
  "nav.parent.progress": "Progress",
  "nav.parent.portfolio": "Portfolio",
  "nav.parent.safety": "Safety",
  "nav.parent.settings": "Settings",

  // ---- stages and languages ---------------------------------------------
  "stage.junior": "Junior",
  "stage.explorer": "Explorer",
  "stage.maker": "Maker",
  "stage.parent": "Parent",
  "stageAge.junior": "Junior (3–5)",
  "stageAge.explorer": "Explorer (6–8)",
  "stageAge.maker": "Maker (8–10)",
  "stageAge.parent": "Parent",
  "lang.en": "English",
  "lang.zhHant": "繁體中文",

  // ---- parent gate -------------------------------------------------------
  "gate.icon": "Locked",
  "gate.title": "Parent area is locked",
  "gate.reason": "This area is for grown-ups. To open it, confirm with a passkey.",
  "gate.note": "Your child is told that you can open this area.",
  "gate.confirm": "Confirm with passkey",
  "gate.notNow": "Not now",

  // ---- child: home -------------------------------------------------------
  "home.greeting":
    "{period, select, morning {Good morning, and ready to build?} afternoon {Good afternoon, and ready to build?} other {Good evening, and ready to build?}}",
  "home.lead": "Pick up where you left off, or start something new. Your bridge is waiting.",
  "home.continue.title": "Continue",
  "home.challenge.title": "Today's challenge",
  "home.challenge.body": "Make a bridge that holds the toy car for 8 seconds.",
  "home.challenge.cta": "Try this challenge",
  "home.recent.title": "Recent creations",
  "home.recent.bridge": "Bridge",
  "home.recent.wood": "Wood",
  "home.recent.seconds": "8 seconds",
  "home.recent.empty": "No creations yet. Build your first bridge in Explore.",

  // ---- child: explore ----------------------------------------------------
  "explore.title": "Explore",
  "explore.lead": "Projects for your stage. Pick one and start building.",
  "explore.start": "Start",
  "explore.story": "Read the story",
  "explore.build.title": "What you can build",
  "explore.build.car": "A bridge for a toy car",
  "explore.build.strong": "A stronger bridge",
  "explore.build.tune": "A bridge with a tune",
  "explore.empty": "More projects arrive as you grow. Build a Bridge is ready now.",

  // ---- child: create -----------------------------------------------------
  "create.title": "Create",
  "create.lead": "Your creations live here. Build something and it appears on your shelf.",
  "create.mine": "My creations",
  "create.empty": "Nothing here yet. Finish a project in Projects to see it here.",
  "create.noChips": "No creations",
  "create.quick": "Quick starts",
  "create.start": "Start building",
  "create.note": "Free creation tools come later. For now, build a bridge and save it.",

  // ---- child: projects ---------------------------------------------------
  "projects.title": "Projects",
  "projects.lead": "Your active project and the ones you finished. Pick one to open it.",
  "projects.inProgress": "In progress",
  "projects.seeWork": "See my work",
  "projects.finished": "Finished",
  "projects.finishedEmpty": "No finished projects yet. Complete a project to see it here.",
  "projects.noFinished": "No finished projects",
  "projects.what": "What a project looks like",
  "projects.whatBody":
    "A project is a story, then things to try, then a challenge, then a chance to think about what you built.",
  "projects.chip.story": "Story",
  "projects.chip.try": "Try",
  "projects.chip.challenge": "Challenge",
  "projects.chip.think": "Think",

  // ---- child: me ---------------------------------------------------------
  "me.title": "Me",
  "me.lead": "What you can do, and what you have built. No points, no levels — just your growth.",
  "me.skills.title": "What I can do",
  "me.skill.test": "I can test a bridge",
  "me.skill.planks": "I can choose good planks",
  "me.skill.explain": "I can explain what worked",
  "me.skills.empty":
    "More skills appear as you finish projects and explain what you built.",
  "me.portfolio.title": "My portfolio",
  "me.portfolio.body": "Your finished projects and what you learned from them. Nothing here yet.",
  "me.portfolio.chip": "No portfolio yet",
  "me.about.title": "About me",
  "me.about.body":
    "You are exploring as a {stage}. Your stage changes when a grown-up sets it.",
  "me.back": "Back to home",

  // ---- parent: overview --------------------------------------------------
  "overview.title": "Overview",
  "overview.lead":
    "Learning first. Here is what your child is growing — not how long they spent.",
  "overview.stage.label": "Stage",
  "overview.stage.body": "Exploring as {stage}. Set by a grown-up.",
  "overview.concepts.label": "Concepts growing",
  "overview.concepts.body": "Testing a bridge · Choosing good planks · Seeing what holds",
  "overview.skills.label": "Skills developing",
  "overview.skills.body":
    "I can test a bridge · I can choose good planks · I can explain what worked",
  "overview.completed.title": "Projects completed",
  "overview.completed.count":
    "{count, plural, =0 {No projects finished yet. Build a Bridge is the first project ready for your child's stage.} other {# projects finished. Build a Bridge is the first project ready for your child's stage.}}",
  "overview.interests.title": "Interests and struggles",
  "overview.interests.likes": "Likes: bridge building",
  "overview.interests.struggles": "Struggles: none yet",
  "overview.interests.empty":
    "Interests and struggles appear as your child plays. Nothing recorded yet.",
  "overview.suggest.title": "Suggested next",
  "overview.suggest.open": "Open project",
  "overview.time.title": "Time",
  "overview.time.body":
    "Time is last here on purpose. Learning is the headline. Setting a daily limit is in Settings.",

  // ---- parent: progress --------------------------------------------------
  "progress.title": "Progress",
  "progress.lead": "What your child did, step by step. Not a score — evidence of learning.",
  "progress.activities.label": "Activities completed",
  "progress.activities.body": "0 activities · 0 hints asked · 0 challenges passed",
  "progress.last.label": "Last activity",
  "progress.last.body": "Not started yet — open a project to begin.",
  "progress.recent.title": "Recent activity",
  "progress.recent.empty": "No activity recorded yet. Activity appears as your child plays a project.",
  "progress.recent.chip": "No activity yet",
  "progress.how.title": "How progress is kept",
  "progress.how.body":
    "Every action is saved right away, works offline, and can be resumed later. Nothing is timed against your child.",
  "progress.how.saved": "Saved as you go",
  "progress.how.offline": "Works offline",
  "progress.how.notime": "No time pressure",

  // ---- parent: portfolio -------------------------------------------------
  "portfolio.title": "Portfolio",
  "portfolio.lead":
    "Your child's finished work: what they built, what they learned, and what they said about it.",
  "portfolio.entries.title": "Entries",
  "portfolio.entries.empty":
    "No portfolio entries yet. A finished project creates one here with the final design, the test log, and your child's reflection.",
  "portfolio.entries.chip": "No entries yet",
  "portfolio.contains.title": "What an entry contains",
  "portfolio.contains.design": "Final design",
  "portfolio.contains.testlog": "Test log",
  "portfolio.contains.reflection": "Reflection",
  "portfolio.entries.body":
    "Every entry points to an existing artifact. A parent can delete entries and their artifacts.",
  "portfolio.entries.action": "See artifacts",
  "portfolio.access.title": "About access",
  "portfolio.access.body":
    "Your child and you can both view the portfolio. You can delete entries. Your child is told that you can read their work.",

  // ---- parent: safety ----------------------------------------------------
  "safety.title": "Safety",
  "safety.lead":
    "What the app watched for and how it kept things safe. Plain language, nothing alarming unless it needs to be.",
  "safety.settings.title": "Safety settings",
  "safety.ai.label": "Live AI",
  "safety.ai.body":
    "Turned off. Pre-written hints are the default. Your child never gets answers from a live AI.",
  "safety.risk.label": "Risk allowed",
  "safety.risk.body": "Low risk only. Anything riskier needs a grown-up.",
  "safety.realworld.label": "Real-world extensions",
  "safety.realworld.body": "Only low-risk, grown-up approved extensions are allowed.",
  "safety.events.title": "Recent safety events",
  "safety.events.empty":
    "No safety events yet. If something gets blocked or redirected, it appears here in plain language.",
  "safety.events.chip": "None yet",
  "safety.how.title": "How the app stays safe",
  "safety.how.input": "Input checked",
  "safety.how.output": "Output checked",
  "safety.how.age": "Age appropriate",
  "safety.how.privacy": "No personal data sent out",
  "safety.how.body":
    "Every exchange is checked before and after. Risky requests get a safe alternative, never instructions. Nothing personal leaves the device.",

  // ---- parent: settings --------------------------------------------------
  "settings.title": "Settings",
  "settings.lead":
    "Set how your child experiences the app. Sensitive changes need a fresh passkey check.",
  "settings.stage.title": "Child's stage",
  "settings.stage.body":
    "A child's stage changes how the app looks and behaves. Only a grown-up can change it.",
  "settings.lang.title": "Child's language",
  "settings.lang.body":
    "Every string exists in English and Traditional Chinese. The language follows the child's profile.",
  "settings.time.title": "Daily time limit",
  "settings.time.body":
    "No limit set yet. Setting a limit ends sessions calmly — nothing is timed against your child.",
  "settings.time.none": "No limit",
  "settings.time.hour1": "1 hour",
  "settings.time.hour2": "2 hours",
  "settings.ai.title": "Live AI",
  "settings.ai.off": "Off (default)",
  "settings.ai.explorer": "On for Explorer",
  "settings.ai.maker": "On for Maker",
  "settings.ai.body":
    "Live AI is optional and capped. Pre-written hints are the default. Junior never gets live AI.",
  "settings.read.title": "Read aloud",
  "settings.read.junior": "On for Junior",
  "settings.read.explorer": "On for Explorer",
  "settings.read.off": "Off",
  "settings.read.body":
    "Pre-reader prompts can be read aloud on the device. Pause and stop are always visible.",
  "settings.export.title": "Export and delete",
  "settings.export.action": "Export a child's data",
  "settings.delete.action": "Delete a child's data",
  "settings.export.body":
    "Export and delete are available once a child exists. Sensitive actions need a fresh passkey check.",
} satisfies Record<string, string>;

/** Every message key in the system (derived from the English catalog). */
export type MessageKey = keyof typeof en;
