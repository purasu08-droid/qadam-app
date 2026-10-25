import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { DatabaseSync, type SQLInputValue } from 'node:sqlite'
import { config } from './config.js'

mkdirSync(dirname(config.dbPath), { recursive: true })

export const db = new DatabaseSync(config.dbPath)
db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;')

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id            TEXT PRIMARY KEY,
  email         TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT NOT NULL,
  name          TEXT NOT NULL,
  role          TEXT NOT NULL DEFAULT '',
  city          TEXT NOT NULL DEFAULT 'Алматы',
  bio           TEXT NOT NULL DEFAULT '',
  about         TEXT NOT NULL DEFAULT '',
  avatar        TEXT,
  cover         TEXT,
  portfolio     TEXT,
  skills        TEXT NOT NULL DEFAULT '[]',
  interests     TEXT NOT NULL DEFAULT '[]',
  created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS opportunities (
  id          TEXT PRIMARY KEY,
  kind        TEXT NOT NULL CHECK (kind IN ('meetup', 'job', 'idea', 'event')),
  title       TEXT NOT NULL,
  subtitle    TEXT NOT NULL DEFAULT '',
  meta        TEXT NOT NULL DEFAULT '',
  city        TEXT NOT NULL,
  lat         REAL NOT NULL,
  lng         REAL NOT NULL,
  card        TEXT NOT NULL DEFAULT '',
  about       TEXT NOT NULL DEFAULT '',
  cta         TEXT NOT NULL DEFAULT 'Подробнее',
  image       TEXT,
  hero        TEXT,
  topic       TEXT,
  date        TEXT,
  time        TEXT,
  place       TEXT,
  program     TEXT,
  organizer   TEXT,
  stage       TEXT,
  online      INTEGER NOT NULL DEFAULT 0,
  roles       TEXT,
  conditions  TEXT,
  author_id   TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX IF NOT EXISTS opportunities_city ON opportunities(city, kind);

CREATE TABLE IF NOT EXISTS applications (
  id             TEXT PRIMARY KEY,
  opportunity_id TEXT NOT NULL REFERENCES opportunities(id) ON DELETE CASCADE,
  user_id        TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role           TEXT NOT NULL,
  message        TEXT NOT NULL,
  portfolio      TEXT NOT NULL DEFAULT '',
  created_at     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (opportunity_id, user_id)
);

CREATE TABLE IF NOT EXISTS saved (
  user_id        TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  opportunity_id TEXT NOT NULL REFERENCES opportunities(id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, opportunity_id)
);

CREATE TABLE IF NOT EXISTS attendance (
  user_id        TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  opportunity_id TEXT NOT NULL REFERENCES opportunities(id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, opportunity_id)
);

CREATE TABLE IF NOT EXISTS projects (
  id             TEXT PRIMARY KEY,
  title          TEXT NOT NULL,
  text           TEXT NOT NULL DEFAULT '',
  cover          TEXT,
  status         TEXT NOT NULL DEFAULT 'team' CHECK (status IN ('prototype', 'team', 'work', 'done')),
  note           TEXT NOT NULL DEFAULT '',
  owner_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  opportunity_id TEXT REFERENCES opportunities(id) ON DELETE SET NULL,
  created_at     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS project_members (
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  PRIMARY KEY (project_id, user_id)
);

CREATE TABLE IF NOT EXISTS conversations (
  id             TEXT PRIMARY KEY,
  type           TEXT NOT NULL CHECK (type IN ('direct', 'group')),
  title          TEXT,
  kind           TEXT,
  letter         TEXT,
  opportunity_id TEXT REFERENCES opportunities(id) ON DELETE SET NULL,
  project_id     TEXT REFERENCES projects(id) ON DELETE SET NULL,
  created_at     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS conversation_members (
  conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  user_id         TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  last_read_at    TEXT NOT NULL DEFAULT '1970-01-01T00:00:00.000Z',
  PRIMARY KEY (conversation_id, user_id)
);

CREATE TABLE IF NOT EXISTS messages (
  id              TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  text            TEXT NOT NULL,
  file_name       TEXT,
  file_size       TEXT,
  created_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX IF NOT EXISTS messages_conv ON messages(conversation_id, created_at);

-- Soft result references keep retries safe after publication deletion.
CREATE TABLE IF NOT EXISTS publication_requests (
  user_id TEXT NOT NULL REFERENCES users(id), request_key TEXT NOT NULL, payload_hash TEXT NOT NULL,
  opportunity_id TEXT NOT NULL, created_at TEXT NOT NULL, PRIMARY KEY (user_id, request_key)
);
`)

type Params = SQLInputValue[]

export function all<T>(sql: string, ...params: Params): T[] {
  return db.prepare(sql).all(...params) as T[]
}

export function get<T>(sql: string, ...params: Params): T | undefined {
  return db.prepare(sql).get(...params) as T | undefined
}

export function run(sql: string, ...params: Params) {
  return db.prepare(sql).run(...params)
}

export function tx<T>(fn: () => T, mode: 'DEFERRED' | 'IMMEDIATE' = 'DEFERRED'): T {
  db.exec(`BEGIN ${mode}`)
  try {
    const result = fn()
    db.exec('COMMIT')
    return result
  } catch (e) {
    db.exec('ROLLBACK')
    throw e
  }
}

export const now = () => new Date().toISOString()
export const newId = (prefix: string) => `${prefix}_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`
