import assert from 'node:assert/strict'
import test from 'node:test'
import { futureExpiry, grantAttempt, parseGrantAttempt, uncertainCampusWrite, type GrantBody } from '../src/site/campus-helpers'

const body: GrantBody = { userId: 'student-1', service: 'publication', quota: 5, expiresAt: '2030-12-01T00:00:00.000Z' }

test('grant retries reuse an exact frozen body and key', () => {
  const first = grantAttempt(body, null, () => 'campus_grant_key_123', 'Студент')
  const restored = parseGrantAttempt(JSON.stringify(first))
  assert.deepEqual(restored, first)
  const retry = grantAttempt(body, restored, () => { throw new Error('must not generate another key') }, 'Новое имя')
  assert.strictEqual(retry, restored)
  assert.throws(() => grantAttempt({ ...body, quota: 6 }, restored, () => 'another_key_12345', 'Студент'), /предыдущей отправки/)
})

test('stored grant attempts reject invalid keys, services, quotas and malformed data', () => {
  const valid = grantAttempt(body, null, () => 'campus_grant_key_123', 'Студент')
  for (const raw of [null, '{', JSON.stringify({ ...valid, key: 'short' }), JSON.stringify({ ...valid, payload: JSON.stringify({ ...body, quota: -1 }) }), JSON.stringify({ ...valid, payload: JSON.stringify({ ...body, service: '__proto__' }) }), JSON.stringify({ ...valid, payload: 'null' })]) assert.equal(parseGrantAttempt(raw), null)
})

test('expiry must be valid and strictly in the future', () => {
  const now = Date.parse('2028-01-01T00:00:00Z')
  assert.equal(futureExpiry('2028-01-02T10:00:00+05:00', now), '2028-01-02T05:00:00.000Z')
  for (const value of ['', 'not-a-date', '2028-01-01T00:00:00Z', '2027-01-01T00:00:00Z']) assert.throws(() => futureExpiry(value, now))
})

test('unknown server outcomes keep grant replay available', () => {
  for (const status of [0, 500, 502, 503]) assert.equal(uncertainCampusWrite(status), true)
  for (const status of [400, 401, 403, 409, 429]) assert.equal(uncertainCampusWrite(status), false)
})
