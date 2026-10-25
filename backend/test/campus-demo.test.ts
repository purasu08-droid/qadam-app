import assert from 'node:assert/strict'
import { after, afterEach, before, test } from 'node:test'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { IncomingMessage, ServerResponse } from 'node:http'
import { Socket } from 'node:net'

const directory = mkdtempSync(join(tmpdir(), 'qadam-campus-demo-'))
process.env.DB_PATH = join(directory, 'demo.sqlite')
process.env.NODE_ENV = 'development'
process.env.ALLOW_DEMO_LOGIN = 'true'
process.env.SEED_DEMO_DATA = 'false'
const { db, all, get, run } = await import('../src/db.js')
const { config } = await import('../src/config.js')
const { createApp } = await import('../src/app.js')
const { hashPasswordAsync } = await import('../src/auth.js')
const { runCampusAdmin } = await import('../src/campus-admin.js')
const app = createApp()
type Result = { status: number; body: any; cookie?: string }
function request(path: string, method = 'GET', body?: unknown, cookie?: string, ip = '192.0.2.43'): Promise<Result> {
  return new Promise((resolve, reject) => {
    const socket = new Socket(); Object.defineProperty(socket, 'remoteAddress', { value: ip })
    const req = new IncomingMessage(socket)
    req.method = method; req.url = `/api${path}`; req.headers = cookie ? { cookie } : {}
    if (body !== undefined) {
      const serialized = JSON.stringify(body)
      req.headers['content-type'] = 'application/json'; req.headers['content-length'] = String(Buffer.byteLength(serialized)); req.push(serialized)
    }
    req.push(null)
    const res = new ServerResponse(req)
    res.end = function (chunk?: any) {
      let body: any; try { body = JSON.parse(String(chunk)) } catch { body = undefined }
      const header = this.getHeader('set-cookie')
      resolve({ status: this.statusCode, body, cookie: (Array.isArray(header) ? header[0] : header)?.toString().split(';')[0] }); return this
    } as typeof res.end
    app.handle(req, res, reject)
  })
}
const REAL_CAMPUS = 'campus_d1295127c843430f'
let realUser: Result, demo: Result
const count = (table: string) => get<{ n: number }>(`SELECT COUNT(*) AS n FROM ${table}`)!.n
const demoEntry = (ip?: string) => request('/auth/campus-demo', 'POST', {}, undefined, ip)
before(async () => {
  realUser = await request('/auth/register', 'POST', { name: 'DEMO · Администратор ЕНУ', email: 'admin@campus-demo.invalid', password: 'private-test-password' })
  assert.equal(realUser.status, 201)
  run('INSERT INTO campuses (id,name,city) VALUES (?,?,?)', REAL_CAMPUS, 'ЕНУ', 'Астана')
  run('INSERT INTO campus_admins (campus_id,user_id) VALUES (?,?)', REAL_CAMPUS, realUser.body.user.id)
  // A similar display name is never sufficient for claiming an existing tenant.
  run('INSERT INTO campuses (id,name,city) VALUES (?,?,?)', 'unrelated-demo-named-campus', 'ЕНУ · демо', 'Астана')
})
afterEach(() => { config.production = false; config.allowDemoLogin = true })
after(() => { db.close(); rmSync(directory, { recursive: true, force: true }) })

test('anonymous capabilities work without ordinary seed data; disabled production cannot bootstrap even with ALLOW true', async () => {
  assert.equal(config.seedDemoData, false)
  assert.deepEqual((await request('/auth/options')).body, { demoLogin: false, campusDemoLogin: true })
  const missingOrdinary = await request('/auth/demo', 'POST', {})
  assert.equal(missingOrdinary.status, 503)
  assert.equal(JSON.stringify(missingOrdinary.body).includes('seed'), false)
  config.production = true
  assert.equal((await request('/auth/options')).body.campusDemoLogin, false)
  assert.equal((await demoEntry()).status, 403)
  assert.equal(count('campus_demo_registry'), 0)
})

