import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { IncomingMessage, ServerResponse } from 'node:http'
import { Socket } from 'node:net'

const temporaryDirectory = mkdtempSync(join(tmpdir(), 'qadam-api-test-'))
process.env.NODE_ENV = 'production'
process.env.DB_PATH = join(temporaryDirectory, 'test.sqlite')
delete process.env.ALLOW_DEMO_LOGIN
delete process.env.SEED_DEMO_DATA
delete process.env.COOKIE_SECURE
const { config } = await import('../src/config.js')
const { db, all, get, run } = await import('../src/db.js')
const { createApp } = await import('../src/app.js')
const { hashPasswordAsync, verifyPasswordAsync, hashPassword } = await import('../src/auth.js')
const { seed } = await import('../src/seed.js')
const { DEMO_EMAIL, DEMO_PASSWORD, USERS } = await import('../src/seed-data.js')
const app = createApp()

type Result = { status: number; body: any; cookie?: string; setCookie?: string; retryAfter?: number }
function request(path: string, options: { method?: string; body?: unknown; cookie?: string; ip?: string } = {}): Promise<Result> {
  return new Promise((resolve, reject) => {
    const socket = new Socket()
    Object.defineProperty(socket, 'remoteAddress', { value: options.ip ?? '192.0.2.1' })
    const req = new IncomingMessage(socket)
    req.method = options.method ?? 'GET'
    req.url = path
    req.headers = options.cookie ? { cookie: options.cookie } : {}
    if (options.body !== undefined) {
      const serialized = JSON.stringify(options.body)
      req.headers['content-type'] = 'application/json'
      req.headers['content-length'] = String(Buffer.byteLength(serialized))
      req.push(serialized)
    }
    req.push(null)
    const res = new ServerResponse(req)
    res.end = function (chunk?: any) {
      let body: any
      try { body = JSON.parse(String(chunk)) } catch { body = undefined }
      const setCookie = this.getHeader('set-cookie')
      const cookieHeader = (Array.isArray(setCookie) ? setCookie[0] : setCookie)?.toString()
      resolve({ status: this.statusCode, body, cookie: cookieHeader?.split(';')[0], setCookie: cookieHeader, retryAfter: Number(this.getHeader('retry-after')) || undefined })
      return this
    } as typeof res.end
    app.handle(req, res, reject)
  })
}

let owner: Result
let applicant: Result
let outsider: Result
before(async () => {
  assert.equal(get<{ n: number }>('SELECT COUNT(*) AS n FROM users')!.n, 0)
  // Simulate an existing installation that explicitly loaded the seed before demo access was disabled.
  assert.equal(seed(), true)
  owner = await request('/api/auth/register', { method: 'POST', body: { name: 'Owner Test', email: 'owner@example.test', password: 'test-password' } })
  applicant = await request('/api/auth/register', { method: 'POST', body: { name: 'Applicant Test', email: 'applicant@example.test', password: 'test-password' } })
  outsider = await request('/api/auth/register', { method: 'POST', body: { name: 'Outsider Test', email: 'outsider@example.test', password: 'test-password' } })
  assert.equal(owner.status, 201)
  assert.equal(applicant.status, 201)
  assert.equal(outsider.status, 201)
})
after(() => {
  db.close()
  rmSync(temporaryDirectory, { recursive: true, force: true })
})

test('production defaults do not enable demo login or automatic demo data', async () => {
  assert.equal(config.allowDemoLogin, false)
  assert.equal(config.seedDemoData, false)
  assert.equal(config.cookieSecure, true)
  assert.match(owner.setCookie!, /; Secure(?:;|$)/)
  assert.equal((await request('/api/auth/demo', { method: 'POST' })).status, 403)
  assert.equal(get<{ n: number }>('SELECT COUNT(*) AS n FROM users')!.n, USERS.length + 3)
})

