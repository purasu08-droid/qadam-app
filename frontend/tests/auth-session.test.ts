import assert from 'node:assert/strict'
import test from 'node:test'
import { createAuthSequencer } from '../src/site/auth-session'
import { safeReturnPath } from '../src/site/auth-utils'

test('a session transition prepares its destination before the new identity can redirect', () => {
  const sequence = createAuthSequencer()
  let destination = safeReturnPath('/create?draft=old#roles')
  let identity = 'ordinary-user'
  const observed: string[] = []
  const target = '/account/profile?tab=saved'
  const request = sequence.write()
  request.complete(() => {
    identity = 'demo-user'
    observed.push(`${identity}:${destination}`)
  }, () => { destination = safeReturnPath(target) })
  request.finish()
  assert.deepEqual(observed, ['demo-user:/account/profile?tab=saved'])
  assert.equal(safeReturnPath('/create?draft=old#roles'), '/create?draft=old#roles')
})

test('a stale sign-in response changes neither identity nor destination after invalidation', () => {
  const sequence = createAuthSequencer()
  const request = sequence.write()
  let identity = 'signed-out'
  let destination = '/signin'
  sequence.invalidate()
  assert.throws(() => request.complete(() => { identity = 'old-demo' }, () => { destination = '/account/profile' }), { name: 'AbortError' })
  request.finish()
  const next = sequence.write()
  next.complete(() => { identity = 'new-user' })
  next.finish()
  assert.throws(() => request.complete(() => { identity = 'old-demo' }, () => { destination = '/account/profile' }), { name: 'AbortError' })
  assert.equal(identity, 'new-user')
  assert.equal(destination, '/signin')
})

test('session writes cannot overlap, and a failed request can be retried', () => {
  const sequence = createAuthSequencer()
  const bootstrap = sequence.read()
  const first = sequence.write()
  assert.equal(sequence.isCurrent(bootstrap), false)
  assert.equal(sequence.busy, true)
  assert.throws(() => sequence.write(), /Дождись/)
  first.finish()
  first.finish()
  assert.equal(sequence.busy, false)
  const retry = sequence.write()
  let committed = false
  retry.complete(() => { committed = true })
  first.finish()
  assert.equal(sequence.busy, true)
  retry.finish()
  assert.equal(committed, true)
  assert.equal(sequence.busy, false)
})

