import assert from 'node:assert/strict'
import { after, afterEach, test } from 'node:test'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { IncomingMessage, ServerResponse } from 'node:http'
import { Socket } from 'node:net'

const temporaryDirectory = mkdtempSync(join(tmpdir(), 'qadam-billing-test-'))
process.env.NODE_ENV = 'production'
process.env.BILLING_MODE = 'preview'
process.env.DB_PATH = join(temporaryDirectory, 'billing.sqlite')
const { config } = await import('../src/config.js')
const { db, get, run } = await import('../src/db.js')
const { createApp } = await import('../src/app.js')
const { billingPeriod, billingQuote, billingMe, createPublicationWithBilling, backfillPublicationUsage } = await import('../src/billing.js')
const app = createApp()
type Result = { status: number; body: any; cookie?: string }
function request(path: string, options: { method?: string; body?: unknown; cookie?: string; ip?: string; idempotencyKey?: string } = {}): Promise<Result> {
  return new Promise((resolve, reject) => {
    const socket = new Socket()
    Object.defineProperty(socket, 'remoteAddress', { value: options.ip ?? '192.0.2.210' })
    const req = new IncomingMessage(socket)
    req.method = options.method ?? 'GET'
    req.url = path
    req.headers = options.cookie ? { cookie: options.cookie } : {}
    if (options.idempotencyKey !== undefined) req.headers['idempotency-key'] = options.idempotencyKey
    if (options.body !== undefined) {
      const body = JSON.stringify(options.body)
      req.headers['content-type'] = 'application/json'
      req.headers['content-length'] = String(Buffer.byteLength(body))
      req.push(body)
    }
    req.push(null)
    const res = new ServerResponse(req)
    res.end = function (chunk?: any) {
      let body: any
      try { body = JSON.parse(String(chunk)) } catch { body = undefined }
      const header = this.getHeader('set-cookie')
      resolve({ status: this.statusCode, body, cookie: (Array.isArray(header) ? header[0] : header)?.toString().split(';')[0] })
      return this
    } as typeof res.end
    app.handle(req, res, reject)
  })
}
type Actor = { id: string; cookie: string }
let sequence = 0
async function actor(extra: Record<string, unknown> = {}): Promise<Actor> {
  const index = ++sequence
  const result = await request('/api/auth/register', { method: 'POST', ip: `198.51.100.${index}`, body: {
    name: 'Billing Test', email: `billing-${index}@example.test`, password: 'test-password', ...extra,
  } })
  assert.equal(result.status, 201)
  return { id: result.body.user.id, cookie: result.cookie! }
}
const publication = { kind: 'idea', title: 'A billing test publication', description: 'A sufficiently detailed description.', city: 'Алматы', roles: ['Developer'] }
const publish = (user: Actor, extra: Record<string, unknown> = {}) => request('/api/opportunities', { method: 'POST', cookie: user.cookie, body: { ...publication, ...extra } })
const keyedPublish = (user: Actor, key: string, body: Record<string, unknown> = publication) => request('/api/opportunities', { method: 'POST', cookie: user.cookie, body, idempotencyKey: key })
const quote = (user: Actor, service = 'publication', opportunityId?: string) => request(`/api/billing/quote?service=${service}${opportunityId ? `&opportunityId=${opportunityId}` : ''}`, { cookie: user.cookie })
const countUsage = (user: Actor) => get<{ n: number }>('SELECT COUNT(*) AS n FROM billing_usage WHERE user_id = ?', user.id)!.n
const timestamp = (offset: number) => new Date(Date.now() + offset).toISOString()
function grant(user: Actor, service: string, quota = 1) {
  const id = `grant-${++sequence}`
  run('INSERT INTO billing_campus_grants (id, user_id, service, quota, valid_from, expires_at, issuer) VALUES (?, ?, ?, ?, ?, ?, ?)',
    id, user.id, service, quota, timestamp(-86_400_000), timestamp(86_400_000), 'Verified university')
  return id
}
function rawPublication(user: Actor, id: string, at: Date) {
  run(`INSERT INTO opportunities (id, kind, title, city, lat, lng, author_id, created_at)
    VALUES (?, 'idea', 'Calendar test', 'Алматы', 43.2, 76.9, ?, ?)`, id, user.id, at.toISOString())
}
function datedPublication(user: Actor, id: string, at: string) {
  const date = new Date(at)
  return createPublicationWithBilling(user.id, id, () => rawPublication(user, id, date), date)
}
afterEach(() => { config.billingMode = 'preview' })
after(() => { db.close(); rmSync(temporaryDirectory, { recursive: true, force: true }) })

