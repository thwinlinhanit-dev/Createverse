/**
 * Traditional Chinese (zh-Hant) message catalog (ADR-0008).
 *
 * Typed as `Record<MessageKey, string>` so TypeScript fails the build if a key
 * is missing or invented — the same guarantee the content validator gives the
 * content packs (ADR-0007). Copy preserves the wording the shell already
 * shipped with; changes to child-facing wording need native-speaker review
 * (SAFETY.md §13), so do not edit casually.
 */
import type { MessageKey } from "./messages.en.ts";

export const zhHant: Record<MessageKey, string> = {
  // ---- app chrome / fallbacks -------------------------------------------
  "app.fallback.title": "首頁",
  "app.fallback.body": "載入失敗。點一個頁面項目回來。",
  "app.error.title": "錯誤",

  // ---- shared buttons ----------------------------------------------------
  "button.continue": "繼續",

  // ---- project (shared demo copy) ---------------------------------------
  "project.bridge.title": "蓋一座橋",
  "project.bridge.body": "把木板拼起來，讓玩具車順利通過。",

  // ---- layout / header ---------------------------------------------------
  "layout.stage": "階段",
  "layout.language": "語言",
  "layout.tagline.child": "一個寧靜的學習空間",
  "layout.tagline.parent": "家長",

  // ---- navigation --------------------------------------------------------
  "nav.child.aria": "頁面章節",
  "nav.parent.aria": "家長頁面",
  "nav.child.home": "首頁",
  "nav.child.explore": "探索",
  "nav.child.create": "創作",
  "nav.child.projects": "專案",
  "nav.child.me": "關於我",
  "nav.parent.overview": "總覽",
  "nav.parent.progress": "進度",
  "nav.parent.portfolio": "作品集",
  "nav.parent.safety": "安全",
  "nav.parent.settings": "設定",

  // ---- stages and languages ---------------------------------------------
  "stage.junior": "幼兒",
  "stage.explorer": "探索者",
  "stage.maker": "創作者",
  "stage.parent": "家長",
  "stageAge.junior": "幼兒（3–5 歲）",
  "stageAge.explorer": "探索者（6–8 歲）",
  "stageAge.maker": "創作者（8–10 歲）",
  "stageAge.parent": "家長",
  "lang.en": "英文",
  "lang.zhHant": "繁體中文",

  // ---- parent gate -------------------------------------------------------
  "gate.icon": "已鎖定",
  "gate.title": "家長區域已鎖定",
  "gate.reason": "這個區域是給家長的。要打開它，請用通行密鑰確認。",
  "gate.note": "孩子知道你能打開這個區域。",
  "gate.confirm": "用通行密鑰確認",
  "gate.notNow": "先不打開",

  // ---- child: home -------------------------------------------------------
  "home.greeting":
    "{period, select, morning {早上好，準備好建造了嗎？} afternoon {下午好，準備好建造了嗎？} other {晚上好，準備好建造了嗎？}}",
  "home.lead": "從上次停下的地方繼續，或者開始新的事物。你的橋正在等你。",
  "home.continue.title": "繼續",
  "home.challenge.title": "今天的挑戰",
  "home.challenge.body": "做一座能讓玩具車撐住 8 秒的橋。",
  "home.challenge.cta": "試試這個挑戰",
  "home.recent.title": "最近的創作",
  "home.recent.bridge": "橋",
  "home.recent.wood": "木頭",
  "home.recent.seconds": "8 秒",
  "home.recent.empty": "還沒有創作。到「探索」裡蓋你的第一座橋吧。",

  // ---- child: explore ----------------------------------------------------
  "explore.title": "探索",
  "explore.lead": "適合你階段的專案。選一個，開始建造。",
  "explore.start": "開始",
  "explore.story": "看故事",
  "explore.build.title": "你能建造什麼",
  "explore.build.car": "一座給玩具車的橋",
  "explore.build.strong": "一座更強的橋",
  "explore.build.tune": "一座帶聲音的橋",
  "explore.empty": "更多專案會隨著你成長而登場。先從「蓋一座橋」開始。",

  // ---- child: create -----------------------------------------------------
  "create.title": "創作",
  "create.lead": "你的創作都在這裡。建造一樣東西，它就會出現在你的架子上。",
  "create.mine": "我的創作",
  "create.empty": "還沒有創作。先去「專案」裡完成一個專案，它就會出現在這裡。",
  "create.noChips": "還沒有創作",
  "create.quick": "快速開始",
  "create.start": "開始建造",
  "create.note": "自由創作工具稍後再加。現在先蓋一座橋，把它存起來。",

  // ---- child: projects ---------------------------------------------------
  "projects.title": "專案",
  "projects.lead": "你正在做的專案，和你已經完成的。選一個打開它。",
  "projects.inProgress": "進行中",
  "projects.seeWork": "看我的作品",
  "projects.finished": "已完成",
  "projects.finishedEmpty": "還沒有完成的專案。完成一個專案，它就會出現在這裡。",
  "projects.noFinished": "還沒有完成的專案",
  "projects.what": "專案長什麼樣",
  "projects.whatBody": "一個專案是：一個故事，然後幾個嘗試，然後一個挑戰，最後是想一想你建造了什麼。",
  "projects.chip.story": "故事",
  "projects.chip.try": "嘗試",
  "projects.chip.challenge": "挑戰",
  "projects.chip.think": "想一想",

  // ---- child: me ---------------------------------------------------------
  "me.title": "關於我",
  "me.lead": "你能做什麼，和你建造了什麼。沒有分數，沒有等級——只有你的成長。",
  "me.skills.title": "我能做什麼",
  "me.skill.test": "我可以測試一座橋",
  "me.skill.planks": "我可以選擇好的木板",
  "me.skill.explain": "我可以解釋什麼有效",
  "me.skills.empty": "你完成專案、解釋你建造了什麼，技能就會越來越多。",
  "me.portfolio.title": "我的作品集",
  "me.portfolio.body": "你完成的專案，和你從中學到的事。還沒有東西。",
  "me.portfolio.chip": "還沒有作品集",
  "me.about.title": "關於我",
  "me.about.body": "你正以「{stage}」的身份探索。階段是由家長設定的。",
  "me.back": "回到首頁",

  // ---- parent: overview --------------------------------------------------
  "overview.title": "總覽",
  "overview.lead": "先看學習。這是孩子正在成長的地方——不是花了多久時間。",
  "overview.stage.label": "階段",
  "overview.stage.body": "以「{stage}」的身份探索。由家長設定。",
  "overview.concepts.label": "正在成長的概念",
  "overview.concepts.body": "測試一座橋 · 選擇好的木板 · 看什麼能撐住",
  "overview.skills.label": "正在發展的技能",
  "overview.skills.body": "我可以測試一座橋 · 我可以選擇好的木板 · 我可以解釋什麼有效",
  "overview.completed.title": "已完成的專案",
  "overview.completed.count":
    "{count, plural, =0 {還沒有完成的專案。「蓋一座橋」是孩子現在階段第一個準備好的專案。} other {已完成 # 個專案。「蓋一座橋」是孩子現在階段第一個準備好的專案。}}",
  "overview.interests.title": "感興趣和卡住的地方",
  "overview.interests.likes": "喜歡：蓋橋",
  "overview.interests.struggles": "卡住的地方：還沒有",
  "overview.interests.empty": "孩子玩的時候，興趣和卡住的地方就會出現。還沒有記錄。",
  "overview.suggest.title": "接下來的建議",
  "overview.suggest.open": "打開專案",
  "overview.time.title": "時間",
  "overview.time.body": "時間故意放在最後。學習才是重點。每天的時間限制在「設定」裡。",

  // ---- parent: progress --------------------------------------------------
  "progress.title": "進度",
  "progress.lead": "孩子做了什麼，一步一步。不是分數——而是學習的證據。",
  "progress.activities.label": "完成的活動",
  "progress.activities.body": "0 個活動 · 0 次提示 · 0 個挑戰通過",
  "progress.last.label": "上次活動",
  "progress.last.body": "還沒有開始——打開一個專案開始。",
  "progress.recent.title": "最近的活動",
  "progress.recent.empty": "還沒有活動記錄。孩子玩專案時，活動就會出現。",
  "progress.recent.chip": "還沒有活動",
  "progress.how.title": "進度是怎麼保存的",
  "progress.how.body": "每次動作都馬上保存，離線也能用，稍後能繼續。從來不會跟孩子計時。",
  "progress.how.saved": "邊做邊保存",
  "progress.how.offline": "離線也能用",
  "progress.how.notime": "沒有時間壓力",

  // ---- parent: portfolio -------------------------------------------------
  "portfolio.title": "作品集",
  "portfolio.lead": "孩子完成的作品：他建造了什麼，學到了什麼，和他對此的想法。",
  "portfolio.entries.title": "作品",
  "portfolio.entries.empty":
    "還沒有作品集條目。完成一個專案後，這裡會出現最終設計、測試記錄，和孩子的想法。",
  "portfolio.entries.chip": "還沒有條目",
  "portfolio.contains.title": "一個條目包含什麼",
  "portfolio.contains.design": "最終設計",
  "portfolio.contains.testlog": "測試記錄",
  "portfolio.contains.reflection": "孩子的想法",
  "portfolio.entries.body": "每個條目都指向一個存在的檔案。家長可以刪除條目和裡面的檔案。",
  "portfolio.entries.action": "看檔案",
  "portfolio.access.title": "關於存取",
  "portfolio.access.body": "孩子和你都能看作品集。你可以刪除條目。孩子知道你能讀到他們的作品。",

  // ---- parent: safety ----------------------------------------------------
  "safety.title": "安全",
  "safety.lead": "應用程式留意過什麼，怎麼保持安全的。用平實的語言，沒必要驚動也不會。",
  "safety.settings.title": "安全設定",
  "safety.ai.label": "即時 AI",
  "safety.ai.body": "關閉。預寫好的提示是預設。孩子從來不會從即時 AI 拿到答案。",
  "safety.risk.label": "允許的風險",
  "safety.risk.body": "只允許低風險。更嚴重的風險需要家長。",
  "safety.realworld.label": "真實世界的延伸",
  "safety.realworld.body": "只有低風險、經家長同意的延伸才允許。",
  "safety.events.title": "最近的安全事件",
  "safety.events.empty": "還沒有安全事件。如果有什麼被擋下來或改了方向，會用平實的語言出現這裡。",
  "safety.events.chip": "還沒有",
  "safety.how.title": "應用程式怎麼保持安全",
  "safety.how.input": "輸入會被檢查",
  "safety.how.output": "輸出會被檢查",
  "safety.how.age": "適合年齡",
  "safety.how.privacy": "不會送出個人資料",
  "safety.how.body":
    "每次對話出來之前、之後都會被檢查。危險的請求會得到安全的替代，不會得到指令。沒什麼個人資料會離開裝置。",

  // ---- parent: settings --------------------------------------------------
  "settings.title": "設定",
  "settings.lead": "設定孩子體驗應用程式的方式。比較敏感的改變需要重新做通行密鑰確認。",
  "settings.stage.title": "孩子的階段",
  "settings.stage.body": "孩子的階段會改變應用程式的外觀和行為。只有家長能改。",
  "settings.lang.title": "孩子的語言",
  "settings.lang.body": "每個字串都有英文和繁體中文。語言跟著孩子的設定。",
  "settings.time.title": "每天的時間限制",
  "settings.time.body": "還沒設定限制。設定限制會溫和地結束使用——從來不會跟孩子計時。",
  "settings.time.none": "沒有限制",
  "settings.time.hour1": "1 小時",
  "settings.time.hour2": "2 小時",
  "settings.ai.title": "即時 AI",
  "settings.ai.off": "關閉（預設）",
  "settings.ai.explorer": "Explorer 開啟",
  "settings.ai.maker": "Maker 開啟",
  "settings.ai.body": "即時 AI 是選填的，而且有限制。預寫好的提示是預設。幼兒從來沒有即時 AI。",
  "settings.read.title": "朗讀",
  "settings.read.junior": "幼兒開啟",
  "settings.read.explorer": "探索者開啟",
  "settings.read.off": "關閉",
  "settings.read.body": "給還不會讀的孩子的提示可以在裝置上朗讀。暫停和停止一直可見。",
  "settings.export.title": "匯出和刪除",
  "settings.export.action": "匯出孩子的資料",
  "settings.delete.action": "刪除孩子的資料",
  "settings.export.body": "孩子存在後，匯出和刪除就會出現。敏感的操作需要重新做通行密鑰確認。",

  // ---- project runner (P1-04/P1-05) ---------------------------------------
  "runner.back": "返回",
  "runner.loading": "正在載入你的專案…",
  "runner.loadError.title": "專案無法載入",
  "runner.loadError.body":
    "專案檔案遺失或損壞。你儲存的作品很安全，稍後再試。",
  "runner.retry": "再試一次",
  "runner.draft.title": "大人預覽",
  "runner.draft.body":
    "這個專案還沒有審核。試玩時請有大人在旁邊。",
  "runner.stepOf": "第 {current} 步，共 {total} 步",
  "runner.step.state.done": "完成了",
  "runner.step.state.now": "現在",
  "runner.step.state.later": "之後",
  "runner.listen": "聽一聽",
  "runner.stopListen": "停止",
  "runner.step.done": "我完成這一步了",
  "runner.step.next": "下一步",
  "runner.step.needSuccess": "把橋測到撐得住，再繼續。",
  "runner.moveOn": "先跳過",
  "runner.moveOn.body":
    "你已經測了 {count} 次。可以先往下走，晚點再回來。",
  "runner.finish.title": "專案完成了！",
  "runner.finish.body":
    "你蓋好橋，也測試過了。已經收到你的作品集。",
  "runner.reflect.title": "想想你的橋",
  "runner.reflect.done": "我想過了",
  "runner.reflect.write": "想寫就寫（可以不寫）",
  "runner.portfolio.title": "已經收到作品集",
  "runner.portfolio.view": "看我的作品",
  "project.detail.start": "開始蓋",
  "project.detail.continue": "繼續蓋",
  "project.detail.story": "故事",
  "project.detail.mission": "你的任務",
  "project.detail.steps": "步驟",
  "project.detail.safety": "安全小提醒",
  "hint.get": "拿提示",
  "hint.getLevel": "拿第 {level} 個提示",
  "hint.used":
    "{count, plural, =0 {還沒有用提示} other {用了 # 個提示}}",
  "hint.exhausted": "提示看完了。試試你的想法，或問大人。",
  "hint.of": "提示 {level}",

  // ---- bridge lab ----------------------------------------------------------
  "lab.tray": "選一個零件",
  "lab.piece.plank": "木板",
  "lab.piece.pillar": "橋墩",
  "lab.piece.beam": "梁",
  "lab.piece.brace": "斜撐",
  "lab.material": "材料",
  "lab.material.wood": "木頭",
  "lab.material.steel": "鋼",
  "lab.vehicle": "車子",
  "lab.vehicle.car": "小車",
  "lab.vehicle.truck": "貨車",
  "lab.vehicle.train": "火車",
  "lab.go": "測測看！",
  "lab.testing": "測試中…",
  "lab.reset": "再測一次（保留我的橋）",
  "lab.clear": "清掉所有零件",
  "lab.undo": "復原",
  "lab.redo": "重做",
  "lab.force": "看哪裡被擠壓",
  "lab.force.legend":
    "藍色斜線是被擠壓，橘色點點是被拉扯，只是大概看看。",
  "lab.testlog": "測試記錄",
  "lab.testlog.empty": "還沒有測試。先蓋，再測試。",
  "lab.piecesLeft":
    "{count, plural, =0 {沒有零件了} other {還剩 # 個零件}}",
  "lab.cost": "花了 {cost} 金幣，總共有 {budget} 金幣",
  "lab.tries":
    "{count, plural, =0 {還沒測過} other {已經測了 # 次}}",
  "lab.success.title": "撐住了！",
  "lab.success.body": "你的橋載著車子過河，撐住了。",
  "lab.fail.title": "斷掉了——測得很好！",
  "lab.fail.cross": "車子過不去。把路面做得更穩。",
  "lab.fail.hold": "過去了，可是太快就斷了。在下面加支撐。",
  "lab.fail.budget": "撐住了，可是花太多金幣。試試更少或更便宜的零件。",
  "lab.fail.pieces": "零件太多了。試試簡單一點。",
  "lab.fail.unstable": "這次測試晃得很厲害。再試一次吧。",
  "lab.fail.generic": "這次沒有撐住。改一個地方，再測一次。",
  "lab.place.first": "點一下零件的起點。",
  "lab.place.second": "點一下零件的終點。",
  "lab.canvas.label":
    "蓋橋區。方向鍵移動，Enter 放置，Escape 取消。",
  "lab.keyboard": "鍵盤：方向鍵移動，Enter 放置，Escape 取消。",
  "lab.error.no_anchor": "零件要碰到河岸或別的零件。",
  "lab.error.max_pieces": "沒有零件了。拿掉一個再試。",
  "lab.error.build_disabled": "這一步只能測試。",
  "lab.error.overlapping_piece": "那裡滿了。找個空位試試。",
  "lab.error.too_short": "這個零件太短了。",
  "lab.error.piece_not_allowed": "這一步不用這種零件。",
  "lab.error.material_not_allowed": "這一步只用木頭。",
  "lab.error.run_in_progress": "測試正在跑。",
  "lab.error.physics_unstable": "這次測試晃得很厲害。再試一次吧。",
  "lab.error.not_loaded": "橋還在載入。",
  "lab.announce.placed":
    "{count, plural, other {橋上有 # 個零件}}",
  "lab.announce.success": "你的橋撐住了！",
  "lab.announce.fail": "橋斷了。改改設計再試。",

  // ---- parent: real progress (P1-05 on-device store) -----------------------
  "progress.activities.real":
    "{activities} 個活動 · 問了 {hints} 次提示 · 跑了 {experiments} 次測試",
  "progress.last.project": "開始了{project}",
  "progress.last.activity": "在{project}完成了一步",
  "progress.last.experiment": "在{project}測試了橋",
  "progress.last.reflection": "想了想{project}",
  "progress.last.completed": "完成了{project}",
  "progress.last.hint": "在{project}問了提示",
  "progress.sync.pending":
    "{count, plural, =0 {全部都存在這台裝置上了。} other {# 個變化存在這台裝置上，晚點再傳送。}}",
};
