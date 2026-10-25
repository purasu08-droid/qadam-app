import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { IncomingMessage, ServerResponse } from 'node:http'
import { Socket } from 'node:net'

const directory = mkdtempSync(join(tmpdir(), 'qadam-free-publications-'))
process.env.DB_PATH = join(directory, 'test.sqlite')
process.env.NODE_ENV = 'production'
process.env.SEED_DEMO_DATA = 'false'
process.env.ALLOW_DEMO_LOGIN = 'false'
process.env.BILLING_MODE = 'enforced' // The retired setting must have no effect.
const { db, all, get, run } = await import('../src/db.js')
const { createApp } = await import('../src/app.js')
const { createPublication, publicationPayloadHash } = await import('../src/publication-requests.js')
const { seed } = await import('../src/seed.js')
const app = createApp()
type Result = { status: number; body: any; cookie?: string; cleared?: boolean }
function request(path: string, method = 'GET', body?: unknown, cookie?: string, key?: string): Promise<Result> {
  return new Promise((resolve, reject) => {
    const socket = new Socket(); Object.defineProperty(socket, 'remoteAddress', { value: '192.0.2.45' })
    const req = new IncomingMessage(socket)
    req.method = method; req.url = `/api${path}`; req.headers = cookie ? { cookie } : {}
    if (key) req.headers['idempotency-key'] = key
    if (body !== undefined) {
      const value = JSON.stringify(body)
      req.headers['content-type'] = 'application/json'; req.headers['content-length'] = String(Buffer.byteLength(value)); req.push(value)
    }
    req.push(null)
    const res = new ServerResponse(req)
    res.end = function (chunk?: any) {
      let body: any; try { body = JSON.parse(String(chunk)) } catch { body = undefined }
      const setCookie = this.getHeader('set-cookie'), header = (Array.isArray(setCookie) ? setCookie[0] : setCookie)?.toString()
      resolve({ status: this.statusCode, body, cookie: header?.split(';')[0], cleared: header?.includes('Expires=Thu, 01 Jan 1970') }); return this
    } as typeof res.end
    app.handle(req, res, reject)
  })
}
const payload = (title: string) => ({ kind: 'idea', title, description: 'A real project description', direction: '', stage: '', city: 'Алматы', online: false, roles: ['Developer'], size: '', deadline: '' })
let owner: Result, other: Result
before(async () => {
  owner = await request('/auth/register', 'POST', { name: 'Owner', email: 'owner@example.test', password: 'private-password' })
  other = await request('/auth/register', 'POST', { name: 'Other', email: 'other@example.test', password: 'private-password' })
  assert.equal(owner.status, 201); assert.equal(other.status, 201)
})
after(() => { db.close(); rmSync(directory, { recursive: true, force: true }) })

test('retired APIs and capability are absent and new installations create no feature tables', async () => {
  for (const path of ['/billing/plans', '/billing/me', '/billing/quote', '/campus/me']) assert.equal((await request(path, 'GET', undefined, owner.cookie)).status, 404, path)
  for (const path of ['/auth/campus-demo', '/campus/enroll', '/campus/unknown/grants']) assert.equal((await request(path, 'POST', {}, owner.cookie)).status, 404, path)
  assert.deepEqual((await request('/auth/options')).body, { demoLogin: false })
  assert.deepEqual(all<{ name: string }>("SELECT name FROM sqlite_master WHERE type='table' AND (name LIKE 'billing_%' OR name LIKE 'campus%')"), [])
})

test('publication stays free without a monthly limit or client-supplied entitlements', async () => {
  for (let index = 0; index < 4; index++) {
    const result = await request('/opportunities', 'POST', { ...payload(`Free project ${index}`), amount: 500, paid: false, isStudent: true, campusId: 'retired-tenant' }, owner.cookie)
    assert.equal(result.status, 201)
    assert.equal(Object.hasOwn(result.body.item, 'campus'), false)
  }
})

test('retry and concurrent submissions create one publication and project, with keys scoped to the user', async () => {
  const body = payload('One real project'), key = 'same-key-123456789'
  const before = get<{ n: number }>('SELECT COUNT(*) AS n FROM opportunities')!.n
  const results = await Promise.all([request('/opportunities', 'POST', body, owner.cookie, key), request('/opportunities', 'POST', body, owner.cookie, key)])
  assert.ok(results.every((result) => result.status === 201))
  assert.equal(results[0].body.item.id, results[1].body.item.id)
  assert.equal(get<{ n: number }>('SELECT COUNT(*) AS n FROM opportunities')!.n, before + 1)
  assert.equal(get<{ n: number }>('SELECT COUNT(*) AS n FROM projects WHERE opportunity_id=?', results[0].body.item.id)!.n, 1)
  assert.equal((await request('/opportunities', 'POST', { ...body, title: 'Changed project' }, owner.cookie, key)).status, 409)
  const independent = await request('/opportunities', 'POST', body, other.cookie, key)
  assert.equal(independent.status, 201); assert.notEqual(independent.body.item.id, results[0].body.item.id)
})

test('validation failures and rolled-back writes never reserve the retry key', async () => {
  const key = 'valid-after-error-123'
  assert.equal((await request('/opportunities', 'POST', { ...payload('Invalid'), description: '' }, owner.cookie, key)).status, 400)
  assert.equal(get('SELECT 1 FROM publication_requests WHERE request_key=?', key), undefined)
  assert.equal((await request('/opportunities', 'POST', payload('Valid retry'), owner.cookie, key)).status, 201)
  assert.throws(() => createPublication(owner.body.user.id, 'rolled-back', () => {
    run("INSERT INTO opportunities (id,kind,title,city,lat,lng,author_id) VALUES ('rolled-back','idea','Rollback','Алматы',43,76,?)", owner.body.user.id)
    throw new Error('transaction failure')
  }, { key: 'rollback-key', payloadHash: publicationPayloadHash(payload('Rollback')) }))
  assert.equal(get("SELECT 1 FROM opportunities WHERE id='rolled-back'"), undefined)
  assert.equal(get("SELECT 1 FROM publication_requests WHERE request_key='rollback-key'"), undefined)
})

