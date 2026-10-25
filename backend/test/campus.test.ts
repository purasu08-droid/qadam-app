import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { IncomingMessage, ServerResponse } from 'node:http'
import { Socket } from 'node:net'

const directory = mkdtempSync(join(tmpdir(), 'qadam-campus-test-'))
process.env.DB_PATH = join(directory, 'campus.sqlite')
process.env.NODE_ENV = 'production'
process.env.BILLING_MODE = 'preview'
const { db, get, run } = await import('../src/db.js')
const { createApp } = await import('../src/app.js')
const { runCampusAdmin } = await import('../src/campus-admin.js')
const { config } = await import('../src/config.js')
const app = createApp()
type Actor = { id: string; email: string; cookie: string }
type Result = { status: number; body: any; cookie?: string }
let sequence = 0
function request(path: string, method = 'GET', actor?: Actor, body?: unknown, key?: string): Promise<Result> {
  return new Promise((resolve, reject) => {
    const socket = new Socket()
    Object.defineProperty(socket, 'remoteAddress', { value: `192.0.2.${sequence % 200 + 1}` })
    const req = new IncomingMessage(socket)
    req.method = method; req.url = `/api${path}`; req.headers = actor ? { cookie: actor.cookie } : {}
    if (key !== undefined) req.headers['idempotency-key'] = key
    if (body !== undefined) {
      const serialized = JSON.stringify(body)
      req.headers['content-type'] = 'application/json'; req.headers['content-length'] = String(Buffer.byteLength(serialized)); req.push(serialized)
    }
    req.push(null)
    const res = new ServerResponse(req)
    res.end = function (chunk?: any) {
      let body: any
      try { body = JSON.parse(String(chunk)) } catch { body = undefined }
      const header = this.getHeader('set-cookie')
      resolve({ status: this.statusCode, body, cookie: (Array.isArray(header) ? header[0] : header)?.toString().split(';')[0] }); return this
    } as typeof res.end
    app.handle(req, res, reject)
  })
}
async function actor(): Promise<Actor> {
  const email = `campus-${++sequence}@example.test`
  const result = await request('/auth/register', 'POST', undefined, { name: `Campus User ${sequence}`, email, password: 'test-password' })
  assert.equal(result.status, 201)
  return { id: result.body.user.id, email, cookie: result.cookie! }
}
let adminA: Actor, adminB: Actor, campusA: string, campusB: string
const expiry = () => new Date(Date.now() + 86_400_000).toISOString()
const enroll = (user: Actor, campusId = campusA, extra: object = {}) => request('/campus/enroll', 'POST', user, { campusId, faculty: 'Computer Science', studyYear: 2, ...extra })
const review = (admin: Actor, user: Actor, campusId = campusA, status = 'verified', extra: object = {}) => request(`/campus/${campusId}/students/${user.id}`, 'PATCH', admin, { status, ...(status === 'verified' ? { expiresAt: expiry() } : {}), ...extra })
async function student(campusId = campusA, admin?: Actor) {
  const user = await actor(); assert.equal((await enroll(user, campusId)).status, 201)
  assert.equal((await review(admin ?? (campusId === campusA ? adminA : adminB), user, campusId)).status, 200)
  return user
}
const publication = { kind: 'idea', title: 'Campus collaboration project', description: 'A real project description for Campus integration.', city: 'Астана', roles: ['Developer'] }
const publish = (user: Actor, campusId?: string, key?: string) => request('/opportunities', 'POST', user, { ...publication, ...(campusId ? { campusId } : {}) }, key)
const issue = (admin: Actor, user: Actor, campusId = campusA, key = 'grant-key', extra: object = {}) => request(`/campus/${campusId}/grants`, 'POST', admin, { userId: user.id, service: 'publication', quota: 1, expiresAt: expiry(), ...extra }, key)
before(async () => {
  assert.equal(get<{ n: number }>('SELECT COUNT(*) AS n FROM campuses')!.n, 0)
  adminA = await actor(); adminB = await actor()
  campusA = runCampusAdmin('create', ['--name', 'Campus A', '--city', 'Астана', '--admin-email', adminA.email]).campus.id
  campusB = runCampusAdmin('create', ['--name', 'Campus B', '--city', 'Алматы', '--admin-email', adminB.email]).campus.id
})
after(() => { db.close(); rmSync(directory, { recursive: true, force: true }) })

