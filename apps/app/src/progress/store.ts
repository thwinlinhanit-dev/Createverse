import {
  ProgressEventSchema,
  type ProgressEvent,
} from "@createverse/shared-types";

/**
 * Local-first progress store (P1-05 project state, P1-08 event log client).
 *
 * Approved shape (ARCHITECTURE.md §6, ADR-0004, DATA_MODEL.md §3–§4):
 * - every learning action is an append-only event with a client-generated
 *   UUIDv7 `event_id`;
 * - events and project state live in IndexedDB first and survive reloads and
 *   offline stretches;
 * - unsynced events wait in an outbox for `POST /api/v1/sync/events`
 *   (idempotent by `event_id`, so retries are safe). The server endpoint
 *   arrives with P1-08; until then the outbox simply retains everything and
 *   the parent dashboard reads this same on-device store.
 * - derived reads (`summary()`) are pure replays over the stored events, so
 *   invariant 3 (replay reproduces derived state) holds by construction.
 *
 * Payloads carry ids, content refs and numbers only — never names, free
 * text, or profile data (DATA_MODEL.md §6, THREAT_MODEL "never sent" list).
 * Reflection answers live in the local portfolio record, not in events.
 */

export type InstanceState =
  | "not_started"
  | "in_progress"
  | "paused"
  | "completed"
  | "abandoned";

export type AttemptOutcome = "success" | "partial" | "failed" | "skipped";

export interface ProjectInstanceRecord {
  readonly id: string;
  readonly childId: string;
  readonly projectId: string;
  readonly contentVersion: number;
  readonly lane: string;
  readonly stepIds: readonly string[];
  state: InstanceState;
  currentStepId: string | null;
  readonly startedAt: string | null;
  completedAt: string | null;
}

export interface ActivityAttemptRecord {
  readonly id: string;
  readonly projectInstanceId: string;
  readonly stepId: string;
  readonly startedAt: string;
  endedAt: string | null;
  outcome: AttemptOutcome | null;
  hintsUsed: number;
  iterations: number;
}

export interface LocalArtifactRecord {
  readonly id: string;
  readonly childId: string;
  readonly projectInstanceId: string;
  readonly kind: string;
  /** Local-only storage key until P1-09 uploads it (FileStore comes later). */
  readonly storageKey: string;
  readonly meta: Readonly<Record<string, string | number | boolean>>;
  readonly createdAt: string;
}

export interface PortfolioRecord {
  readonly id: string;
  readonly childId: string;
  /** DATA_MODEL invariant 4: always points at an existing artifact. */
  readonly artifactId: string;
  readonly projectInstanceId: string;
  readonly title: string;
  readonly stageAtCreation: string;
  readonly skills: readonly string[];
  readonly concepts: readonly string[];
  readonly whatILearned: string;
  readonly whatIWouldImprove: string;
  readonly createdAt: string;
}

export interface HintProgressState {
  levelReached: number;
  attemptCount: number;
}

export interface RunnerPosition {
  readonly projectId: string;
  readonly instanceId: string;
  readonly stepId: string | null;
}

/** Serializable lab design (a build-mode snapshot subset) for pause/resume. */
export interface SavedLabPiece {
  readonly id: string;
  readonly pieceType: string;
  readonly material: string;
  readonly x1: number;
  readonly y1: number;
  readonly x2: number;
  readonly y2: number;
}

export interface SavedLabDesign {
  readonly specId: string;
  readonly specVersion: number;
  readonly design: readonly SavedLabPiece[];
  readonly vehicleId: string;
  readonly forceView: boolean;
  readonly tool: string;
}

export interface ProjectSummary {
  readonly projectId: string;
  readonly lane: string;
  readonly state: InstanceState;
  readonly stepsDone: number;
  readonly stepsTotal: number;
  readonly lastActivityAt: string | null;
}

export interface ProgressSummary {
  readonly projects: readonly ProjectSummary[];
  readonly completedCount: number;
  readonly totalEvents: number;
  readonly pendingSync: number;
  readonly lastActivityAt: string | null;
  readonly conceptsSeen: readonly string[];
  readonly skillsPracticed: readonly string[];
  readonly hintsUsed: number;
  readonly experimentsRun: number;
  readonly activitiesCompleted: number;
  readonly portfolioCount: number;
}