test('a colliding registry target refuses takeover of the real university and never writes identities or roles', async () => {
  run('INSERT INTO campus_demo_registry (slot,campus_id,namespace_token,fixture_version,created_at) VALUES (?,?,?,1,?)', 'enu-v1', REAL_CAMPUS, 'a'.repeat(32), new Date().toISOString())
  const result = await demoEntry()
  assert.equal(result.status, 409); assert.equal(result.body.code, 'CAMPUS_DEMO_COLLISION')
  assert.equal(count('campus_demo_identities'), 0)
  assert.equal(count('users'), 1)
  assert.equal(get<{ n: number }>('SELECT COUNT(*) AS n FROM campus_admins WHERE campus_id=?', REAL_CAMPUS)!.n, 1)
  run('DELETE FROM campus_demo_registry WHERE slot=?', 'enu-v1')
})

test('a mid-bootstrap collision rolls back every partial identity, fixture and capability', async () => {
  db.exec(`CREATE TRIGGER demo_fixture_collision BEFORE INSERT ON campus_demo_objects WHEN NEW.object_key='publication:2'
    BEGIN SELECT RAISE(ABORT,'test fixture collision'); END`)
  const originalLog = console.error; console.error = () => {}
  let result: Result
  try { result = await demoEntry() } finally { console.error = originalLog; db.exec('DROP TRIGGER demo_fixture_collision') }
  assert.equal(result!.status, 500)
  assert.equal(count('campus_demo_registry'), 0); assert.equal(count('campus_demo_identities'), 0)
  assert.equal(count('users'), 1); assert.equal(count('opportunities'), 0); assert.equal(count('billing_usage'), 0)
  assert.equal(count('campuses'), 2); assert.equal(count('campus_admins'), 1)
})

test('dedicated bootstrap creates real demo rows and keeps the real university and matching-name account unchanged', async () => {
  const originalUser = get('SELECT * FROM users WHERE id=?', realUser.body.user.id)
  demo = await demoEntry()
  assert.equal(demo.status, 200)
  assert.equal(demo.body.campus.name, 'ЕНУ · демо'); assert.equal(demo.body.campus.isDemo, true)
  assert.notEqual(demo.body.campus.id, REAL_CAMPUS); assert.notEqual(demo.body.campus.id, 'unrelated-demo-named-campus')
  assert.notEqual(demo.body.user.id, realUser.body.user.id)
  assert.deepEqual(get('SELECT * FROM users WHERE id=?', realUser.body.user.id), originalUser)
  assert.equal(count('campus_demo_identities'), 5)
  assert.equal(get<{ n: number }>('SELECT COUNT(*) AS n FROM campus_admins WHERE campus_id=?', REAL_CAMPUS)!.n, 1)
  const me = await request('/campus/me', 'GET', undefined, demo.cookie)
  assert.deepEqual(me.body.adminOf.map((c: any) => c.id), [demo.body.campus.id])
  assert.deepEqual(me.body.available.map((c: any) => c.id), [demo.body.campus.id])
  const overview = await request(`/campus/${demo.body.campus.id}/overview?days=7`, 'GET', undefined, demo.cookie)
  assert.equal(overview.status, 200); assert.equal(overview.body.campus.isDemo, true)
  assert.equal(overview.body.counts.studentsTotal, 4); assert.equal(overview.body.counts.pendingStudents, 2); assert.equal(overview.body.counts.verifiedStudents, 2)
  assert.equal(overview.body.counts.publications, 4); assert.equal(overview.body.counts.applications, 3); assert.equal(overview.body.counts.attendancesTotal, 2)
  assert.equal(overview.body.daily.reduce((n: number, day: any) => n + day.publications, 0), 4)
  assert.equal(overview.body.byKind.filter((row: any) => row.count === 1).length, 4)
  assert.equal((await request(`/campus/${demo.body.campus.id}/grants`, 'GET', undefined, demo.cookie)).body.total, 1)
  assert.equal((await request(`/campus/${REAL_CAMPUS}/students`, 'GET', undefined, demo.cookie)).status, 403)
})

