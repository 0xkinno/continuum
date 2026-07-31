/**
 * db.ts — SQLite singleton (node:sqlite built-in, Node ≥22)
 *
 * Opens a single DatabaseSync connection for the entire process lifetime.
 * On first open, applies the full schema in a single migration transaction.
 *
 * Schema design principles:
 *  - Facts are stored as individually queryable rows, not JSON blobs.
 *  - Every fact row carries a `source_id` FK so it can be scoped to a
 *    chapter / document ("as of Chapter N").
 *  - Character-level facts are stored in child tables keyed by character_id,
 *    enabling efficient "what do we know about Character X" queries.
 *  - All FK constraints use ON DELETE CASCADE so removing a source removes
 *    all its derived facts cleanly.
 *  - The schema is idempotent (IF NOT EXISTS) so re-starting the server
 *    never fails on an already-initialised database.
 *
 * Database file location:
 *  - Defaults to `./continuum.db` relative to CWD (the backend root).
 *  - Override with env var CONTINUUM_DB_PATH.
 */

import { DatabaseSync } from 'node:sqlite';
import { join } from 'node:path';

const DB_PATH = process.env.CONTINUUM_DB_PATH ?? join(process.cwd(), 'continuum.db');

let _db: DatabaseSync | null = null;

// ── Schema ────────────────────────────────────────────────────────────────────

