// Durable storage via libSQL. In production set TURSO_DATABASE_URL (+ TURSO_AUTH_TOKEN)
// to a Turso database so data survives redeploys AND free-tier sleep/wake cycles.
// Locally (no env) it falls back to a plain SQLite file. Same SQL either way.
import { createClient, type Client, type InArgs } from "@libsql/client";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const url = process.env.TURSO_DATABASE_URL || `file:${join(here, "..", "marg.db")}`;
const authToken = process.env.TURSO_AUTH_TOKEN;

export const client: Client = createClient({ url, authToken });
export const IS_TURSO = !!process.env.TURSO_DATABASE_URL;

// Thin async helpers mirroring the old node:sqlite prepared-statement shape.
// Rows are returned as PLAIN objects keyed by column name (libSQL Row objects
// don't JSON-serialize cleanly, which the admin feedback list relies on).
function toObj(row: any, columns: string[]): any {
  const o: Record<string, any> = {};
  columns.forEach((c, i) => { o[c] = row[i]; });
  return o;
}
export async function run(sql: string, args: InArgs = []) {
  return client.execute({ sql, args });
}
export async function get<T = any>(sql: string, args: InArgs = []): Promise<T | undefined> {
  const r = await client.execute({ sql, args });
  return r.rows[0] ? (toObj(r.rows[0], r.columns) as T) : undefined;
}
export async function all<T = any>(sql: string, args: InArgs = []): Promise<T[]> {
  const r = await client.execute({ sql, args });
  return r.rows.map((row) => toObj(row, r.columns) as T);
}

// Create the schema (idempotent). Called once at startup before the server listens.
export async function initDb() {
  await client.executeMultiple(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      user_handle TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      email TEXT,
      is_minor INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS consent (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      path TEXT NOT NULL,
      parental_status TEXT NOT NULL,
      school_code TEXT,
      consented_at TEXT
    );
    CREATE TABLE IF NOT EXISTS intake (
      user_id TEXT PRIMARY KEY,
      data TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS shortlist_items (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      option_id TEXT NOT NULL,
      note TEXT,
      added_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS events (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      name TEXT NOT NULL,
      props TEXT,
      ts TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS feedback (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      persona TEXT,
      context TEXT,
      rating TEXT,
      category TEXT,
      text TEXT NOT NULL,
      ai_theme TEXT,
      ai_sentiment TEXT,
      ai_severity TEXT,
      ai_summary TEXT,
      ai_suggestion TEXT,
      status TEXT NOT NULL DEFAULT 'new',
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_events_name ON events(name);
    CREATE INDEX IF NOT EXISTS idx_shortlist_user ON shortlist_items(user_id);
  `);
}