test('real users cannot discover the demo as an enrollment option or put personal data into its public roster', async () => {
  const beforeAudit = count('campus_audit'), beforeMembers = count('campus_students')
  const me = await request('/campus/me', 'GET', undefined, realUser.cookie)
  assert.equal(me.body.available.some((c: any) => c.id === demo.body.campus.id), false)
  const forbidden = await request('/campus/enroll', 'POST', { campusId: demo.body.campus.id, faculty: 'Real personal data', studyYear: 2 }, realUser.cookie)
  assert.equal(forbidden.status, 403); assert.equal(forbidden.body.code, 'CAMPUS_FORBIDDEN')
  assert.equal(count('campus_audit'), beforeAudit); assert.equal(count('campus_students'), beforeMembers)
  assert.equal(get('SELECT 1 FROM campus_students WHERE user_id=?', realUser.body.user.id), undefined)
  for (const status of ['pending', 'verified']) {
    run('INSERT INTO campus_students (user_id,campus_id,status,faculty,study_year,requested_at,verified_at,expires_at) VALUES (?,?,?,?,?,?,?,?)', realUser.body.user.id, REAL_CAMPUS, status, 'Real private faculty', 3, new Date().toISOString(), status === 'verified' ? new Date().toISOString() : null, new Date(Date.now() + 86_400_000).toISOString())
    const membershipBefore = get('SELECT * FROM campus_students WHERE user_id=?', realUser.body.user.id)
    const auditBefore = all('SELECT * FROM campus_audit ORDER BY id')
    const retry = await request('/campus/enroll', 'POST', { campusId: demo.body.campus.id, faculty: 'Attempted replacement', studyYear: 1 }, realUser.cookie)
    assert.equal(retry.status, 403); assert.equal(retry.body.code, 'CAMPUS_FORBIDDEN')
    assert.deepEqual(get('SELECT * FROM campus_students WHERE user_id=?', realUser.body.user.id), membershipBefore)
    assert.deepEqual(all('SELECT * FROM campus_audit ORDER BY id'), auditBefore)
    run('DELETE FROM campus_students WHERE user_id=?', realUser.body.user.id)
  }
  assert.equal((await request('/campus/enroll', 'POST', { campusId: REAL_CAMPUS, faculty: 'Fake', studyYear: 2 }, demo.cookie)).status, 403)
  assert.throws(() => runCampusAdmin('admin', ['--campus', REAL_CAMPUS, '--email', demo.body.user.email]), /изолирован/)
  assert.throws(() => runCampusAdmin('admin', ['--campus', demo.body.campus.id, '--email', realUser.body.user.email]), /изолирован/)
})

test('ordinary password login rejects all registered demo identities, including a manually changed valid hash', async () => {
  const identities = all<{ user_id: string; email: string; password_hash: string }>('SELECT i.user_id,u.email,u.password_hash FROM campus_demo_identities i JOIN users u ON u.id=i.user_id')
  for (const user of identities) assert.equal((await request('/auth/login', 'POST', { email: user.email, password: 'qadam-demo' }, undefined, '192.0.2.82')).status, 401)
  const target = identities[0], changed = await hashPasswordAsync('changed-private-password')
  run('UPDATE users SET password_hash=? WHERE id=?', changed, target.user_id)
  try { assert.equal((await request('/auth/login', 'POST', { email: target.email, password: 'changed-private-password' }, undefined, '192.0.2.82')).status, 401) }
  finally { run('UPDATE users SET password_hash=? WHERE id=?', target.password_hash, target.user_id) }
})

test('disabled and production modes invalidate existing demo cookies while keeping ordinary user sessions valid', async () => {
  const allowed = await demoEntry()
  config.allowDemoLogin = false
  assert.equal((await request('/auth/options')).body.campusDemoLogin, false)
  assert.equal((await demoEntry()).status, 403)
  assert.equal((await request('/auth/me', 'GET', undefined, allowed.cookie)).body.user, null)
  assert.equal((await request('/campus/me', 'GET', undefined, allowed.cookie)).status, 401)
  assert.equal((await request('/auth/me', 'GET', undefined, realUser.cookie)).body.user.id, realUser.body.user.id)
  config.allowDemoLogin = true
  assert.equal((await request('/auth/me', 'GET', undefined, allowed.cookie)).body.user, null)
  const again = await demoEntry()
  config.production = true
  assert.equal((await request('/auth/options')).body.campusDemoLogin, false)
  assert.equal((await request('/auth/me', 'GET', undefined, again.cookie)).body.user, null)
  assert.equal((await demoEntry()).status, 403)
})

