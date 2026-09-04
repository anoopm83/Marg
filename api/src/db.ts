// SQLite via Node's built-in driver (no native compile). Schema is written portably
// so a later swap to Postgres is a driver change, not a redesign.
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
export const db = new DatabaseSync(join(here, "..", "marg.db"));

db.exec("PRAGMA journal_mode = WAL;");
db.exec("PRAGMA foreign_keys = ON;");
db.exec("PRAGMA busy_timeout = 4000;"); // fail fast on a lock instead of hanging
db.exec(`
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
    path TEXT NOT NULL,                 -- self_serve | school_mediated
    parental_status TEXT NOT NULL,      -- pending | verified | not_required
    school_code TEXT,
    consented_at TEXT,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );
  CREATE TABLE IF NOT EXISTS intake (
    user_id TEXT PRIMARY KEY,
    data TEXT NOT NULL,                 -- JSON: interests/values/strengths/constraints/marks
    updated_at TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );
  CREATE TABLE IF NOT EXISTS shortlist_items (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    option_id TEXT NOT NULL,
    note TEXT,
    added_at TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );
  CREATE TABLE IF NOT EXISTS sessions (
    token TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );
  CREATE TABLE IF NOT EXISTS events (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    name TEXT NOT NULL,
    props TEXT,
    ts TEXT NOT NULL
  );
  -- Free-text "how can Marg improve" feedback. Kept in its own table (not events)
  -- because triage state is mutable: Marg interprets it, a human admin actions it.
  CREATE TABLE IF NOT EXISTS feedback (
    id TEXT PRIMARY KEY,
    user_id TEXT,                       -- nullable: keep the note if the user is later deleted (DPDP: no PII in the text)
    persona TEXT,
    context TEXT,                       -- where in the app it came from
    rating TEXT,                        -- up | down | '' (a suggestion may carry no rating)
    category TEXT,                      -- user-picked bucket (wrong_info | missing | confusing | broken | other)
    text TEXT NOT NULL,
    ai_theme TEXT,                      -- Marg's interpretation (filled async; may stay null if the LLM is down)
    ai_sentiment TEXT,                  -- positive | neutral | negative
    ai_severity TEXT,                   -- low | medium | high
    ai_summary TEXT,
    ai_suggestion TEXT,                 -- a DRAFT action for the admin — never auto-applied
    status TEXT NOT NULL DEFAULT 'new', -- new | triaged | actioned | dismissed
    created_at TEXT NOT NULL
  );
`);