export interface ContentRef {
  readonly id: string;
  readonly version: number;
}

/** Minimal key/value backend so logic stays testable without IndexedDB. */
export interface StorageBackend {
  get(key: string): Promise<unknown>;
  set(key: string, value: unknown): Promise<void>;
}

export function memoryBackend(): StorageBackend {
  const map = new Map<string, unknown>();
  return {
    get: async (key: string) => map.get(key),
    set: async (key: string, value: unknown) => {
      map.set(key, value);
    },
  };
}

/**
 * IndexedDB backend (ADR-0004 local-first). One database, one `kv` object
 * store, explicit string keys. Values must be structured-cloneable (plain
 * JSON in our case). Construct lazily in the browser only — jsdom and SSR
 * have no IndexedDB, which is why the store takes a backend parameter.
 */
export function indexedDbBackend(dbName: string): StorageBackend {
  function openDb(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(dbName, 1);
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains("kv")) {
          request.result.createObjectStore("kv");
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error ?? new Error("indexeddb open failed"));
    });
  }
  async function withStore<T>(
    mode: IDBTransactionMode,
    run: (store: IDBObjectStore) => IDBRequest<T>,
  ): Promise<T> {
    const db = await openDb();
    try {
      return await new Promise<T>((resolve, reject) => {
        const tx = db.transaction("kv", mode);
        const request = run(tx.objectStore("kv"));
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error ?? new Error("indexeddb request failed"));
      });
    } finally {
      db.close();
    }
  }
  return {
    get: (key: string) => withStore("readonly", (store) => store.get(key)),
    set: (key: string, value: unknown) =>
      withStore("readwrite", (store) => store.put(value, key)).then(() => undefined),
  };
}

