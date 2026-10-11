import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
export const DATA_DIR = process.env.DATA_DIR || path.resolve(here, '..', 'data');
export const UPLOAD_DIR = path.join(DATA_DIR, 'uploads');

fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const file = process.env.DB_FILE || path.join(DATA_DIR, 'workspace.db');
export const db = new DatabaseSync(file);

db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;

  CREATE TABLE IF NOT EXISTS pages (
    id          TEXT PRIMARY KEY,
    parent_id   TEXT,
    type        TEXT NOT NULL DEFAULT 'page',   -- 'page' | 'database'
    inline      INTEGER NOT NULL DEFAULT 0,     -- inline databases live inside a page body
    title       TEXT NOT NULL DEFAULT '',
    icon        TEXT,
    cover       TEXT,
    blocks      TEXT NOT NULL DEFAULT '[]',     -- JSON block tree
    props       TEXT NOT NULL DEFAULT '{}',     -- JSON {propId: value} when the page is a database row
    schema      TEXT NOT NULL DEFAULT '[]',     -- JSON property definitions (databases only)
    views       TEXT NOT NULL DEFAULT '[]',     -- JSON view definitions (databases only)
    settings    TEXT NOT NULL DEFAULT '{}',     -- JSON {font, small, wide, locked}
    text        TEXT NOT NULL DEFAULT '',       -- plain text of the body, for search
    favorite    INTEGER NOT NULL DEFAULT 0,
    position    REAL NOT NULL DEFAULT 0,
    trashed_at  INTEGER,
    created_at  INTEGER NOT NULL,
    updated_at  INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_pages_parent ON pages(parent_id);
  CREATE INDEX IF NOT EXISTS idx_pages_trashed ON pages(trashed_at);
`);

/** Run fn inside a transaction; rolls back if it throws. */
export function tx(fn) {
  db.exec('BEGIN');
  try {
    const out = fn();
    db.exec('COMMIT');
    return out;
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}
