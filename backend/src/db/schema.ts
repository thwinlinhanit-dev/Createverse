import { blob, index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

/**
 * Identity and family schema — DATA_MODEL.md §3 (P1-01).
 *
 * Only the tables P1-01 owns are defined here: families, users,
 * passkey_credentials, sessions, devices, children, child_settings,
 * audit_log, setup_secrets, auth_challenges. Tables owned by other modules
 * (artifacts, ...) are added by their own tasks. `progress_events` arrived
 * with P1-08 (DATA_MODEL §3: created by the owning task).
 *
 * Deviations recorded in DATA_MODEL.md:
 * - `sessions` is not in §3 — added because API_SPEC §2 requires server-side
 *   sessions. Token stored only as SHA-256 hash (SECURITY.md §6).
 * - `devices.credential_hash` — the device credential (API_SPEC §2 "device
 *   credential") is stored hashed, never raw.
 * - `children.pin_failed_attempts` / `pin_locked_until` — PIN lockout
 *   (SECURITY.md §4: attempts rate limited, profile locks on repeated failure).
 * - `setup_secrets` / `auth_challenges` — one-time bootstrap secret
 *   (API_SPEC §5.1) and single-use short-lived WebAuthn challenges.
 */

export const families = sqliteTable("families", {
  id: text("id").primaryKey(),
  name: text("name"),
  createdAt: text("created_at").notNull(),
});

export const users = sqliteTable(
  "users",
  {
    id: text("id").primaryKey(),
    familyId: text("family_id")
      .notNull()
      .references(() => families.id),
    email: text("email").notNull(),
    passwordHash: text("password_hash"),
    role: text("role", { enum: ["owner", "guardian"] }).notNull(),
    createdAt: text("created_at").notNull(),
    lastLoginAt: text("last_login_at"),
  },
  (t) => [uniqueIndex("users_email_unique").on(t.email)],
);

export const passkeyCredentials = sqliteTable(
  "passkey_credentials",
  {
    // Credential id (base64url) is the primary key per DATA_MODEL §3.
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),    publicKey: blob("public_key").$type<Uint8Array>().notNull(),
    signCount: integer("sign_count").notNull().default(0),
    label: text("label"),
    createdAt: text("created_at").notNull(),
    lastUsedAt: text("last_used_at"),
  },
  // Multiple passkeys per parent are allowed (DATA_MODEL §3 has no UNIQUE;
  // registration options send excludeCredentials for the existing set).
  (t) => [index("passkeys_user_idx").on(t.userId)],
);

export const devices = sqliteTable(
  "devices",
  {
    id: text("id").primaryKey(),
    familyId: text("family_id")
      .notNull()
      .references(() => families.id),
    label: text("label"),
    // Device credential (API_SPEC §2) — SHA-256 hash; raw returned once.
    credentialHash: text("credential_hash"),
    createdAt: text("created_at").notNull(),
    lastSyncAt: text("last_sync_at"),
    revokedAt: text("revoked_at"),
  },
  (t) => [index("devices_family_idx").on(t.familyId)],
);

/**
 * Sessions (API_SPEC §2). Added beyond DATA_MODEL §3 — see file header.
 * `fresh_at` = last passkey confirmation (step-up window, API_SPEC §2).
 */
export const sessions = sqliteTable(
  "sessions",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").references(() => users.id),
    childId: text("child_id"),
    familyId: text("family_id")
      .notNull()
      .references(() => families.id),
    deviceId: text("device_id").references(() => devices.id),
    kind: text("kind", { enum: ["parent", "child"] }).notNull(),
    tokenHash: text("token_hash").notNull(),
    createdAt: text("created_at").notNull(),
    expiresAt: text("expires_at").notNull(),
    freshAt: text("fresh_at"),
    revokedAt: text("revoked_at"),
  },
  (t) => [
    uniqueIndex("sessions_token_unique").on(t.tokenHash),
    // Revocation cascades (device revoke → its sessions) query by family.
    index("sessions_family_idx").on(t.familyId),
  ],
);