/** UUIDv7 (backend `ids.ts` shape, browser-safe): time-ordered, RFC 4122. */
export function uuidv7(nowMs: number, random: (bytes: Uint8Array) => void): string {
  const bytes = new Uint8Array(16);
  random(bytes);
  const timeHex = Math.floor(nowMs).toString(16).padStart(12, "0").slice(-12);
  for (let i = 0; i < 6; i += 1) {
    bytes[i] = Number.parseInt(timeHex.slice(i * 2, i * 2 + 2), 16);
  }
  bytes[6] = 0x70 | (bytes[6]! & 0x0f);
  bytes[8] = 0x80 | (bytes[8]! & 0x3f);
  const hex = [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export interface StoreOptions {
  /** Injected clock (tests pin time; production uses wall clock for occurred_at). */
  readonly now?: () => number;
  /** Injected id source (tests pin ids). */
  readonly newId?: (prefix: string) => string;
}

const PREFIX = "cv:progress:v1";

export class ProgressStore {
  private readonly childId: string;
  private readonly deviceId: string;
  private readonly backend: StorageBackend;
  private readonly now: () => number;
  private readonly newId: (prefix: string) => string;

  private events: ProgressEvent[] = [];
  private instances: ProjectInstanceRecord[] = [];
  private attempts: ActivityAttemptRecord[] = [];
  private artifacts: LocalArtifactRecord[] = [];
  private portfolio: PortfolioRecord[] = [];
  private hints: Record<string, HintProgressState> = {};
  private labs: Record<string, SavedLabDesign> = {};
  private outbox: string[] = [];
  private position: RunnerPosition | null = null;
  private loaded = false;

  constructor(childId: string, deviceId: string, backend: StorageBackend, options: StoreOptions = {}) {
    this.childId = childId;
    this.deviceId = deviceId;
    this.backend = backend;
    this.now = options.now ?? Date.now;
    const fallbackNewId = (prefix: string): string =>
      `${prefix}_${uuidv7(this.now(), (bytes) => crypto.getRandomValues(bytes))}`;
    this.newId = options.newId ?? fallbackNewId;
  }

  private key(name: string): string {
    return `${PREFIX}:${this.childId}:${name}`;
  }

  private isoNow(): string {
    return new Date(this.now()).toISOString();
  }

  /** Load persisted state (reload/resume path — P1-05 pause/resume). */
  async load(): Promise<void> {
    const [events, instances, attempts, artifacts, portfolio, hints, labs, outbox, position] =
      await Promise.all([
        this.backend.get(this.key("events")),
        this.backend.get(this.key("instances")),
        this.backend.get(this.key("attempts")),
        this.backend.get(this.key("artifacts")),
        this.backend.get(this.key("portfolio")),
        this.backend.get(this.key("hints")),
        this.backend.get(this.key("labs")),
        this.backend.get(this.key("outbox")),
        this.backend.get(this.key("position")),
      ]);
    // Stored values were schema-checked on write; coerce defensively on read
    // so one corrupt key cannot wedge the whole store (offline robustness).
    this.events = Array.isArray(events) ? (events as ProgressEvent[]) : [];
    this.instances = Array.isArray(instances) ? (instances as ProjectInstanceRecord[]) : [];
    this.attempts = Array.isArray(attempts) ? (attempts as ActivityAttemptRecord[]) : [];
    this.artifacts = Array.isArray(artifacts) ? (artifacts as LocalArtifactRecord[]) : [];
    this.portfolio = Array.isArray(portfolio) ? (portfolio as PortfolioRecord[]) : [];
    this.hints =
      hints !== null && typeof hints === "object" && !Array.isArray(hints)
        ? (hints as Record<string, HintProgressState>)
        : {};
    this.labs =
      labs !== null && typeof labs === "object" && !Array.isArray(labs)
        ? (labs as Record<string, SavedLabDesign>)
        : {};
    this.outbox = Array.isArray(outbox) ? (outbox as string[]) : [];
    this.position =
      position !== null && typeof position === "object"
        ? (position as RunnerPosition)
        : null;
    this.loaded = true;
  }

  private ensureLoaded(): void {
    if (!this.loaded) throw new Error("ProgressStore.load() must be awaited first");
  }

  private async persist(): Promise<void> {
    await Promise.all([
      this.backend.set(this.key("events"), this.events),
      this.backend.set(this.key("instances"), this.instances),
      this.backend.set(this.key("attempts"), this.attempts),
      this.backend.set(this.key("artifacts"), this.artifacts),
      this.backend.set(this.key("portfolio"), this.portfolio),
      this.backend.set(this.key("hints"), this.hints),
      this.backend.set(this.key("labs"), this.labs),
      this.backend.set(this.key("outbox"), this.outbox),
      this.backend.set(this.key("position"), this.position),
    ]);
  }

  // ---- events (append-only; DATA_MODEL invariant 2) ----------------------

  /**
   * Append one event. Replays are safe: an `event_id` already present is
   * skipped and the original is returned (TESTING.md §6 sync dedupe).
   */
  async appendEvent(
    type: string,
    payload: Readonly<Record<string, unknown>>,
    content: ContentRef | null,
    options: { eventId?: string; at?: string } = {},
  ): Promise<ProgressEvent> {
    this.ensureLoaded();
    const at = options.at ?? this.isoNow();
    const event: ProgressEvent = ProgressEventSchema.parse({
      event_id: options.eventId ?? this.newId("e").replace(/^e_/, ""),
      child_id: this.childId,
      device_id: this.deviceId,
      type,
      schema_version: 1,
      occurred_at: at,
      received_at: at,
      ...(content ? { content_id: content.id, content_version: content.version } : {}),
      payload: { ...payload },
    });
    const existing = this.events.find((e) => e.event_id === event.event_id);
    if (existing) return existing;
    this.events.push(event);
    if (!this.outbox.includes(event.event_id)) this.outbox.push(event.event_id);
    await this.persist();
    return event;
  }

  // ---- project instances (P1-05 state machine) ----------------------------

  async startProject(
    projectId: string,
    lane: string,
    contentVersion: number,
    stepIds: readonly string[],
  ): Promise<{ instance: ProjectInstanceRecord; resumed: boolean }> {
    this.ensureLoaded();
    const open = this.instances.find(
      (i) => i.projectId === projectId && (i.state === "in_progress" || i.state === "paused"),
    );
    if (open) {
      open.state = "in_progress";
      await this.persist();
      return { instance: open, resumed: true };
    }
    const at = this.isoNow();
    const instance: ProjectInstanceRecord = {
      id: this.newId("p"),
      childId: this.childId,
      projectId,
      contentVersion,
      lane,
      stepIds: [...stepIds],
      state: "in_progress",
      currentStepId: stepIds[0] ?? null,
      startedAt: at,
      completedAt: null,
    };
    this.instances.push(instance);
    await this.appendEvent(
      "child.project.started",
      { project_id: projectId, lane },
      { id: projectId, version: contentVersion },
    );
    return { instance, resumed: false };
  }

  async pauseProject(instanceId: string): Promise<void> {
    this.ensureLoaded();
    const instance = this.requireInstance(instanceId);
    if (instance.state === "in_progress") {
      instance.state = "paused";
      await this.persist();
    }
  }

  async setPosition(position: RunnerPosition | null): Promise<void> {
    this.ensureLoaded();
    this.position = position;
    await this.persist();
  }

  getPosition(): RunnerPosition | null {
    this.ensureLoaded();
    return this.position;
  }

  getInstance(instanceId: string): ProjectInstanceRecord | undefined {
    this.ensureLoaded();
    return this.instances.find((i) => i.id === instanceId);
  }

  findOpenInstance(projectId: string): ProjectInstanceRecord | undefined {
    this.ensureLoaded();
    return this.instances.find(
      (i) => i.projectId === projectId && (i.state === "in_progress" || i.state === "paused"),
    );
  }

  // ---- attempts and signals -----------------------------------------------

  async beginAttempt(instanceId: string, stepId: string): Promise<ActivityAttemptRecord> {
    this.ensureLoaded();
    const instance = this.requireInstance(instanceId);
    const attempt: ActivityAttemptRecord = {
      id: this.newId("a"),
      projectInstanceId: instanceId,
      stepId,
      startedAt: this.isoNow(),
      endedAt: null,
      outcome: null,
      hintsUsed: 0,
      iterations: 0,
    };
    this.attempts.push(attempt);
    instance.currentStepId = stepId;
    await this.persist();
    return attempt;
  }

  /** Count one more try inside an open attempt (experiment runs). */
  async addIteration(attemptId: string): Promise<number> {
    this.ensureLoaded();
    const attempt = this.attempts.find((a) => a.id === attemptId);
    if (!attempt) throw new Error(`unknown attempt ${attemptId}`);
    attempt.iterations += 1;
    await this.persist();
    return attempt.iterations;
  }

  async finishAttempt(    attemptId: string,
    outcome: AttemptOutcome,
    detail: {
      readonly hintsUsed: number;
      readonly iterations: number;
      readonly concepts: readonly string[];
      readonly skills: readonly string[];
      readonly content: ContentRef;
    },
  ): Promise<ActivityAttemptRecord> {
    this.ensureLoaded();
    const attempt = this.attempts.find((a) => a.id === attemptId);
    if (!attempt) throw new Error(`unknown attempt ${attemptId}`);
    // First completion counts: re-finishing (child replays a done step) must
    // not duplicate events or double-count hints (summary replays events).
    if (attempt.outcome !== null) return attempt;
    attempt.endedAt = this.isoNow();
    attempt.outcome = outcome;
    attempt.hintsUsed = detail.hintsUsed;
    attempt.iterations = detail.iterations;
    await this.appendEvent(
      "child.activity.completed",
      {
        step_id: attempt.stepId,
        outcome,
        hints_used: detail.hintsUsed,
        iterations: detail.iterations,
        concepts: [...detail.concepts],
        skills: [...detail.skills],
      },
      detail.content,
    );
    return attempt;
  }

  async recordExperiment(
    content: ContentRef,
    result: {
      readonly experienceId: string;
      readonly vehicle: string;
      readonly success: boolean;
      readonly reasons: string;
      readonly cost: number;
      readonly peakLoadRatio: number;
      readonly iterations: number;
    },
  ): Promise<ProgressEvent> {
    this.ensureLoaded();
    return this.appendEvent(
      "child.experiment.executed",
      {
        experience_id: result.experienceId,
        vehicle: result.vehicle,
        success: result.success,
        reasons: result.reasons,
        cost: result.cost,
        peak_load_ratio: result.peakLoadRatio,
        iterations: result.iterations,
      },
      content,
    );
  }

  /** Pre-written hint shown (P1-07 arrives later; live AI is never consulted here). */
  async recordHint(stepId: string, level: number): Promise<HintProgressState> {
    this.ensureLoaded();
    const current = this.hints[stepId] ?? { levelReached: 0, attemptCount: 0 };
    const next = { levelReached: current.levelReached + 1, attemptCount: current.attemptCount };
    this.hints[stepId] = next;
    await this.appendEvent(
      "ai.hint.requested",
      { step_id: stepId, level, source: "precomputed" },
      null,
    );
    return next;
  }

  getHintProgress(stepId: string): HintProgressState {
    this.ensureLoaded();
    return this.hints[stepId] ?? { levelReached: 0, attemptCount: 0 };
  }

  /**
   * Persist a build-mode lab design so a reload resumes the design, not an
   * empty build area (P1-05 pause/resume). Restored only when the spec id
   * and version still match — content edits never resurrect a stale design.
   */
  async setLabDesign(stepId: string, design: SavedLabDesign): Promise<void> {
    this.ensureLoaded();
    this.labs[stepId] = design;
    await this.persist();
  }

  getLabDesign(stepId: string, specId: string, specVersion: number): SavedLabDesign | null {
    this.ensureLoaded();
    const saved = this.labs[stepId];
    if (!saved || saved.specId !== specId || saved.specVersion !== specVersion) return null;
    return saved;
  }

  async submitReflection(
    instanceId: string,
    prompts: readonly string[],
    answers: readonly string[],
  ): Promise<void> {
    this.ensureLoaded();
    const instance = this.requireInstance(instanceId);
    // Answers stay in the local portfolio record (see completeProject), never
    // in the event log: free text is personal data (DATA_MODEL.md §6).
    await this.appendEvent(
      "child.reflection.submitted",
      { prompts: [...prompts], answers: answers.length },
      { id: instance.projectId, version: instance.contentVersion },
    );
  }

  async completeProject(
    instanceId: string,
    portfolio: {
      readonly title: string;
      readonly stageAtCreation: string;
      readonly skills: readonly string[];
      readonly concepts: readonly string[];
      readonly whatILearned: string;
      readonly whatIWouldImprove: string;
      readonly design: Readonly<Record<string, string | number | boolean>>;
    },
  ): Promise<PortfolioRecord> {
    this.ensureLoaded();
    const instance = this.requireInstance(instanceId);
    const at = this.isoNow();
    const artifact: LocalArtifactRecord = {
      id: this.newId("art"),
      childId: this.childId,
      projectInstanceId: instanceId,
      kind: "experiment_result",
      storageKey: `local:${instanceId}:result`,
      meta: { ...portfolio.design },
      createdAt: at,
    };
    this.artifacts.push(artifact);
    const entry: PortfolioRecord = {
      id: this.newId("pe"),
      childId: this.childId,
      artifactId: artifact.id,
      projectInstanceId: instanceId,
      title: portfolio.title,
      stageAtCreation: portfolio.stageAtCreation,
      skills: [...portfolio.skills],
      concepts: [...portfolio.concepts],
      whatILearned: portfolio.whatILearned,
      whatIWouldImprove: portfolio.whatIWouldImprove,
      createdAt: at,
    };
    this.portfolio.push(entry);
    instance.state = "completed";
    instance.completedAt = at;
    await this.appendEvent(
      "child.project.completed",
      { project_id: instance.projectId },
      { id: instance.projectId, version: instance.contentVersion },
    );
    return entry;
  }

  getPortfolio(): readonly PortfolioRecord[] {
    this.ensureLoaded();
    return [...this.portfolio];
  }

  getArtifacts(): readonly LocalArtifactRecord[] {
    this.ensureLoaded();
    return [...this.artifacts];
  }

  getAttempts(instanceId: string): readonly ActivityAttemptRecord[] {
    this.ensureLoaded();
    return this.attempts.filter((a) => a.projectInstanceId === instanceId);
  }

  // ---- derived read model (replay over events; invariant 3) ---------------

  summary(): ProgressSummary {
    this.ensureLoaded();
    const concepts = new Set<string>();
    const skills = new Set<string>();
    let hintsUsed = 0;
    let experimentsRun = 0;
    let activitiesCompleted = 0;
    let lastActivityAt: string | null = null;
    for (const event of this.events) {
      if (event.occurred_at > (lastActivityAt ?? "")) lastActivityAt = event.occurred_at;
      if (event.type === "child.activity.completed") {
        activitiesCompleted += 1;
        for (const id of asStrings(event.payload["concepts"])) concepts.add(id);
        for (const id of asStrings(event.payload["skills"])) skills.add(id);
        hintsUsed += asNumber(event.payload["hints_used"]);
      } else if (event.type === "ai.hint.requested") {
        hintsUsed += 1;
      } else if (event.type === "child.experiment.executed") {
        experimentsRun += 1;
      }
    }
    const projects: ProjectSummary[] = this.instances.map((instance) => {
      const done = new Set(
        this.attempts
          .filter((a) => a.projectInstanceId === instance.id && a.outcome !== null)
          .map((a) => a.stepId),
      );
      const instanceEvents = this.events.filter(
        (e) =>
          (e.content_id === instance.projectId ||
            (typeof e.payload["project_id"] === "string" &&
              e.payload["project_id"] === instance.projectId)) &&
          e.child_id === this.childId,
      );
      const last = instanceEvents.length
        ? [...instanceEvents].sort((a, b) => (a.occurred_at < b.occurred_at ? 1 : -1))[0]
        : undefined;
      return {
        projectId: instance.projectId,
        lane: instance.lane,
        state: instance.state,
        stepsDone: done.size,
        stepsTotal: instance.stepIds.length,
        lastActivityAt: last?.occurred_at ?? instance.startedAt,
      };
    });
    return {
      projects,
      completedCount: this.instances.filter((i) => i.state === "completed").length,
      totalEvents: this.events.length,
      pendingSync: this.outbox.length,
      lastActivityAt,
      conceptsSeen: [...concepts].sort(),
      skillsPracticed: [...skills].sort(),
      hintsUsed,
      experimentsRun,
      activitiesCompleted,
      portfolioCount: this.portfolio.length,
    };
  }

  // ---- sync outbox (server side arrives with P1-08) -------------------------

  pendingEvents(): readonly ProgressEvent[] {
    this.ensureLoaded();
    const pending = new Set(this.outbox);
    return this.events.filter((e) => pending.has(e.event_id));
  }

  /** Newest-first event history for the parent progress view. */
  recentEvents(limit: number): readonly ProgressEvent[] {
    this.ensureLoaded();
    return [...this.events]
      .sort((a, b) => (a.occurred_at < b.occurred_at ? 1 : a.occurred_at > b.occurred_at ? -1 : 0))
      .slice(0, Math.max(0, limit));
  }

  /**
   * Push unsynced events through `post`. Anything the endpoint does not
   * confirm stays in the outbox for the next attempt; failures never lose
   * local state. Safe to call when the endpoint does not exist yet (P1-08):
   * a rejection keeps the outbox intact.
   */
  async sync(
    post: (events: readonly ProgressEvent[]) => Promise<readonly string[]>,
  ): Promise<{ synced: number; pending: number }> {
    this.ensureLoaded();
    const events = this.pendingEvents();
    if (events.length === 0) return { synced: 0, pending: 0 };
    let stored: readonly string[];
    try {
      stored = await post(events);
    } catch {
      return { synced: 0, pending: events.length };
    }
    const confirmed = new Set(stored);
    this.outbox = this.outbox.filter((id) => !confirmed.has(id));
    await this.persist();
    return { synced: confirmed.size, pending: this.outbox.length };
  }

  private requireInstance(instanceId: string): ProjectInstanceRecord {
    const instance = this.instances.find((i) => i.id === instanceId);
    if (!instance) throw new Error(`unknown project instance ${instanceId}`);
    return instance;
  }
}

function asStrings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];
}

function asNumber(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}