test('repeat entry preserves approvals, revoked grants, moderation and deleted sample publications without duplicates', async () => {
  const fresh = await demoEntry(), id = fresh.body.campus.id
  const students = (await request(`/campus/${id}/students`, 'GET', undefined, fresh.cookie)).body.items
  const pending = students.find((s: any) => s.status === 'pending')
  await request(`/campus/${id}/students/${pending.user.id}`, 'PATCH', { status: 'verified', expiresAt: new Date(Date.now() + 86_400_000).toISOString() }, fresh.cookie)
  const grant = (await request(`/campus/${id}/grants`, 'GET', undefined, fresh.cookie)).body.items[0]
  await request(`/campus/${id}/grants/${grant.id}/revoke`, 'POST', {}, fresh.cookie)
  const publication = (await request(`/campus/${id}/publications`, 'GET', undefined, fresh.cookie)).body.items[0]
  await request(`/campus/${id}/publications/${publication.id}`, 'PATCH', { hidden: true, reason: 'DEMO review persisted' }, fresh.cookie)
  const deleted = get<{ object_id: string }>("SELECT object_id FROM campus_demo_objects WHERE object_key='publication:1'")!.object_id
  run('DELETE FROM opportunities WHERE id=?', deleted)
  const before = { users: count('users'), grants: count('billing_campus_grants'), publications: count('opportunities'), audit: count('campus_audit') }
  const repeated = await demoEntry()
  assert.equal(repeated.status, 200); assert.equal(repeated.body.campus.id, id)
  assert.deepEqual({ users: count('users'), grants: count('billing_campus_grants'), publications: count('opportunities'), audit: count('campus_audit') }, before)
  assert.equal(get<{ status: string }>('SELECT status FROM campus_students WHERE user_id=?', pending.user.id)!.status, 'verified')
  assert.ok(get<{ revoked_at: string }>('SELECT revoked_at FROM billing_campus_grants WHERE id=?', grant.id)!.revoked_at)
  assert.equal(get<{ hidden: number }>('SELECT hidden FROM campus_publications WHERE opportunity_id=?', publication.id)!.hidden, 1)
  assert.equal(get('SELECT 1 FROM opportunities WHERE id=?', deleted), undefined)
})

test('existing foreign ownership collisions fail closed without overwriting the foreign row', async () => {
  const item = get<{ object_id: string }>("SELECT object_id FROM campus_demo_objects WHERE object_key='publication:2'")!.object_id
  const owner = get<{ author_id: string }>('SELECT author_id FROM opportunities WHERE id=?', item)!.author_id
  run('UPDATE opportunities SET author_id=? WHERE id=?', realUser.body.user.id, item)
  try {
    const result = await demoEntry()
    assert.equal(result.status, 409); assert.equal(result.body.code, 'CAMPUS_DEMO_COLLISION')
    assert.equal(get<{ author_id: string }>('SELECT author_id FROM opportunities WHERE id=?', item)!.author_id, realUser.body.user.id)
  } finally { run('UPDATE opportunities SET author_id=? WHERE id=?', owner, item) }
})

test('entry is rate limited and never restores a revoked demo administrator role', async () => {
  for (let index = 0; index < 30; index++) assert.equal((await demoEntry('192.0.2.99')).status, 200)
  assert.equal((await demoEntry('192.0.2.99')).status, 429)
  run('DELETE FROM campus_admins WHERE campus_id=? AND user_id=?', demo.body.campus.id, demo.body.user.id)
  const again = await demoEntry('192.0.2.98')
  assert.equal(again.status, 200)
  assert.equal((await request(`/campus/${demo.body.campus.id}/overview`, 'GET', undefined, again.cookie)).status, 403)
  assert.equal(get('SELECT 1 FROM campus_admins WHERE campus_id=? AND user_id=?', demo.body.campus.id, demo.body.user.id), undefined)
})

test('demo reset refuses registry data without restoring or clearing its permissions', async () => {
  const { seed } = await import('../src/seed.js')
  const before = ['campus_demo_registry', 'campus_demo_identities', 'campus_admins'].map(count)
  assert.throws(() => seed({ reset: true }), /защищённые данные/)
  assert.deepEqual(['campus_demo_registry', 'campus_demo_identities', 'campus_admins'].map(count), before)
})
