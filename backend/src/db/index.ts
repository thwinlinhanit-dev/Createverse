import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema.ts";

export type Db = BetterSQLite3Database<typeof schema>;

const MIGRATIONS_DIR = new URL("../../migrations/", import.meta.url).pathname.replace(
  /^\/([A-Za-z]:)/,
  "$1",
);

/**
 * Opens (and creates, for file databases) a SQLite database and applies all
 * pending migrations. `:memory:` databases are used by tests.
 * D1 gets the same SQL via wrangler on deploy (ADR-0003); this runner is the
 * local/Node path only.
 */
export function openDb(file: string): Db {
  if (file !== ":memory:") {
    mkdirSync(dirname(file), { recursive: true });
  }
  const sqlite = new Database(file);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  const db = drizzle(sqlite, { schema });
  migrate(db, { migrationsFolder: MIGRATIONS_DIR });
  return db;
}

export { schema };