test('disabled demo access blocks public login credentials in an existing seeded database but allows changed passwords', async () => {
  const options = { method: 'POST', ip: '192.0.2.90', body: { email: DEMO_EMAIL.toUpperCase(), password: DEMO_PASSWORD } }
  assert.equal(config.allowDemoLogin, false)
  assert.equal((await request('/api/auth/demo', { method: 'POST', ip: options.ip })).status, 403)
  assert.equal((await request('/api/auth/login', options)).status, 401)
  config.allowDemoLogin = true
  try {
    assert.equal((await request('/api/auth/login', options)).status, 200)
    assert.equal((await request('/api/auth/demo', { method: 'POST', ip: options.ip })).status, 200)
  } finally {
    config.allowDemoLogin = false
  }
  const previous = get<{ password_hash: string }>('SELECT password_hash FROM users WHERE email = ?', DEMO_EMAIL)!.password_hash
  const replacement = await hashPasswordAsync('a-new-private-password')
  run('UPDATE users SET password_hash = ? WHERE email = ?', replacement, DEMO_EMAIL)
  try {
    const changed = await request('/api/auth/login', { ...options, body: { email: DEMO_EMAIL, password: 'a-new-private-password' } })
    assert.equal(changed.status, 200)
    assert.equal((await request('/api/auth/login', options)).status, 401)
  } finally {
    run('UPDATE users SET password_hash = ? WHERE email = ?', previous, DEMO_EMAIL)
  }
})

test('async password helpers preserve existing seed hashes and yield to the event loop', async () => {
  const pending = hashPasswordAsync('test-password')
  let completed = false
  void pending.then(() => { completed = true })
  await new Promise<void>((resolve) => setImmediate(resolve))
  assert.equal(completed, false)
  const hash = await pending
  assert.equal(await verifyPasswordAsync('test-password', hash), true)
  assert.equal(await verifyPasswordAsync('wrong-password', hash), false)
  assert.equal(await verifyPasswordAsync('test-password', hashPassword('test-password')), true)
  const login = await request('/api/auth/login', { method: 'POST', body: { email: 'owner@example.test', password: 'test-password' } })
  assert.equal(login.status, 200)
  assert.ok(login.cookie)
})

test('authentication attempts return an actionable 429 with Retry-After', async () => {
  const options = { method: 'POST', ip: '192.0.2.77', body: { email: 'missing@example.test', password: 'wrong-password' } }
  for (let i = 0; i < 10; i++) assert.equal((await request('/api/auth/login', options)).status, 401)
  const blocked = await request('/api/auth/login', options)
  assert.equal(blocked.status, 429)
  assert.ok(blocked.retryAfter! > 0)
  assert.equal(blocked.body.retryAfter, blocked.retryAfter)
  // A different account is still usable from this IP before its shared IP quota is exhausted.
  assert.equal((await request('/api/auth/login', { ...options, body: { email: 'owner@example.test', password: 'test-password' } })).status, 200)
  for (let i = 0; i < 18; i++) {
    assert.equal((await request('/api/auth/login', { ...options, body: { email: `missing-${i}@example.test`, password: 'wrong-password' } })).status, 401)
  }
  assert.equal((await request('/api/auth/login', { ...options, body: { email: 'another@example.test', password: 'wrong-password' } })).status, 429)
})

test('concurrent registration with one email returns 201 and 409 instead of a database error', async () => {
  const options = { method: 'POST', ip: '192.0.2.88', body: { name: 'Concurrent User', email: 'concurrent@example.test', password: 'test-password' } }
  const results = await Promise.all([request('/api/auth/register', options), request('/api/auth/register', options)])
  assert.deepEqual(results.map((result) => result.status).sort(), [201, 409])
  assert.equal(get<{ n: number }>('SELECT COUNT(*) AS n FROM users WHERE email = ?', options.body.email)!.n, 1)
})

test('profile portfolio only accepts http(s) URLs and validation failures remain 400', async () => {
  for (const portfolio of ['javascript:alert(1)', 'data:text/html,test', 'ftp://example.test', 'not a url']) {
    const result = await request('/api/users/me', { method: 'PATCH', cookie: owner.cookie, body: { portfolio } })
    assert.equal(result.status, 400, portfolio)
  }
  const valid = await request('/api/users/me', { method: 'PATCH', cookie: owner.cookie, body: { portfolio: 'https://example.test/portfolio' } })
  assert.equal(valid.status, 200)
  assert.equal(valid.body.profile.portfolio, 'https://example.test/portfolio')
})

