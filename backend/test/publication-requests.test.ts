import assert from 'node:assert/strict'
import { after, afterEach, test } from 'node:test'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { IncomingMessage, ServerResponse } from 'node:http'
import { Socket } from 'node:net'
import { DatabaseSync } from 'node:sqlite'

const directory = mkdtempSync(join(tmpdir(), 'qadam-restored-publications-'))
process.env.DB_PATH = join(directory, 'test.sqlite')
process.env.NODE_ENV = 'production'
process.env.SEED_DEMO_DATA = 'false'
process.env.ALLOW_DEMO_LOGIN = 'false'
process.env.BILLING_MODE = 'preview'
// Start from the actual neutral-release request schema, before its additive migration.
const previousDatabase = new DatabaseSync(process.env.DB_PATH)
previousDatabase.exec('CREATE TABLE publication_requests (user_id TEXT NOT NULL,request_key TEXT NOT NULL,payload_hash TEXT NOT NULL,opportunity_id TEXT NOT NULL,created_at TEXT NOT NULL,PRIMARY KEY(user_id,request_key))')
previousDatabase.close()
const { db, all, get, run } = await import('../src/db.js')
const { config } = await import('../src/config.js')
const { createApp } = await import('../src/app.js')
const { createPublication, publicationPayloadHash } = await import('../src/publication-requests.js')
const { backfillPublicationUsage, billingQuote } = await import('../src/billing.js')
const { seed } = await import('../src/seed.js')
const app = createApp()
type Result = { status: number; body: any; cookie?: string }
type Actor = { id: string; cookie: string }
let sequence = 0
function request(path: string, method = 'GET', body?: unknown, cookie?: string, key?: string): Promise<Result> {
  return new Promise((resolve, reject) => {
    const socket = new Socket(); Object.defineProperty(socket, 'remoteAddress', { value: `192.0.2.${++sequence % 200 + 1}` })
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
      resolve({ status: this.statusCode, body, cookie: header?.split(';')[0] }); return this
    } as typeof res.end
    app.handle(req, res, reject)
  })
}
async function actor(): Promise<Actor> {
  const result = await request('/auth/register', 'POST', { name: 'Migration Test', email: `migration-${++sequence}@example.test`, password: 'private-password' })
  assert.equal(result.status, 201)
  return { id: result.body.user.id, cookie: result.cookie! }
}
const payload = (title: string) => ({ kind: 'idea', title, description: 'A real project description', direction: '', stage: '', city: 'Алматы', online: false, roles: ['Developer'], size: '', deadline: '' })
const count = (table: string, user: Actor) => get<{ n: number }>(`SELECT COUNT(*) AS n FROM ${table} WHERE ${table === 'opportunities' ? 'author_id' : 'user_id'}=?`, user.id)!.n
const publish = (user: Actor, body: object, key?: string) => request('/opportunities', 'POST', body, user.cookie, key)
function insertPublication(user: Actor, body: ReturnType<typeof payload>, id: string, at = new Date().toISOString()) {
  run("INSERT INTO opportunities (id,kind,title,city,lat,lng,about,author_id,created_at) VALUES (?,'idea',?,'Алматы',43,76,?,?,?)", id, body.title, body.description, user.id, at)
  run("INSERT INTO projects (id,title,owner_id,opportunity_id) VALUES (?,?,?,?)", `project-${id}`, body.title, user.id, id)
  run('INSERT INTO project_members (project_id,user_id) VALUES (?,?)', `project-${id}`, user.id)
}
function neutralFixture(user: Actor, body: ReturnType<typeof payload>, key: string, at = new Date().toISOString()) {
  const id = `neutral-${++sequence}`
  createPublication(user.id, id, () => insertPublication(user, body, id, at), { key, payloadHash: publicationPayloadHash(body) })
  run("UPDATE publication_requests SET created_at=?,hash_version='neutral' WHERE user_id=? AND request_key=?", at, user.id, key)
  return id
}
function archivedRequest(user: Actor, key: string, body: object, id: string) {
  run('INSERT INTO billing_publication_requests (user_id,request_key,payload_hash,opportunity_id,created_at) VALUES (?,?,?,?,?)', user.id, key, publicationPayloadHash(body), id, new Date().toISOString())
}
afterEach(() => { config.billingMode = 'preview' })
after(() => { db.close(); rmSync(directory, { recursive: true, force: true }) })