test('a deleted result returns 410 and cannot be recreated by retrying its key', async () => {
  const body = payload('Deleted project'), key = 'deleted-result-123'
  const created = await request('/opportunities', 'POST', body, owner.cookie, key)
  assert.equal((await request(`/opportunities/${created.body.item.id}`, 'DELETE', undefined, owner.cookie)).status, 204)
  assert.equal((await request('/opportunities', 'POST', body, owner.cookie, key)).status, 410)
  assert.equal(get('SELECT 1 FROM opportunities WHERE id=?', created.body.item.id), undefined)
})

test('archived request keys replay without modifying legacy records, including old opt-in payloads', async () => {
  db.exec('CREATE TABLE billing_publication_requests (user_id TEXT,request_key TEXT,payload_hash TEXT,opportunity_id TEXT,created_at TEXT,PRIMARY KEY(user_id,request_key))')
  const body = { ...payload('Archived retry'), campusId: 'old-campus' }
  const created = await request('/opportunities', 'POST', body, owner.cookie)
  run('INSERT INTO billing_publication_requests VALUES (?,?,?,?,?)', owner.body.user.id, 'archived-key', publicationPayloadHash(body), created.body.item.id, '2026-01-01T00:00:00.000Z')
  const snapshot = all('SELECT * FROM billing_publication_requests')
  const repeated = await request('/opportunities', 'POST', body, owner.cookie, 'archived-key')
  assert.equal(repeated.status, 201); assert.equal(repeated.body.item.id, created.body.item.id)
  assert.equal((await request('/opportunities', 'POST', { ...body, title: 'Changed old body' }, owner.cookie, 'archived-key')).status, 409)
  assert.deepEqual(all('SELECT * FROM billing_publication_requests'), snapshot)
  assert.equal(get("SELECT 1 FROM publication_requests WHERE request_key='archived-key'"), undefined)
})

test('retired data stays inert and hidden publications do not become public or gain old administrator privileges', async () => {
  db.exec(`CREATE TABLE campuses (id TEXT PRIMARY KEY,name TEXT); INSERT INTO campuses VALUES ('old-campus','Archived tenant');
    CREATE TABLE campus_admins (campus_id TEXT,user_id TEXT);
    CREATE TABLE campus_publications (opportunity_id TEXT PRIMARY KEY,campus_id TEXT,hidden INTEGER,reason TEXT);
    CREATE TABLE campus_students (user_id TEXT,status TEXT);
    CREATE TABLE billing_usage (id TEXT PRIMARY KEY,amount_charged INTEGER);
    INSERT INTO billing_usage VALUES ('old-usage',0);`)
  run('INSERT INTO campus_admins VALUES (?,?)', 'old-campus', other.body.user.id)
  run('INSERT INTO campus_students VALUES (?,?)', owner.body.user.id, 'verified')
  const created = await request('/opportunities', 'POST', payload('Previously hidden'), owner.cookie)
  const id = created.body.item.id
  run('INSERT INTO campus_publications VALUES (?,?,1,?)', id, 'old-campus', 'Archived private reason')
  const tables = ['campuses', 'campus_admins', 'campus_students', 'campus_publications', 'billing_usage', 'billing_publication_requests']
  const snapshots = tables.map((table) => all(`SELECT * FROM ${table}`))
  createApp()
  assert.equal((await request(`/opportunities/${id}`, 'GET', undefined, owner.cookie)).status, 200)
  assert.equal((await request(`/opportunities/${id}`, 'GET', undefined, other.cookie)).status, 404)
  assert.equal((await request('/opportunities')).body.items.some((item: any) => item.id === id), false)
  assert.equal((await request(`/users/${owner.body.user.id}`)).body.publications.some((item: any) => item.id === id), false)
  assert.equal((await request('/opportunities', 'POST', payload('Still free'), owner.cookie)).status, 201)
  assert.throws(() => seed({ reset: true }), /архивные данные/)
  assert.deepEqual(tables.map((table) => all(`SELECT * FROM ${table}`)), snapshots)
})

test('retired demonstration identities cannot authenticate and their persisted rows remain unchanged', async () => {
  const retired = await request('/auth/register', 'POST', { name: 'Retired demo', email: 'retired@example.test', password: 'private-password' })
  db.exec('CREATE TABLE campus_demo_identities (user_id TEXT PRIMARY KEY)')
  run('INSERT INTO campus_demo_identities VALUES (?)', retired.body.user.id)
  const sessions = all('SELECT * FROM sessions WHERE user_id=?', retired.body.user.id)
  assert.equal((await request('/auth/login', 'POST', { email: 'retired@example.test', password: 'private-password' })).status, 401)
  const me = await request('/auth/me', 'GET', undefined, retired.cookie)
  assert.equal(me.body.user, null); assert.equal(me.cleared, true)
  assert.equal((await request('/users/me', 'GET', undefined, retired.cookie)).status, 401)
  assert.equal((await request('/auth/me', 'GET', undefined, owner.cookie)).body.user.id, owner.body.user.id)
  assert.deepEqual(all('SELECT * FROM sessions WHERE user_id=?', retired.body.user.id), sessions)
  assert.deepEqual(all('SELECT * FROM campus_demo_identities'), [{ user_id: retired.body.user.id }].map((row) => Object.assign(Object.create(null), row)))
})