test('public plans expose exact prices and Campus remains unpriced; personal quotes require login', async () => {
  const plans = await request('/api/billing/plans')
  assert.equal(plans.status, 200)
  assert.equal(plans.body.mode, 'preview')
  assert.equal(plans.body.timezone, 'Asia/Almaty')
  assert.deepEqual(plans.body.publication, { freePerMonth: 1, regular: 500, student: 250 })
  assert.deepEqual(plans.body.promotion3, { days: 3, regular: 500, student: 250 })
  assert.deepEqual(plans.body.promotion7, { days: 7, regular: 1000, student: 500 })
  assert.equal(plans.body.campus.price, null)
  assert.equal(plans.body.paymentAvailable, false)
  assert.equal((await request('/api/billing/me')).status, 401)
  assert.equal((await request('/api/billing/quote?service=publication')).status, 401)
})

test('pilot publishes beyond the future allowance for free without trusting overposted price or student fields', async () => {
  const user = await actor({ isStudent: true, verifiedStudent: true, campus: true, role: 'Student' })
  for (let i = 0; i < 4; i++) assert.equal((await publish(user, { paid: true, amount: 0, isStudent: true, campusCovered: true, promote: 7 })).status, 201)
  const result = await quote(user)
  assert.equal(result.body.studentVerified, false)
  assert.equal(result.body.usedPublications, 4)
  assert.equal(result.body.freeRemaining, 0)
  assert.equal(result.body.unitPrice, 500)
  assert.equal(result.body.expectedAmount, 500)
  assert.equal(result.body.expectedSource, 'payment_required')
  assert.equal(result.body.amountDue, 0)
  assert.equal(result.body.source, 'pilot')
  assert.equal(result.body.canPublish, true)
  assert.equal(countUsage(user), 4)
  assert.equal(get<{ n: number }>("SELECT COUNT(*) AS n FROM billing_usage WHERE user_id = ? AND (funding != 'pilot' OR amount_charged != 0 OR service != 'publication')", user.id)!.n, 0)
})

test('monthly allowance resets at Almaty month and year boundaries rather than UTC or rolling 30 days', async () => {
  config.billingMode = 'enforced'
  const user = await actor()
  assert.equal(billingPeriod('2026-10-31T18:59:59.999Z'), '2026-10')
  assert.equal(billingPeriod('2026-10-31T19:00:00.000Z'), '2026-11')
  datedPublication(user, 'october-publication', '2026-10-31T18:59:59.999Z')
  assert.equal(billingQuote(user.id, 'publication', { at: new Date('2026-10-31T18:59:59.999Z') }).expectedAmount, 500)
  assert.equal(billingQuote(user.id, 'publication', { at: new Date('2026-10-31T19:00:00.000Z') }).expectedSource, 'monthly_free')
  datedPublication(user, 'november-publication', '2026-10-31T19:00:00.000Z')
  datedPublication(user, 'december-publication', '2026-12-31T18:59:59.999Z')
  assert.equal(billingPeriod('2026-12-31T19:00:00.000Z'), '2027-01')
  datedPublication(user, 'january-publication', '2026-12-31T19:00:00.000Z')
  assert.equal(countUsage(user), 4)
})

test('validation and repeated quote GETs never consume the free publication', async () => {
  config.billingMode = 'enforced'
  const user = await actor()
  assert.equal((await publish(user, { title: '' })).status, 400)
  assert.equal((await quote(user)).body.expectedSource, 'monthly_free')
  assert.equal((await quote(user)).body.expectedSource, 'monthly_free')
  assert.equal((await quote(user, 'promotion3')).status, 400)
  assert.equal(countUsage(user), 0)
  assert.equal((await publish(user)).status, 201)
})

test('deleting a publication does not refund monthly usage; enforced payment has no fake bypass', async () => {
  config.billingMode = 'enforced'
  const user = await actor()
  const first = await publish(user)
  assert.equal(first.status, 201)
  assert.equal((await request(`/api/opportunities/${first.body.item.id}`, { method: 'DELETE', cookie: user.cookie })).status, 204)
  const denied = await publish(user, { paid: true, amount: 0, verifiedStudent: true })
  assert.equal(denied.status, 402)
  assert.equal(denied.body.code, 'PAYMENT_REQUIRED')
  assert.equal(denied.body.quote.amountDue, 500)
  assert.equal(denied.body.quote.studentVerified, false)
  assert.equal(countUsage(user), 1)
  assert.equal(get<{ n: number }>('SELECT COUNT(*) AS n FROM opportunities WHERE author_id = ?', user.id)!.n, 0)
})