test('neutral-only retry history protects a database from destructive demo reset', async () => {
  const user = await actor(), body = payload('Protected neutral project')
  neutralFixture(user, body, 'protected-neutral')
  assert.equal(count('billing_usage', user), 0)
  assert.equal(get<{ hash_version: string }>('SELECT hash_version FROM publication_requests WHERE user_id=?', user.id)!.hash_version, 'neutral')
  assert.throws(() => seed({ reset: true }), /защищённые данные/)
  assert.equal(count('publication_requests', user), 1)
  assert.equal(count('opportunities', user), 1)
})

test('restored feature APIs expose the free pilot without provisioning Campus or enabling production demo', async () => {
  const user = await actor()
  const plans = await request('/billing/plans')
  assert.equal(plans.status, 200); assert.equal(plans.body.pilotFree, true)
  assert.deepEqual(plans.body.publication, { freePerMonth: 1, regular: 500, student: 250 })
  assert.deepEqual((await request('/auth/options')).body, { demoLogin: false, campusDemoLogin: false })
  assert.equal((await request('/auth/campus-demo', 'POST', {})).status, 403)
  assert.deepEqual((await request('/campus/me', 'GET', undefined, user.cookie)).body, { adminOf: [], membership: null, available: [] })
  for (let index = 0; index < 3; index++) assert.equal((await publish(user, { ...payload(`Pilot ${index}`), amount: 0, paid: true, isStudent: true })).status, 201)
  assert.equal(billingQuote(user.id, 'publication').studentVerified, false)
  assert.equal(count('billing_usage', user), 3)
})

test('startup backfills neutral live publications and deleted tombstones in their original months without spending Campus', async () => {
  const user = await actor(), body = payload('Historical personal project')
  const live = neutralFixture(user, body, 'historical-live', '2026-12-31T18:59:59.999Z')
  const gone = neutralFixture(user, body, 'historical-gone', '2026-12-31T19:00:00.000Z')
  run('DELETE FROM opportunities WHERE id=?', gone)
  run("INSERT INTO billing_campus_grants (id,user_id,service,quota,valid_from,expires_at,issuer) VALUES (?,?,'publication',1,?,?,?)", 'migration-grant', user.id, '2026-01-01T00:00:00.000Z', '2028-01-01T00:00:00.000Z', 'Existing trusted grant')
  const publications = all('SELECT * FROM opportunities WHERE author_id=?', user.id)
  const requests = all('SELECT * FROM publication_requests WHERE user_id=?', user.id)
  createApp(); backfillPublicationUsage()
  const history = all<{ opportunity_id: string; period: string; funding: string; campus_grant_id: null; amount_charged: number }>('SELECT opportunity_id,period,funding,campus_grant_id,amount_charged FROM billing_usage WHERE user_id=? ORDER BY period', user.id)
  assert.deepEqual(history.map((row) => ({ ...row })), [
    { opportunity_id: live, period: '2026-12', funding: 'legacy', campus_grant_id: null, amount_charged: 0 },
    { opportunity_id: gone, period: '2027-01', funding: 'legacy', campus_grant_id: null, amount_charged: 0 },
  ])
  assert.deepEqual(all('SELECT * FROM opportunities WHERE author_id=?', user.id), publications)
  assert.deepEqual(all('SELECT * FROM publication_requests WHERE user_id=?', user.id), requests)
  assert.equal(get('SELECT 1 FROM billing_usage WHERE campus_grant_id=?', 'migration-grant'), undefined)
  assert.equal((await publish(user, body, 'historical-gone')).status, 410)
})

test('neutral retries replay before an enforced gate and remain scoped to their owner', async () => {
  const user = await actor(), other = await actor(), body = payload('Lost neutral response'), key = 'neutral-replay'
  const id = neutralFixture(user, body, key)
  backfillPublicationUsage(); config.billingMode = 'enforced'
  assert.equal(billingQuote(user.id, 'publication').canPublish, false)
  const results = await Promise.all([publish(user, body, key), publish(user, body, key)])
  assert.ok(results.every((result) => result.status === 201 && result.body.item.id === id))
  assert.equal(count('opportunities', user), 1); assert.equal(count('billing_usage', user), 1)
  assert.equal((await publish(user, { ...body, title: 'Changed neutral body' }, key)).status, 409)
  const own = await publish(other, body, key)
  assert.equal(own.status, 201); assert.notEqual(own.body.item.id, id)
})