export const children = sqliteTable(
  "children",
  {
    id: text("id").primaryKey(),
    familyId: text("family_id")
      .notNull()
      .references(() => families.id),
    displayName: text("display_name").notNull(),
    avatarKey: text("avatar_key"),
    stage: text("stage", {
      enum: ["junior", "explorer", "maker", "creator", "inventor", "researcher"],
    }).notNull(),
    birthYear: integer("birth_year"),
    locale: text("locale", { enum: ["en", "zh-Hant"] })
      .notNull()
      .default("en"),
    uiPreset: text("ui_preset").notNull(),
    pinHash: text("pin_hash"),
    // PIN lockout (SECURITY.md §4): failed-attempt counter + lock window.
    pinFailedAttempts: integer("pin_failed_attempts").notNull().default(0),
    pinLockedUntil: text("pin_locked_until"),
    createdAt: text("created_at").notNull(),
    deletedAt: text("deleted_at"),
  },
  (t) => [index("children_family_idx").on(t.familyId)],
);

export const childSettings = sqliteTable("child_settings", {
  childId: text("child_id")
    .primaryKey()
    .references(() => children.id),
  dailyMinutesLimit: integer("daily_minutes_limit"),
  quietHours: text("quiet_hours", { mode: "json" }),
  aiMentorEnabled: integer("ai_mentor_enabled").notNull().default(1),
  readAloudEnabled: integer("read_aloud_enabled").notNull().default(1),
  projectApprovalRequired: integer("project_approval_required")
    .notNull()
    .default(0),
  allowedRiskClass: text("allowed_risk_class").notNull().default("low"),
  updatedAt: text("updated_at").notNull(),
});

/**
 * Audit log — DATA_MODEL §3. Ids and action names only, never personal
 * content (API_SPEC §7, SECURITY.md §6). Written for every auth action
 * (P1-01 acceptance): setup.bootstrap, auth.login, auth.login_failed,
 * auth.logout, auth.step_up, auth.passkey_register, device.register,
 * device.revoke, child.create, child.update, child.pin_set, child.open,
 * child.pin_failed, child.pin_locked.
 */
export const auditLog = sqliteTable(
  "audit_log",
  {
    id: text("id").primaryKey(),
    actorType: text("actor_type", { enum: ["parent", "system", "child"] }).notNull(),
    actorId: text("actor_id"),
    action: text("action").notNull(),
    targetType: text("target_type"),
    targetId: text("target_id"),
    at: text("at").notNull(),
    meta: text("meta", { mode: "json" }),
  },
  (t) => [uniqueIndex("audit_id_unique").on(t.id)],
);

/**
 * One-time setup secrets (API_SPEC §5.1 POST /setup/bootstrap): the family is
 * created only while an unused, unexpired secret exists. Hashed at rest.
 */
export const setupSecrets = sqliteTable("setup_secrets", {
  id: text("id").primaryKey(),
  secretHash: text("secret_hash").notNull(),
  createdAt: text("created_at").notNull(),
  expiresAt: text("expires_at").notNull(),
  usedAt: text("used_at"),
});

/**
 * WebAuthn challenges issued for registration/login/step-up ceremonies
 * (SECURITY.md §4). Single use, short expiry, consumed on verify.
 */
export const authChallenges = sqliteTable(
  "auth_challenges",
  {
    id: text("id").primaryKey(),
    challenge: text("challenge").notNull(),
    purpose: text("purpose", { enum: ["register", "login", "fresh"] }).notNull(),
    userId: text("user_id").references(() => users.id),
    familyId: text("family_id").references(() => families.id),
    createdAt: text("created_at").notNull(),
    expiresAt: text("expires_at").notNull(),
    consumedAt: text("consumed_at"),
  },
  (t) => [uniqueIndex("auth_challenges_challenge_unique").on(t.challenge)],
);

/**
 * Progress event log — DATA_MODEL §3, P1-08. The append-only source of
 * truth for learning history (invariant 2: no updates, no deletes outside
 * the child-deletion workflow). `event_id` is client-generated (UUIDv7),
 * making `POST /sync/events` idempotent by primary key. `received_at` is
 * stamped by the server on arrival; indexes match DATA_MODEL §3 exactly.
 */
export const progressEvents = sqliteTable(
  "progress_events",
  {
    eventId: text("event_id").primaryKey(),
    childId: text("child_id")
      .notNull()
      .references(() => children.id),
    deviceId: text("device_id")
      .notNull()
      .references(() => devices.id),
    type: text("type").notNull(),
    schemaVersion: integer("schema_version").notNull(),
    occurredAt: text("occurred_at").notNull(),
    receivedAt: text("received_at").notNull(),
    contentId: text("content_id"),
    contentVersion: integer("content_version"),
    payload: text("payload", { mode: "json" }).notNull(),
  },
  (t) => [
    index("idx_events_child_time").on(t.childId, t.occurredAt),
    index("idx_events_type").on(t.childId, t.type),
  ],
);