test('concurrent publish requests cannot use the same monthly free allowance twice', async () => {
  config.billingMode = 'enforced'
  const user = await actor()
  const results = await Promise.all([publish(user), publish(user)])
  assert.deepEqual(results.map((result) => result.status).sort(), [201, 402])
  assert.equal(countUsage(user), 1)
  assert.equal(get<{ n: number }>('SELECT COUNT(*) AS n FROM opportunities WHERE author_id = ?', user.id)!.n, 1)
})

test('student prices require a current server verification and do not follow editable profile text', async () => {
  config.billingMode = 'enforced'
  const user = await actor()
  const own = await publish(user)
  assert.equal((await request('/api/users/me', { method: 'PATCH', cookie: user.cookie, body: { role: 'Студент университета' } })).status, 200)
  assert.equal((await quote(user)).body.expectedAmount, 500)
  run('INSERT INTO billing_student_verifications (user_id, source, verified_by, verified_at, expires_at) VALUES (?, ?, ?, ?, ?)',
    user.id, 'university', 'University administrator', timestamp(-1000), timestamp(86_400_000))
  assert.equal((await quote(user)).body.expectedAmount, 250)
  assert.equal((await quote(user, 'promotion3', own.body.item.id)).body.amountDue, 250)
  assert.equal((await quote(user, 'promotion7', own.body.item.id)).body.amountDue, 500)
  run('UPDATE billing_student_verifications SET expires_at = ? WHERE user_id = ?', timestamp(-1), user.id)
  assert.equal((await quote(user)).body.expectedAmount, 500)
})

test('monthly free precedes Campus, credits are service-specific and never charged twice', async () => {
  config.billingMode = 'enforced'
  const user = await actor()
  const publicationGrant = grant(user, 'publication')
  const promotionGrant = grant(user, 'promotion3')
  assert.equal((await quote(user)).body.expectedSource, 'monthly_free')
  const first = await publish(user)
  assert.equal(first.status, 201)
  assert.equal(get<{ n: number }>('SELECT COUNT(*) AS n FROM billing_usage WHERE campus_grant_id = ?', publicationGrant)!.n, 0)
  assert.equal((await quote(user)).body.expectedSource, 'campus')
  assert.equal((await publish(user)).status, 201)
  assert.equal(get<{ n: number }>('SELECT COUNT(*) AS n FROM billing_usage WHERE campus_grant_id = ? AND amount_charged = 0', publicationGrant)!.n, 1)
  assert.equal((await publish(user)).status, 402)
  for (let i = 0; i < 2; i++) {
    const promotion = await quote(user, 'promotion3', first.body.item.id)
    assert.equal(promotion.body.source, 'campus')
    assert.equal(promotion.body.amountDue, 0)
    assert.equal(promotion.body.promotionActivationAvailable, false)
  }
  assert.equal((await quote(user, 'promotion7', first.body.item.id)).body.amountDue, 1000)
  assert.equal(get<{ n: number }>('SELECT COUNT(*) AS n FROM billing_usage WHERE campus_grant_id = ?', promotionGrant)!.n, 0)
  assert.equal(countUsage(user), 2)
})

test('a quote does not reserve Campus; final publication rechecks expiry and failed transactions preserve credits', async () => {
  config.billingMode = 'enforced'
  const user = await actor()
  await publish(user)
  const id = grant(user, 'publication')
  assert.equal((await quote(user)).body.expectedSource, 'campus')
  assert.throws(() => createPublicationWithBilling(user.id, 'rolled-back-publication', () => {
    rawPublication(user, 'rolled-back-publication', new Date())
    throw new Error('Create failed')
  }), /Create failed/)
  assert.equal(get('SELECT 1 FROM opportunities WHERE id = ?', 'rolled-back-publication'), undefined)
  assert.equal(countUsage(user), 1)
  assert.equal(billingMe(user.id).campus[0].remaining, 1)
  run('UPDATE billing_campus_grants SET expires_at = ? WHERE id = ?', timestamp(-1), id)
  assert.equal((await publish(user)).status, 402)
  assert.equal(countUsage(user), 1)
})