const opportunity = { kind: 'idea', title: 'An integration test project', description: 'A sufficiently detailed test description.', city: 'Алматы', roles: ['Designer'] }
test('events persist the supplied location and calendar fields, invalid data is rejected', async () => {
  const event = { ...opportunity, kind: 'event', date: '2030-02-28', time: '09:30–11:00', place: 'Real venue, 42', coords: [43.25, 76.95] }
  const valid = await request('/api/opportunities', { method: 'POST', cookie: owner.cookie, body: event })
  assert.equal(valid.status, 201)
  assert.equal(valid.body.item.date, event.date)
  assert.equal(valid.body.item.time, event.time)
  assert.equal(valid.body.item.place, event.place)
  assert.deepEqual(valid.body.item.coords, event.coords)
  for (const body of [
    { ...opportunity, kind: 'event', deadline: '2030-02-28' },
    { ...event, date: '2030-02-30' },
    { ...event, time: '25:00–26:00' },
    { ...event, time: '12:00–11:00' },
    { ...event, coords: [91, 76.95] },
    { ...opportunity, city: 'Unknown City' },
    { ...opportunity, city: '__proto__' },
  ]) assert.equal((await request('/api/opportunities', { method: 'POST', cookie: owner.cookie, body })).status, 400)
})

test('applications restore existing conversation IDs without creating conversations on state reads', async () => {
  const publication = await request('/api/opportunities', { method: 'POST', cookie: owner.cookie, body: opportunity })
  const id = publication.body.item.id
  const applied = await request(`/api/opportunities/${id}/apply`, { method: 'POST', cookie: applicant.cookie, body: { role: 'Designer', message: 'I would like to join.' } })
  assert.equal(applied.status, 201)
  const count = get<{ n: number }>('SELECT COUNT(*) AS n FROM conversations')!.n
  const state = await request('/api/users/me/state', { cookie: applicant.cookie })
  assert.equal(state.body.applications.find((a: any) => a.opportunityId === id).conversationId, applied.body.conversationId)
  assert.equal(get<{ n: number }>('SELECT COUNT(*) AS n FROM conversations')!.n, count)
  // An imported application with no existing conversation remains null; GET must never create one.
  run('INSERT INTO applications (id, opportunity_id, user_id, role, message) VALUES (?, ?, ?, ?, ?)', 'imported-application', id, outsider.body.user.id, 'Designer', 'Imported request')
  const outsiderState = await request('/api/users/me/state', { cookie: outsider.cookie })
  assert.equal(outsiderState.body.applications[0].conversationId, null)
  assert.equal(get<{ n: number }>('SELECT COUNT(*) AS n FROM conversations')!.n, count)
})

test('read acknowledgements cannot hide unseen messages, regress, or cross conversation membership', async () => {
  const direct = await request('/api/conversations/direct', { method: 'POST', cookie: owner.cookie, body: { userId: outsider.body.user.id } })
  const id = direct.body.id
  const send = (cookie: string | undefined, text: string) => request(`/api/conversations/${id}/messages`, { method: 'POST', cookie, body: { text } })
  const first = await send(outsider.cookie, 'First incoming message')
  const snapshot = await request(`/api/conversations/${id}`, { cookie: owner.cookie })
  const second = await send(outsider.cookie, 'Arrives after the fetched snapshot')
  assert.ok(second.body.message.createdAt > first.body.message.createdAt)
  assert.equal(snapshot.body.messages.some((m: any) => m.id === second.body.message.id), false)
  const read = (messageId: string, cookie = owner.cookie) => request(`/api/conversations/${id}/read`, { method: 'POST', cookie, body: { messageId } })
  assert.equal((await read(first.body.message.id)).status, 204)
  let list = await request('/api/conversations', { cookie: owner.cookie })
  assert.equal(list.body.items.find((c: any) => c.id === id).unread, 1)
  await send(owner.cookie, 'A reply must not acknowledge incoming messages')
  list = await request('/api/conversations', { cookie: owner.cookie })
  assert.equal(list.body.items.find((c: any) => c.id === id).unread, 1)
  assert.equal((await read(second.body.message.id)).status, 204)
  assert.equal((await read(first.body.message.id)).status, 204)
  list = await request('/api/conversations', { cookie: owner.cookie })
  assert.equal(list.body.items.find((c: any) => c.id === id).unread, 0)
  assert.equal((await read(first.body.message.id, applicant.cookie)).status, 404)
  assert.equal((await read('missing-message')).status, 404)
  const foreignMessage = all<{ id: string }>('SELECT id FROM messages WHERE conversation_id != ? LIMIT 1', id)[0]
  assert.ok(foreignMessage)
  assert.equal((await read(foreignMessage.id)).status, 404)
  assert.equal((await request(`/api/conversations/${id}/read`, { method: 'POST', cookie: owner.cookie, body: {} })).status, 400)
})