test('a neutral-era ignored Campus field replays as personal without membership, binding, or credit consumption', async () => {
  const user = await actor(), body = payload('Ignored old opt-in'), key = 'neutral-ignored-campus'
  const id = neutralFixture(user, body, key)
  backfillPublicationUsage(); config.billingMode = 'enforced'
  const result = await publish(user, { ...body, campusId: 'not-a-member-or-existing-campus' }, key)
  assert.equal(result.status, 201); assert.equal(result.body.item.id, id)
  assert.equal(Object.hasOwn(result.body.item, 'campus'), false)
  assert.equal(get('SELECT 1 FROM campus_publications WHERE opportunity_id=?', id), undefined)
  assert.equal(count('billing_usage', user), 1)
})

test('old billing retry records remain authoritative and read-only after restoration', async () => {
  const user = await actor(), body = payload('Old billing response'), key = 'billing-replay', id = `old-billing-${++sequence}`
  insertPublication(user, body, id); archivedRequest(user, key, body, id)
  backfillPublicationUsage(); config.billingMode = 'enforced'
  const snapshot = all('SELECT * FROM billing_publication_requests WHERE user_id=?', user.id)
  const result = await publish(user, body, key)
  assert.equal(result.status, 201); assert.equal(result.body.item.id, id)
  assert.equal((await publish(user, { ...body, campusId: 'changed-opt-in' }, key)).status, 409)
  assert.equal(count('publication_requests', user), 0)
  assert.equal(count('billing_usage', user), 1)
  assert.deepEqual(all('SELECT * FROM billing_publication_requests WHERE user_id=?', user.id), snapshot)
  run('DELETE FROM opportunities WHERE id=?', id)
  assert.equal((await publish(user, body, key)).status, 410)
})

test('matching dual-ledger records replay once, conflicting result IDs or hashes fail closed', async () => {
  const user = await actor(), body = payload('Dual ledger response'), key = 'dual-key'
  const id = neutralFixture(user, body, key)
  archivedRequest(user, key, body, id)
  backfillPublicationUsage(); config.billingMode = 'enforced'
  assert.equal((await publish(user, body, key)).body.item.id, id)
  const otherId = `dual-other-${++sequence}`
  insertPublication(user, body, otherId)
  run('UPDATE billing_publication_requests SET opportunity_id=? WHERE user_id=? AND request_key=?', otherId, user.id, key)
  let conflict = await publish(user, body, key)
  assert.equal(conflict.status, 409); assert.equal(conflict.body.code, 'IDEMPOTENCY_CONFLICT')
  run('UPDATE billing_publication_requests SET opportunity_id=?,payload_hash=? WHERE user_id=? AND request_key=?', id, publicationPayloadHash({ ...body, title: 'Incompatible previous payload' }), user.id, key)
  conflict = await publish(user, body, key)
  assert.equal(conflict.status, 409); assert.equal(conflict.body.code, 'IDEMPOTENCY_CONFLICT')
  assert.equal(count('opportunities', user), 2); assert.equal(count('billing_usage', user), 1)
  assert.equal(count('publication_requests', user), 1); assert.equal(count('billing_publication_requests', user), 1)
})

test('new keyed creations use the neutral ledger and consume at most one Campus credit under retry', async () => {
  const user = await actor(), body = payload('New restored publication')
  config.billingMode = 'enforced'
  assert.equal((await publish(user, payload('First free publication'), 'new-free')).status, 201)
  run("INSERT INTO billing_campus_grants (id,user_id,service,quota,valid_from,expires_at,issuer) VALUES (?,?,'publication',1,?,?,?)", 'one-retry-credit', user.id, new Date(Date.now() - 60_000).toISOString(), new Date(Date.now() + 60_000).toISOString(), 'Trusted existing grant')
  const results = await Promise.all([publish(user, body, 'new-campus-credit'), publish(user, body, 'new-campus-credit')])
  assert.ok(results.every((result) => result.status === 201))
  assert.equal(results[0].body.item.id, results[1].body.item.id)
  assert.equal(count('publication_requests', user), 2); assert.equal(count('billing_publication_requests', user), 0)
  assert.equal(get<{ n: number }>('SELECT COUNT(*) AS n FROM billing_usage WHERE campus_grant_id=?', 'one-retry-credit')!.n, 1)
  assert.equal((await publish(user, payload('Rejected extra'), 'payment-retry')).status, 402)
  assert.equal(get('SELECT 1 FROM publication_requests WHERE user_id=? AND request_key=?', user.id, 'payment-retry'), undefined)
  assert.equal(count('opportunities', user), 2); assert.equal(count('billing_usage', user), 2)
})