test('pilot publication usage never consumes Campus credits and promotion remains opt-in quote only', async () => {
  const user = await actor()
  const id = grant(user, 'publication')
  const first = await publish(user)
  assert.equal((await publish(user)).status, 201)
  assert.equal((await publish(user)).status, 201)
  const result = await quote(user)
  assert.equal(result.body.expectedSource, 'campus')
  assert.equal(result.body.source, 'pilot')
  assert.equal(result.body.amountDue, 0)
  assert.equal(get<{ n: number }>('SELECT COUNT(*) AS n FROM billing_usage WHERE campus_grant_id = ?', id)!.n, 0)
  assert.equal(billingMe(user.id).campus[0].remaining, 1)
  const stranger = await actor()
  assert.equal((await quote(stranger, 'promotion3', first.body.item.id)).status, 403)
  assert.equal((await quote(user, 'promotion3', 'missing')).status, 404)
  assert.equal((await quote(user, 'unknown-service')).status, 400)
  assert.equal((await request('/api/billing/promotions', { method: 'POST', cookie: user.cookie, body: { paid: true, opportunityId: first.body.item.id } })).status, 404)
  assert.equal(get<{ n: number }>("SELECT COUNT(*) AS n FROM billing_usage WHERE service != 'publication'")!.n, 0)
})

test('legacy backfill is idempotent, uses original calendar periods and survives deletion', async () => {
  config.billingMode = 'enforced'
  const user = await actor()
  rawPublication(user, 'legacy-november', new Date('2026-10-31T19:00:00.000Z'))
  rawPublication(user, 'legacy-september', new Date('2026-09-15T00:00:00.000Z'))
  backfillPublicationUsage()
  backfillPublicationUsage()
  assert.equal(countUsage(user), 2)
  assert.equal(get<{ period: string }>('SELECT period FROM billing_usage WHERE opportunity_id = ?', 'legacy-november')!.period, '2026-11')
  run('DELETE FROM opportunities WHERE id = ?', 'legacy-november')
  backfillPublicationUsage()
  assert.equal(countUsage(user), 2)
  assert.equal(billingQuote(user.id, 'publication', { at: new Date('2026-11-01T00:00:00.000Z') }).expectedAmount, 500)
  assert.throws(() => run('UPDATE billing_usage SET period = ? WHERE user_id = ?', '2027-01', user.id), /immutable/)
})

test('local administration validates existing users, source, future expiry and Campus quotas without a public setter', async () => {
  const { runBillingAdmin } = await import('../src/billing-admin.js')
  const user = await actor()
  const email = get<{ email: string }>('SELECT email FROM users WHERE id = ?', user.id)!.email
  assert.throws(() => runBillingAdmin('student', ['--email', 'unknown@example.test', '--source', 'admin']), /не найден/)
  assert.throws(() => runBillingAdmin('student', ['--email', email, '--source', 'self']), /Invalid enum/)
  assert.throws(() => runBillingAdmin('student', ['--email', email, '--source', 'admin', '--expires', '2020-01-01T00:00:00Z']), /будущем/)
  assert.throws(() => runBillingAdmin('student', ['--email', email, '--source', 'admin', '--expires', '2030-01-01']), /ISO/)
  assert.equal(get('SELECT 1 FROM billing_student_verifications WHERE user_id = ?', user.id), undefined)
  const verified = runBillingAdmin('student', ['--email', email.toUpperCase(), '--source', 'university', '--expires', timestamp(86_400_000)])
  assert.equal(verified.status, 'verified')
  assert.equal(billingQuote(user.id, 'publication').unitPrice, 250)
  runBillingAdmin('student', ['--email', email, '--revoke'])
  assert.equal(billingQuote(user.id, 'publication').unitPrice, 500)
  assert.throws(() => runBillingAdmin('grant', ['--email', email, '--service', 'publication', '--quota', '0', '--expires', timestamp(86_400_000), '--campus', 'University']), /greater than or equal/)
  const granted = runBillingAdmin('grant', ['--email', email, '--service', 'publication', '--quota', '2', '--expires', timestamp(86_400_000), '--campus', 'University'])
  assert.equal(granted.status, 'granted')
  assert.equal(billingMe(user.id).campus[0].remaining, 2)
  assert.equal((await request('/api/billing/student', { method: 'POST', cookie: user.cookie, body: { verified: true } })).status, 404)
})

test('publication retry returns the original result before the payment gate and consumes one Campus credit', async () => {
  config.billingMode = 'enforced'
  const user = await actor()
  assert.equal((await publish(user)).status, 201)
  const credit = grant(user, 'publication')
  const first = await keyedPublish(user, 'campus-request-1')
  assert.equal(first.status, 201)
  assert.equal((await quote(user)).body.paymentRequired, true)
  // Explicit defaults, whitespace, JSON field order and stripped client-only fields hash to the same parsed body.
  const retry = await keyedPublish(user, 'campus-request-1', {
    roles: [' Developer '], title: ` ${publication.title} `, city: publication.city,
    description: publication.description, kind: publication.kind, direction: '', stage: '', online: false,
    size: '', deadline: '', paid: true, amount: 0,
  })
  assert.equal(retry.status, 201)
  assert.equal(retry.body.item.id, first.body.item.id)
  assert.equal(countUsage(user), 2)
  assert.equal(get<{ n: number }>('SELECT COUNT(*) AS n FROM billing_usage WHERE campus_grant_id = ?', credit)!.n, 1)
  assert.equal(get<{ n: number }>('SELECT COUNT(*) AS n FROM opportunities WHERE author_id = ?', user.id)!.n, 2)
})

