import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { DatabaseSync, type SQLInputValue } from 'node:sqlite'
import { config } from './config.js'

mkdirSync(dirname(config.dbPath), { recursive: true })

export const db = new DatabaseSync(config.dbPath)
db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;')

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

-- Requests created while billing was disabled remain authoritative retry records.
CREATE TABLE IF NOT EXISTS publication_requests (
  user_id TEXT NOT NULL REFERENCES users(id), request_key TEXT NOT NULL, payload_hash TEXT NOT NULL,
  opportunity_id TEXT NOT NULL, created_at TEXT NOT NULL,
  hash_version TEXT NOT NULL DEFAULT 'neutral', PRIMARY KEY (user_id, request_key)
);

-- Verification and Campus grants are provisioned by trusted administration only.
-- No public API can create or edit them, and user profile text grants no entitlement.
CREATE TABLE IF NOT EXISTS billing_student_verifications (
  user_id     TEXT PRIMARY KEY REFERENCES users(id),
  source      TEXT NOT NULL CHECK (source IN ('admin', 'university')),
  verified_by TEXT NOT NULL,
  verified_at TEXT NOT NULL,
  expires_at  TEXT
);

CREATE TABLE IF NOT EXISTS billing_campus_grants (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id),
  service    TEXT NOT NULL CHECK (service IN ('publication', 'promotion3', 'promotion7')),
  quota      INTEGER NOT NULL CHECK (quota > 0),
  valid_from TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  issuer     TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  CHECK (expires_at > valid_from)
);
CREATE INDEX IF NOT EXISTS billing_campus_user ON billing_campus_grants(user_id, service, expires_at);

-- opportunity_id is intentionally a soft reference. Deleting a publication never refunds usage.
-- Application code only appends; demo reset refuses databases with protected history.
CREATE TABLE IF NOT EXISTS billing_usage (
  id                TEXT PRIMARY KEY,
  user_id           TEXT NOT NULL REFERENCES users(id),
  service           TEXT NOT NULL CHECK (service IN ('publication', 'promotion3', 'promotion7')),
  opportunity_id    TEXT NOT NULL,
  period            TEXT NOT NULL,
  funding           TEXT NOT NULL CHECK (funding IN ('legacy', 'pilot', 'monthly_free', 'campus')),
  campus_grant_id   TEXT REFERENCES billing_campus_grants(id),
  unit_price        INTEGER NOT NULL CHECK (unit_price >= 0),
  amount_charged    INTEGER NOT NULL DEFAULT 0 CHECK (amount_charged = 0),
  created_at        TEXT NOT NULL,
  UNIQUE (service, opportunity_id),
  CHECK ((funding = 'campus' AND campus_grant_id IS NOT NULL) OR (funding != 'campus' AND campus_grant_id IS NULL)),
  CHECK (funding NOT IN ('monthly_free', 'pilot', 'legacy') OR service = 'publication')
);
CREATE INDEX IF NOT EXISTS billing_usage_month ON billing_usage(user_id, service, period);
CREATE INDEX IF NOT EXISTS billing_usage_grant ON billing_usage(campus_grant_id);
CREATE TRIGGER IF NOT EXISTS billing_usage_no_update
  BEFORE UPDATE ON billing_usage BEGIN SELECT RAISE(ABORT, 'Billing usage is immutable'); END;

-- Retain the result key after publication deletion so a retry cannot recreate or recharge it.
CREATE TABLE IF NOT EXISTS billing_publication_requests (
  user_id        TEXT NOT NULL REFERENCES users(id),
  request_key    TEXT NOT NULL,
  payload_hash   TEXT NOT NULL,
  opportunity_id TEXT NOT NULL,
  created_at     TEXT NOT NULL,
  PRIMARY KEY (user_id, request_key)
);