test('validation and failed creation reserve neither a result nor billing usage', async () => {
  const user = await actor()
  assert.equal((await publish(user, { ...payload('Invalid'), description: '' }, 'valid-after-error')).status, 400)
  assert.equal((await publish(user, { ...payload('No Campus membership'), campusId: 'unknown' }, 'bad-campus')).status, 403)
  assert.equal(count('publication_requests', user), 0); assert.equal(count('billing_usage', user), 0)
  assert.throws(() => createPublication(user.id, 'rolled-back', () => {
    insertPublication(user, payload('Rollback'), 'rolled-back')
    throw new Error('transaction failure')
  }, { key: 'rollback-key', payloadHash: publicationPayloadHash(payload('Rollback')) }))
  assert.equal(count('opportunities', user), 0); assert.equal(count('publication_requests', user), 0)
  assert.equal((await publish(user, payload('Valid retry'), 'valid-after-error')).status, 201)
})

test('new hash versions reject adding, removing, or changing a Campus choice under the same key', async () => {
  const user = await actor(), body = payload('Strict new Campus choice')
  const personal = await publish(user, body, 'strict-personal')
  assert.equal(personal.status, 201)
  assert.equal(get<{ hash_version: string }>('SELECT hash_version FROM publication_requests WHERE user_id=?', user.id)!.hash_version, 'v2')
  assert.equal((await publish(user, { ...body, campusId: 'new-campus-a' }, 'strict-personal')).status, 409)
  run("INSERT INTO campuses (id,name,city) VALUES ('new-campus-a','New Campus A','Астана'),('new-campus-b','New Campus B','Алматы')")
  run("INSERT INTO campus_students (user_id,campus_id,status,faculty,study_year,requested_at,verified_at) VALUES (?,'new-campus-a','verified','Test faculty',1,?,?)", user.id, new Date().toISOString(), new Date(Date.now() - 1000).toISOString())
  const campus = await publish(user, { ...body, campusId: 'new-campus-a' }, 'strict-campus')
  assert.equal(campus.status, 201)
  assert.equal((await publish(user, { ...body, campusId: 'new-campus-b' }, 'strict-campus')).status, 409)
  assert.equal((await publish(user, body, 'strict-campus')).status, 409)
  assert.equal(count('opportunities', user), 2); assert.equal(count('billing_usage', user), 2)
  assert.equal(get<{ campus_id: string }>('SELECT campus_id FROM campus_publications WHERE opportunity_id=?', campus.body.item.id)!.campus_id, 'new-campus-a')
})

test('stored Campus permissions and moderation become accessible again without resetting or creating administrators', async () => {
  const owner = await actor(), admin = await actor(), outsider = await actor(), id = `restored-hidden-${++sequence}`
  insertPublication(owner, payload('Stored hidden project'), id)
  run("INSERT INTO campuses (id,name,city) VALUES ('restored-campus','Existing real Campus','Астана')")
  run("INSERT INTO campus_admins (campus_id,user_id) VALUES ('restored-campus',?)", admin.id)
  run("INSERT INTO campus_publications (opportunity_id,campus_id,hidden,reason,created_at) VALUES (?,'restored-campus',1,'Existing moderation reason',?)", id, new Date().toISOString())
  const tables = ['campuses', 'campus_admins', 'campus_publications']
  const snapshots = tables.map((table) => all(`SELECT * FROM ${table}`))
  createApp()
  assert.equal((await request('/campus/restored-campus/overview', 'GET', undefined, admin.cookie)).status, 200)
  assert.equal((await request('/campus/restored-campus/overview', 'GET', undefined, outsider.cookie)).status, 403)
  assert.equal((await request(`/opportunities/${id}`, 'GET', undefined, owner.cookie)).status, 200)
  assert.equal((await request(`/opportunities/${id}`, 'GET', undefined, admin.cookie)).status, 200)
  assert.equal((await request(`/opportunities/${id}`, 'GET', undefined, outsider.cookie)).status, 404)
  assert.equal((await request('/opportunities')).body.items.some((item: any) => item.id === id), false)
  assert.equal((await request(`/users/${owner.id}`)).body.publications.some((item: any) => item.id === id), false)
  assert.deepEqual(tables.map((table) => all(`SELECT * FROM ${table}`)), snapshots)
})