test('one request key rejects changed payloads but is scoped to the authenticated user', async () => {
  config.billingMode = 'enforced'
  const user = await actor()
  const first = await keyedPublish(user, 'shared-key')
  assert.equal(first.status, 201)
  const changed = await keyedPublish(user, 'shared-key', { ...publication, title: 'A changed title' })
  assert.equal(changed.status, 409)
  assert.equal(changed.body.code, 'IDEMPOTENCY_CONFLICT')
  assert.equal(countUsage(user), 1)
  const other = await actor()
  const own = await keyedPublish(other, 'shared-key', { ...publication, title: 'Another account title' })
  assert.equal(own.status, 201)
  assert.notEqual(own.body.item.id, first.body.item.id)
})

test('concurrent requests with one key create one publication and one monthly usage record', async () => {
  config.billingMode = 'enforced'
  const user = await actor()
  const results = await Promise.all([keyedPublish(user, 'concurrent-key'), keyedPublish(user, 'concurrent-key')])
  assert.deepEqual(results.map((result) => result.status), [201, 201])
  assert.equal(results[0].body.item.id, results[1].body.item.id)
  assert.equal(countUsage(user), 1)
  assert.equal(get<{ n: number }>('SELECT COUNT(*) AS n FROM publication_requests WHERE user_id = ?', user.id)!.n, 1)
  assert.equal(get<{ n: number }>('SELECT COUNT(*) AS n FROM billing_publication_requests WHERE user_id = ?', user.id)!.n, 0)
  assert.equal(get<{ n: number }>('SELECT COUNT(*) AS n FROM opportunities WHERE author_id = ?', user.id)!.n, 1)
})

test('deleted publication retries cannot recreate the result or refund the original usage', async () => {
  config.billingMode = 'enforced'
  const user = await actor()
  const first = await keyedPublish(user, 'deleted-key')
  assert.equal(first.status, 201)
  assert.equal((await request(`/api/opportunities/${first.body.item.id}`, { method: 'DELETE', cookie: user.cookie })).status, 204)
  const retry = await keyedPublish(user, 'deleted-key')
  assert.equal(retry.status, 410)
  assert.equal(retry.body.code, 'IDEMPOTENCY_GONE')
  assert.equal(countUsage(user), 1)
  assert.equal(get<{ n: number }>('SELECT COUNT(*) AS n FROM opportunities WHERE author_id = ?', user.id)!.n, 0)
})

test('invalid bodies and rejected payments never reserve an idempotency key', async () => {
  config.billingMode = 'enforced'
  const user = await actor()
  assert.equal((await keyedPublish(user, 'validation-key', { ...publication, title: '' })).status, 400)
  assert.equal((await keyedPublish(user, 'x'.repeat(129))).status, 400)
  assert.equal(get<{ n: number }>('SELECT COUNT(*) AS n FROM publication_requests WHERE user_id = ?', user.id)!.n, 0)
  assert.equal((await keyedPublish(user, 'validation-key')).status, 201)
  assert.equal((await keyedPublish(user, 'payment-key')).status, 402)
  assert.equal(get<{ n: number }>('SELECT COUNT(*) AS n FROM publication_requests WHERE user_id = ?', user.id)!.n, 1)
  grant(user, 'publication')
  assert.equal((await keyedPublish(user, 'payment-key')).status, 201)
  assert.equal(countUsage(user), 2)
})

test('demo reset refuses protected billing and retry history without changing it', async () => {
  const { seed } = await import('../src/seed.js')
  const before = get<{ n: number }>('SELECT COUNT(*) AS n FROM billing_usage')!.n
  const requests = get<{ n: number }>('SELECT COUNT(*) AS n FROM publication_requests')!.n
  assert.ok(before > 0)
  assert.throws(() => seed({ reset: true }), /защищённые данные/)
  assert.equal(get<{ n: number }>('SELECT COUNT(*) AS n FROM billing_usage')!.n, before)
  assert.equal(get<{ n: number }>('SELECT COUNT(*) AS n FROM publication_requests')!.n, requests)
  createApp()
  assert.equal(get<{ n: number }>('SELECT COUNT(*) AS n FROM billing_usage')!.n, before)
})
