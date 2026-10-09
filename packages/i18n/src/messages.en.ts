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
  "overview.concepts.row": "{name} — level {level} of {levels}",
  "overview.skills.label": "Skills developing",
  "overview.skills.row":
    "{name} — level {level} of {levels}, {count, plural, one {# evidence entry} other {# evidence entries}}",
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
  "progress.mentor.title": "Mentor help",
  "progress.mentor.empty":
    "No hints asked yet. Each hint request shows here with its step, level and date.",
  "progress.mentor.item": "{step} — hint {level} · {date}",
  "progress.mentor.fallback": "{step} — offered to ask a grown-up · {date}",

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

  // ---- project runner (P1-04/P1-05) ---------------------------------------
  "runner.back": "Back",
  "runner.loading": "Loading your project…",
  "runner.loadError.title": "The project could not load",
  "runner.loadError.body":
    "The project file is missing or damaged. Your saved work is safe. Try again later.",
  "runner.retry": "Try again",
  "runner.draft.title": "Grown-up preview",
  "runner.draft.body":
    "This project is not reviewed yet. A grown-up stays nearby while trying it.",
  "runner.stepOf": "Step {current} of {total}",
  "runner.step.state.done": "Done",
  "runner.step.state.now": "Now",
  "runner.step.state.later": "Later",
  "runner.listen": "Listen",
  "runner.stopListen": "Stop",
  "runner.step.done": "I finished this step",
  "runner.step.next": "Next step",
  "runner.step.needSuccess": "Test your bridge until it holds, then continue.",
  "runner.moveOn": "Move on for now",
  "runner.moveOn.body":
    "You tested {count} times. You can move on and come back later.",
  "runner.finish.title": "Project finished!",
  "runner.finish.body":
    "You built a bridge and tested it. It is saved in your portfolio.",
  "runner.reflect.title": "Think about your bridge",
  "runner.reflect.done": "I thought about it",
  "runner.reflect.write": "Write if you want (optional)",
  "runner.portfolio.title": "Saved to your portfolio",
  "runner.portfolio.view": "See my work",
  "project.detail.start": "Start building",
  "project.detail.continue": "Continue building",
  "project.detail.story": "The story",
  "project.detail.mission": "Your mission",
  "project.detail.steps": "Steps",
  "project.detail.safety": "Safety note",
  "hint.get": "Get a hint",
  "hint.getLevel": "Get hint {level}",
  "hint.used":
    "{count, plural, =0 {No hints yet} one {# hint used} other {# hints used}}",
  "hint.exhausted": "You saw all the hints. Try your idea, or ask a grown-up.",
  "hint.of": "Hint {level}",

  // ---- bridge lab ----------------------------------------------------------
  "lab.tray": "Choose a piece",
  "lab.piece.plank": "Plank",
  "lab.piece.pillar": "Pillar",
  "lab.piece.beam": "Beam",
  "lab.piece.brace": "Brace",
  "lab.material": "Material",
  "lab.material.wood": "Wood",
  "lab.material.steel": "Steel",
  "lab.vehicle": "Vehicle",
  "lab.vehicle.car": "Toy car",
  "lab.vehicle.truck": "Truck",
  "lab.vehicle.train": "Train",
  "lab.go": "Test it!",
  "lab.testing": "Testing…",
  "lab.reset": "Test again (keep my bridge)",
  "lab.clear": "Remove all pieces",
  "lab.undo": "Undo",
  "lab.redo": "Redo",
  "lab.force": "See the squeeze",
  "lab.force.legend":
    "Blue stripes mean squeezed. Orange dots mean stretched. Roughly, not exactly.",
  "lab.testlog": "Test log",
  "lab.testlog.empty": "No tests yet. Build, then test.",
  "lab.piecesLeft":
    "{count, plural, =0 {No pieces left} one {# piece left} other {# pieces left}}",
  "lab.cost": "Cost {cost} of {budget} coins",
  "lab.tries":
    "{count, plural, =0 {No tests yet} one {# test} other {# tests}} so far",
  "lab.success.title": "It held!",
  "lab.success.body": "Your bridge carried the vehicle across and held.",
  "lab.fail.title": "It broke — good test!",
  "lab.fail.cross": "The vehicle could not cross. Make the road stronger.",
  "lab.fail.hold": "It crossed but broke too soon. Add support underneath.",
  "lab.fail.budget": "It held, but cost too many coins. Try fewer or cheaper pieces.",
  "lab.fail.pieces": "Too many pieces. Try a simpler design.",
  "lab.fail.unstable": "That test wobbled. Let's try that again.",
  "lab.fail.generic": "It did not hold this time. Change something and test again.",
  "lab.place.first": "Tap where the piece starts.",
  "lab.place.second": "Tap where the piece ends.",
  "lab.canvas.label":
    "Bridge building area. Arrow keys move, Enter places, Escape cancels.",
  "lab.keyboard": "Keyboard: arrows move, Enter places, Escape cancels.",
  "lab.error.no_anchor": "Pieces must touch the banks or another piece.",
  "lab.error.max_pieces": "No pieces left. Remove one to try another.",
  "lab.error.build_disabled": "This step is for testing only.",
  "lab.error.overlapping_piece": "That spot is full. Try a free spot.",
  "lab.error.too_short": "That piece is too short.",
  "lab.error.piece_not_allowed": "This step does not use that piece.",
  "lab.error.material_not_allowed": "This step uses wood only.",
  "lab.error.run_in_progress": "The test is running.",
  "lab.error.physics_unstable": "That test wobbled. Let's try that again.",
  "lab.error.not_loaded": "The bridge is still loading.",
  "lab.announce.placed":
    "{count, plural, one {# piece} other {# pieces}} on the bridge.",
  "lab.announce.success": "Your bridge held!",
  "lab.announce.fail": "The bridge broke. Try changing your design.",

  // ---- parent: real progress (P1-05 on-device store) -----------------------
  "progress.activities.real":
    "{activities} activities · {hints} hints asked · {experiments} tests run",
  "progress.last.project": "Started {project}",
  "progress.last.activity": "Finished a step in {project}",
  "progress.last.experiment": "Tested the bridge in {project}",
  "progress.last.reflection": "Thought about {project}",
  "progress.last.completed": "Finished {project}",
  "progress.last.hint": "Asked for a hint in {project}",
  "progress.sync.pending":
    "{count, plural, =0 {Everything is saved on this device.} one {# change saved on this device, sends later.} other {# changes saved on this device, send later.}}",
} satisfies Record<string, string>;

/** Every message key in the system (derived from the English catalog). */
export type MessageKey = keyof typeof en;