test('tenant capabilities come only from local provisioning; other campus and unknown campus return the same 403', async () => {
  const user = await actor()
  const me = await request('/campus/me', 'GET', user)
  assert.deepEqual(me.body.adminOf, [])
  assert.equal(me.body.membership, null)
  assert.equal(me.body.available.length, 2)
  assert.equal((await request('/campus/me')).status, 401)
  await request('/users/me', 'PATCH', user, { role: 'Campus administrator' })
  for (const path of [`/campus/${campusA}/students`, `/campus/${campusB}/overview`, '/campus/unknown/students']) {
    const denied = await request(path, 'GET', user)
    assert.equal(denied.status, 403); assert.equal(denied.body.code, 'CAMPUS_FORBIDDEN')
  }
  assert.equal((await request(`/campus/${campusB}/grants`, 'GET', adminA)).status, 403)
  assert.equal((await request('/campus/admin', 'POST', user, { campusId: campusA, userId: user.id })).status, 403)
  assert.equal((await enroll(user, campusA, { status: 'verified', admin: true })).status, 400)
  assert.equal((await request('/billing/me', 'GET', adminA)).body.studentVerified, false)
})

test('self enrollment stays pending, scoped staff approval verifies it, and self re-enrollment cannot downgrade or escalate', async () => {
  const user = await actor()
  const pending = await enroll(user)
  assert.equal(pending.body.membership.status, 'pending'); assert.equal(pending.body.membership.current, false)
  assert.equal((await request('/billing/me', 'GET', user)).body.studentVerified, false)
  assert.equal((await review(adminB, user)).status, 403)
  const verified = await review(adminA, user)
  assert.equal(verified.body.student.current, true)
  assert.equal((await request('/billing/me', 'GET', user)).body.studentVerified, true)
  assert.equal((await enroll(user, campusB)).status, 409)
  assert.equal((await request('/campus/me', 'GET', user)).body.membership.campus.id, campusA)
  assert.equal((await request(`/campus/${campusB}/students/${user.id}`, 'PATCH', adminB, { status: 'revoked' })).status, 404)
  assert.equal((await review(adminA, user, campusA, 'revoked')).status, 200)
  assert.equal((await request('/billing/me', 'GET', user)).body.studentVerified, false)
  assert.equal((await enroll(user)).body.membership.status, 'pending')
  assert.equal((await request('/billing/me', 'GET', user)).body.studentVerified, false)
})

test('Campus revocation never erases independent global verification or another tenant membership', async () => {
  const user = await student()
  run('INSERT INTO billing_student_verifications (user_id,source,verified_by,verified_at) VALUES (?,?,?,?)', user.id, 'admin', 'Independent operator', new Date(Date.now() - 1000).toISOString())
  await review(adminA, user, campusA, 'revoked')
  assert.equal((await request('/billing/me', 'GET', user)).body.studentVerified, true)
  assert.ok(get('SELECT 1 FROM billing_student_verifications WHERE user_id=?', user.id))
  await enroll(user, campusB); await review(adminB, user, campusB)
  assert.equal((await review(adminA, user, campusA, 'revoked')).status, 404)
  assert.equal((await request('/campus/me', 'GET', user)).body.membership.campus.id, campusB)
})

test('student and query input validation has no side effects; expired membership gives no entitlement', async () => {
  const user = await actor()
  for (const extra of [{ studyYear: 0 }, { studyYear: 9 }, { faculty: '' }]) assert.equal((await enroll(user, campusA, extra)).status, 400)
  assert.equal((await request('/campus/me', 'GET', user)).body.membership, null)
  await enroll(user)
  assert.equal((await review(adminA, user, campusA, 'verified', { expiresAt: '2020-01-01T00:00:00Z' })).status, 400)
  assert.equal((await request(`/campus/${campusA}/students?page=-1`, 'GET', adminA)).status, 400)
  assert.equal((await request(`/campus/${campusA}/overview?days=1`, 'GET', adminA)).status, 400)
  await review(adminA, user)
  run('UPDATE campus_students SET expires_at=? WHERE user_id=?', new Date(Date.now() - 1).toISOString(), user.id)
  assert.equal((await request('/campus/me', 'GET', user)).body.membership.current, false)
  assert.equal((await request('/billing/me', 'GET', user)).body.studentVerified, false)
  assert.equal((await publish(user, campusA)).status, 403)
})

test('Campus publishing is explicit, verified and atomic; successful idempotent replay survives later revocation', async () => {
  const pending = await actor(); await enroll(pending)
  assert.equal((await publish(pending, campusA, 'pending-attempt')).status, 403)
  assert.equal(get('SELECT 1 FROM billing_publication_requests WHERE user_id=?', pending.id), undefined)
  const user = await student()
  const personal = await publish(user)
  assert.equal(personal.status, 201); assert.equal(personal.body.item.campus, undefined)
  assert.equal(get('SELECT 1 FROM campus_publications WHERE opportunity_id=?', personal.body.item.id), undefined)
  assert.equal((await publish(user, campusB)).status, 403)
  const scoped = await publish(user, campusA, 'campus-publication')
  assert.equal(scoped.status, 201); assert.equal(scoped.body.item.campus.id, campusA)
  await review(adminA, user, campusA, 'revoked')
  const retry = await publish(user, campusA, 'campus-publication')
  assert.equal(retry.status, 201); assert.equal(retry.body.item.id, scoped.body.item.id)
  assert.equal((await publish(user, campusA, 'new-after-revoke')).status, 403)
  const list = await request(`/campus/${campusA}/publications?q=Campus`, 'GET', adminA)
  assert.ok(list.body.items.some((o: any) => o.id === scoped.body.item.id))
  assert.equal(list.body.items.some((o: any) => o.id === personal.body.item.id), false)
  assert.equal(get<{ n: number }>('SELECT COUNT(*) AS n FROM billing_usage WHERE user_id=?', user.id)!.n, 2)
})