const SCHEMA_SQL = `
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

/* ── Source documents ────────────────────────────────────────────────────── */

CREATE TABLE IF NOT EXISTS sources (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  sha256       TEXT    NOT NULL UNIQUE,  -- SHA-256 of raw Markdown content
  label        TEXT    NOT NULL,         -- original filename / title
  source_type  TEXT    NOT NULL DEFAULT 'text', -- 'text' | 'image'
  image_url    TEXT,                     -- Base64 data URL for image thumbnails
  coverage     TEXT    NOT NULL DEFAULT '',
  extracted_at TEXT    NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sources_sha256 ON sources(sha256);


/* ── Characters ──────────────────────────────────────────────────────────── */

CREATE TABLE IF NOT EXISTS characters (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  name         TEXT    NOT NULL,
  name_lower   TEXT    NOT NULL,         -- lowercase normalised name for matching
  UNIQUE(name_lower)
);

CREATE INDEX IF NOT EXISTS idx_characters_name_lower ON characters(name_lower);

/* character <-> source link (a character may appear in multiple sources) */
CREATE TABLE IF NOT EXISTS character_sources (
  character_id INTEGER NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  source_id    INTEGER NOT NULL REFERENCES sources(id)    ON DELETE CASCADE,
  PRIMARY KEY (character_id, source_id)
);

/* Aliases — e.g. "The Wanderer" for "Elara Voss" */
CREATE TABLE IF NOT EXISTS character_aliases (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  character_id INTEGER NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  alias        TEXT    NOT NULL,
  source_id    INTEGER NOT NULL REFERENCES sources(id)    ON DELETE CASCADE,
  UNIQUE(character_id, alias)
);

/* Traits — personality, physical, etc. */
CREATE TABLE IF NOT EXISTS character_traits (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  character_id INTEGER NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  source_id    INTEGER NOT NULL REFERENCES sources(id)    ON DELETE CASCADE,
  trait        TEXT    NOT NULL,
  evidence     TEXT    NOT NULL DEFAULT ''
);

/* Knowledge items — things a character knows and WHEN they learned it */
CREATE TABLE IF NOT EXISTS character_knowledge (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  character_id      INTEGER NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  source_id         INTEGER NOT NULL REFERENCES sources(id)    ON DELETE CASCADE,
  item              TEXT    NOT NULL,
  established_after TEXT    NOT NULL DEFAULT ''
);

/* Relationships — character A knows character B as X */
CREATE TABLE IF NOT EXISTS character_relationships (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  character_id    INTEGER NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  source_id       INTEGER NOT NULL REFERENCES sources(id)    ON DELETE CASCADE,
  with_character  TEXT    NOT NULL,
  nature          TEXT    NOT NULL
);

/* Attributes — free-form key/value (age, occupation, appearance…) */
CREATE TABLE IF NOT EXISTS character_attributes (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  character_id INTEGER NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  source_id    INTEGER NOT NULL REFERENCES sources(id)    ON DELETE CASCADE,
  attr_key     TEXT    NOT NULL,
  attr_value   TEXT    NOT NULL,
  UNIQUE(character_id, attr_key)   -- later ingestions overwrite earlier values
);

/* ── Events ──────────────────────────────────────────────────────────────── */

CREATE TABLE IF NOT EXISTS events (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  source_id    INTEGER NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
  ext_id       TEXT    NOT NULL,         -- the "evt_001" id from Granite
  summary      TEXT    NOT NULL,
  position     TEXT    NOT NULL DEFAULT '',
  location     TEXT,
  UNIQUE(source_id, ext_id)
);

CREATE INDEX IF NOT EXISTS idx_events_source ON events(source_id);

/* Characters present in each event */
CREATE TABLE IF NOT EXISTS event_characters (
  event_id     INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  character_name TEXT  NOT NULL,
  PRIMARY KEY (event_id, character_name)
);

/* Facts established by each event */
CREATE TABLE IF NOT EXISTS event_establishes (
  id       INTEGER PRIMARY KEY AUTOINCREMENT,
  event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  fact     TEXT    NOT NULL
);

/* ── Timeline markers ────────────────────────────────────────────────────── */

CREATE TABLE IF NOT EXISTS timeline_markers (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  source_id      INTEGER NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
  label          TEXT    NOT NULL,
  time_reference TEXT,
  UNIQUE(source_id, label)
);

/* Event IDs referenced by each timeline marker (references ext_id strings) */
CREATE TABLE IF NOT EXISTS timeline_events (
  marker_id INTEGER NOT NULL REFERENCES timeline_markers(id) ON DELETE CASCADE,
  ext_event_id TEXT NOT NULL,
  PRIMARY KEY (marker_id, ext_event_id)
);

/* ── Established rules ───────────────────────────────────────────────────── */

CREATE TABLE IF NOT EXISTS rules (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  source_id  INTEGER NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
  rule_text  TEXT    NOT NULL,
  rule_lower TEXT    NOT NULL,           -- lowercase for deduplication
  evidence   TEXT    NOT NULL DEFAULT '',
  source_loc TEXT    NOT NULL DEFAULT '' -- narrative location
);

CREATE INDEX IF NOT EXISTS idx_rules_lower ON rules(rule_lower);

/* ── Uncategorised ───────────────────────────────────────────────────────── */

CREATE TABLE IF NOT EXISTS uncategorised (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  source_id INTEGER NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
  fact      TEXT    NOT NULL
);

/* ── Check history ───────────────────────────────────────────────────────── */

CREATE TABLE IF NOT EXISTS check_history (
  id                   INTEGER PRIMARY KEY AUTOINCREMENT,
  draft_excerpt        TEXT    NOT NULL,   -- first 100 chars of draft
  draft_length         INTEGER NOT NULL,
  flag_count           INTEGER NOT NULL DEFAULT 0,
  claims_count         INTEGER NOT NULL DEFAULT 0,
  result_json          TEXT    NOT NULL,   -- full ContinuityCheckResult as JSON
  checked_at           TEXT    NOT NULL    -- ISO timestamp
);

CREATE INDEX IF NOT EXISTS idx_check_history_at ON check_history(checked_at);
`;

// ── Connection factory ────────────────────────────────────────────────────────

export function getDb(): DatabaseSync {
  if (_db) return _db;
  _db = new DatabaseSync(DB_PATH);
  // Apply schema in a single exec — safe to call on every startup
  _db.exec(SCHEMA_SQL);
  try {
    _db.exec(`ALTER TABLE sources ADD COLUMN source_type TEXT NOT NULL DEFAULT 'text';`);
  } catch {
    // Column already exists
  }
  try {
    _db.exec(`ALTER TABLE sources ADD COLUMN image_url TEXT;`);
  } catch {
    // Column already exists
  }
  return _db;
}

export function closeDb(): void {
  if (_db) {
    _db.close();
    _db = null;
  }
}