CREATE TABLE IF NOT EXISTS campuses (
  id TEXT PRIMARY KEY, name TEXT NOT NULL, city TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE TABLE IF NOT EXISTS campus_admins (
  campus_id TEXT NOT NULL REFERENCES campuses(id), user_id TEXT NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  PRIMARY KEY (campus_id, user_id)
);
CREATE TABLE IF NOT EXISTS campus_students (
  user_id TEXT PRIMARY KEY REFERENCES users(id), campus_id TEXT NOT NULL REFERENCES campuses(id),
  status TEXT NOT NULL CHECK (status IN ('pending', 'verified', 'rejected', 'revoked')),
  faculty TEXT NOT NULL, study_year INTEGER NOT NULL CHECK (study_year BETWEEN 1 AND 8),
  requested_at TEXT NOT NULL, verified_at TEXT, expires_at TEXT, reviewed_by TEXT REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS campus_students_scope ON campus_students(campus_id, status);
CREATE TABLE IF NOT EXISTS campus_publications (
  opportunity_id TEXT PRIMARY KEY, campus_id TEXT NOT NULL REFERENCES campuses(id),
  hidden INTEGER NOT NULL DEFAULT 0 CHECK (hidden IN (0, 1)), reason TEXT,
  created_at TEXT NOT NULL, moderated_at TEXT, moderated_by TEXT REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS campus_publications_scope ON campus_publications(campus_id, hidden);
CREATE TABLE IF NOT EXISTS campus_audit (
  id TEXT PRIMARY KEY, campus_id TEXT NOT NULL REFERENCES campuses(id), actor_id TEXT REFERENCES users(id),
  action TEXT NOT NULL, target_id TEXT NOT NULL, created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS campus_audit_scope ON campus_audit(campus_id, created_at);
CREATE TABLE IF NOT EXISTS campus_grant_requests (
  campus_id TEXT NOT NULL REFERENCES campuses(id), request_key TEXT NOT NULL, payload_hash TEXT NOT NULL,
  grant_id TEXT NOT NULL REFERENCES billing_campus_grants(id), created_at TEXT NOT NULL,
  PRIMARY KEY (campus_id, request_key)
);
CREATE TABLE IF NOT EXISTS campus_demo_registry (
  slot TEXT PRIMARY KEY CHECK (slot = 'enu-v1'),
  campus_id TEXT NOT NULL UNIQUE REFERENCES campuses(id),
  namespace_token TEXT NOT NULL UNIQUE, fixture_version INTEGER NOT NULL CHECK (fixture_version = 1),
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS campus_demo_identities (
  user_id TEXT PRIMARY KEY REFERENCES users(id), slot TEXT NOT NULL REFERENCES campus_demo_registry(slot),
  actor_key TEXT NOT NULL, identity_token TEXT NOT NULL UNIQUE,
  role TEXT NOT NULL CHECK (role IN ('admin', 'student')),
  UNIQUE (slot, actor_key)
);
CREATE TABLE IF NOT EXISTS campus_demo_objects (
  slot TEXT NOT NULL REFERENCES campus_demo_registry(slot), object_key TEXT NOT NULL,
  object_kind TEXT NOT NULL CHECK (object_kind IN ('publication', 'grant')),
  object_id TEXT NOT NULL, PRIMARY KEY (slot, object_key), UNIQUE (object_kind, object_id)
);
CREATE TRIGGER IF NOT EXISTS campus_demo_registry_no_update
  BEFORE UPDATE ON campus_demo_registry BEGIN SELECT RAISE(ABORT, 'Campus demo registry is immutable'); END;
CREATE TRIGGER IF NOT EXISTS campus_demo_identity_no_update
  BEFORE UPDATE ON campus_demo_identities BEGIN SELECT RAISE(ABORT, 'Campus demo identity is immutable'); END;
CREATE TRIGGER IF NOT EXISTS campus_demo_objects_no_update
  BEFORE UPDATE ON campus_demo_objects BEGIN SELECT RAISE(ABORT, 'Campus demo ownership is immutable'); END;
`)

// Additive migration keeps old installations and existing independent local grants intact.
db.exec('BEGIN IMMEDIATE')
try {
  const requestColumns = new Set((db.prepare('PRAGMA table_info(publication_requests)').all() as { name: string }[]).map((column) => column.name))
  // Only pre-restoration rows used a schema that ignored campusId in validated bodies.
  if (!requestColumns.has('hash_version')) db.exec("ALTER TABLE publication_requests ADD COLUMN hash_version TEXT NOT NULL DEFAULT 'neutral'")
  const columns = new Set((db.prepare('PRAGMA table_info(billing_campus_grants)').all() as { name: string }[]).map((column) => column.name))
  if (!columns.has('campus_id')) db.exec('ALTER TABLE billing_campus_grants ADD COLUMN campus_id TEXT REFERENCES campuses(id)')
  if (!columns.has('revoked_at')) db.exec('ALTER TABLE billing_campus_grants ADD COLUMN revoked_at TEXT')
  db.exec('CREATE INDEX IF NOT EXISTS billing_campus_grants_scope ON billing_campus_grants(campus_id, user_id); COMMIT')
} catch (error) {
  db.exec('ROLLBACK')
  throw error
}

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