test('moderation is scoped to opted-in publications and removes hidden content from public read paths', async () => {
  const user = await student(), outsider = await actor()
  const personal = await publish(user), scoped = await publish(user, campusA)
  const id = scoped.body.item.id
  await request(`/opportunities/${id}/save`, 'PUT', outsider)
  assert.equal((await request(`/campus/${campusB}/publications/${id}`, 'PATCH', adminB, { hidden: true, reason: 'Policy issue' })).status, 404)
  assert.equal((await request(`/campus/${campusA}/publications/${personal.body.item.id}`, 'PATCH', adminA, { hidden: true, reason: 'Not allowed' })).status, 404)
  assert.equal((await request(`/campus/${campusA}/publications/${id}`, 'PATCH', adminA, { hidden: true, reason: '' })).status, 400)
  const hidden = await request(`/campus/${campusA}/publications/${id}`, 'PATCH', adminA, { hidden: true, reason: 'Review needed' })
  assert.equal(hidden.body.item.campusHidden, true)
  assert.equal((await request(`/opportunities/${id}`)).status, 404)
  assert.equal((await request(`/opportunities/${id}`, 'GET', outsider)).status, 404)
  assert.equal((await request(`/opportunities/${id}`, 'GET', adminB)).status, 404)
  assert.equal((await request(`/opportunities/${id}`, 'GET', user)).body.item.moderationReason, 'Review needed')
  assert.equal((await request(`/opportunities/${id}`, 'GET', adminA)).status, 200)
  assert.equal((await request(`/opportunities?author=${user.id}`)).body.items.some((o: any) => o.id === id), false)
  const profile = await request(`/users/${user.id}`)
  assert.equal(profile.body.publications.some((o: any) => o.id === id), false)
  assert.ok(profile.body.publications.some((o: any) => o.id === personal.body.item.id))
  assert.equal((await request('/users/me/activity', 'GET', outsider)).body.saved.some((row: any) => row.item.id === id), false)
  assert.equal((await request(`/opportunities/${id}/apply`, 'POST', outsider, { role: 'Developer', message: 'Request' })).status, 404)
  const restored = await request(`/campus/${campusA}/publications/${id}`, 'PATCH', adminA, { hidden: false, reason: 'Reviewed' })
  assert.equal(restored.status, 200); assert.equal((await request(`/opportunities/${id}`)).status, 200)
})

test('grant issuance is current-member-only, tenant-scoped, idempotent and cannot double or refund credits', async () => {
  const user = await student(), other = await student(campusB)
  const expiresAt = expiry()
  const body = { userId: user.id, service: 'publication', quota: 1, expiresAt }
  assert.equal((await request(`/campus/${campusA}/grants`, 'POST', adminA, body)).status, 400)
  assert.equal((await issue(adminA, other)).status, 403)
  const [first, retry] = await Promise.all([request(`/campus/${campusA}/grants`, 'POST', adminA, body, 'one-grant'), request(`/campus/${campusA}/grants`, 'POST', adminA, body, 'one-grant')])
  assert.equal(first.status, 201); assert.equal(retry.status, 201); assert.equal(first.body.grant.id, retry.body.grant.id)
  assert.equal((await request(`/campus/${campusA}/grants`, 'POST', adminA, { ...body, quota: 2 }, 'one-grant')).status, 409)
  assert.equal((await request(`/campus/${campusB}/grants/${first.body.grant.id}/revoke`, 'POST', adminB)).status, 404)
  config.billingMode = 'enforced'
  try {
    assert.equal((await publish(user)).status, 201)
    assert.equal((await request('/billing/quote?service=publication', 'GET', user)).body.expectedSource, 'campus')
    assert.equal((await publish(user)).status, 201)
    assert.equal((await publish(user)).status, 402)
    const revoked = await request(`/campus/${campusA}/grants/${first.body.grant.id}/revoke`, 'POST', adminA)
    assert.equal(revoked.body.grant.used, 1); assert.equal(revoked.body.grant.active, false)
    assert.ok(revoked.body.grant.revokedAt)
    assert.equal(get<{ n: number }>('SELECT COUNT(*) AS n FROM billing_usage WHERE campus_grant_id=?', first.body.grant.id)!.n, 1)
  } finally { config.billingMode = 'preview' }
})

test('membership revocation disables only scoped grants and preserves independent legacy grants and verification', async () => {
  const user = await student()
  const scoped = await issue(adminA, user, campusA, 'revocation-grant')
  assert.equal(scoped.status, 201)
  run('INSERT INTO billing_campus_grants (id,user_id,service,quota,valid_from,expires_at,issuer) VALUES (?,?,?,?,?,?,?)', 'legacy-independent', user.id, 'promotion7', 1, new Date(Date.now() - 1000).toISOString(), expiry(), 'Independent operator')
  await review(adminA, user, campusA, 'revoked')
  const me = await request('/billing/me', 'GET', user)
  assert.equal(me.body.campus.some((g: any) => g.service === 'publication'), false)
  assert.ok(me.body.campus.some((g: any) => g.service === 'promotion7'))
  assert.ok(get<{ revoked_at: string }>('SELECT revoked_at FROM billing_campus_grants WHERE id=?', scoped.body.grant.id)!.revoked_at)
  await enroll(user); await review(adminA, user)
  assert.equal((await request('/billing/me', 'GET', user)).body.campus.some((g: any) => g.service === 'publication'), false)
})

test('overview counts real scoped opt-in activity only, zero-fills daily dates and excludes messages and PII', async () => {
  const separate = runCampusAdmin('create', ['--name', 'Analytics Campus', '--city', 'Астана', '--admin-email', adminA.email]).campus.id
  const user = await student(separate, adminA), applicant = await actor()
  const item = await publish(user, separate)
  await publish(user)
  await request(`/opportunities/${item.body.item.id}/apply`, 'POST', applicant, { role: 'Developer', message: 'SECRET CHAT CONTENT' })
  await request(`/opportunities/${item.body.item.id}/attend`, 'PUT', applicant)
  const overview = await request(`/campus/${separate}/overview?days=7`, 'GET', adminA)
  assert.equal(overview.status, 200)
  assert.equal(overview.body.counts.studentsTotal, 1); assert.equal(overview.body.counts.activeStudents, 1)
  assert.equal(overview.body.counts.publications, 1); assert.equal(overview.body.counts.applications, 1); assert.equal(overview.body.counts.attendancesTotal, 1)
  assert.equal(overview.body.daily.length, 7)
  assert.equal(overview.body.daily.reduce((n: number, d: any) => n + d.publications, 0), 1)
  assert.equal(overview.body.daily.reduce((n: number, d: any) => n + d.applications, 0), 1)
  const serialized = JSON.stringify(overview.body)
  assert.equal(serialized.includes('SECRET CHAT CONTENT'), false); assert.equal(serialized.includes('@example.test'), false); assert.equal(serialized.includes('Computer Science'), false)
})

test('local CLI can create an unassigned campus, grants no automatic student rights, and revoked admins lose access immediately', async () => {
  const created = runCampusAdmin('create', ['--name', 'ЕНУ', '--city', 'Астана'])
  assert.equal(created.admin, null)
  assert.equal(get<{ n: number }>('SELECT COUNT(*) AS n FROM campus_admins WHERE campus_id=?', created.campus.id)!.n, 0)
  assert.throws(() => runCampusAdmin('admin', ['--campus', created.campus.id, '--email', 'missing@example.test']), /не найден/)
  runCampusAdmin('admin', ['--campus', created.campus.id, '--email', adminB.email])
  assert.equal((await request(`/campus/${created.campus.id}/overview`, 'GET', adminB)).status, 200)
  assert.equal((await request('/billing/me', 'GET', adminB)).body.studentVerified, false)
  assert.equal((await publish(adminB, created.campus.id)).status, 403)
  runCampusAdmin('admin', ['--campus', created.campus.id, '--email', adminB.email, '--revoke'])
  assert.equal((await request(`/campus/${created.campus.id}/overview`, 'GET', adminB)).status, 403)
})

test('demo reset refuses scoped Campus data and preserves administrators', async () => {
  const { seed } = await import('../src/seed.js')
  const campuses = get<{ n: number }>('SELECT COUNT(*) AS n FROM campuses')!.n
  const admins = get<{ n: number }>('SELECT COUNT(*) AS n FROM campus_admins')!.n
  assert.ok(campuses > 0)
  assert.throws(() => seed({ reset: true }), /защищённые данные/)
  assert.equal(get<{ n: number }>('SELECT COUNT(*) AS n FROM campuses')!.n, campuses)
  assert.equal(get<{ n: number }>('SELECT COUNT(*) AS n FROM campus_admins')!.n, admins)
})
