import assert from 'node:assert/strict'
import { test } from 'node:test'
import { incompatiblePublicationAttempt, isPublicationReplay, publicationAttempt } from '../src/site/publication-attempt'

test('retrying an uncertain publication reuses the idempotency key without creating another operation', () => {
  const previous = publicationAttempt(null, { title: 'Meetup', roles: ['Участник'] }, () => 'first-operation')
  assert.equal(publicationAttempt(previous, { title: 'Meetup', roles: ['Участник'] }, () => { throw new Error('Must not create a new key') }), previous)
})
test('a saved request is recognized only when its publication content is unchanged', () => {
  const payload = { title: 'Meetup' }
  const previous = publicationAttempt(null, payload, () => 'first-operation')
  const replay = isPublicationReplay(previous, payload)
  assert.equal(replay, true)
  assert.equal(isPublicationReplay(previous, { title: 'Another publication' }), false)
})
test('editing publication content creates a new operation rather than replaying stale content', () => {
  const previous = publicationAttempt(null, { title: 'Old title' }, () => 'first-operation')
  const next = publicationAttempt(previous, { title: 'New title' }, () => 'second-operation')
  assert.equal(next.key, 'second-operation')
  assert.equal(JSON.parse(next.payload).title, 'New title')
})

const pendingPublication = (campusId?: string) => publicationAttempt(null, {
  title: 'Saved publication', ...(campusId ? { campusId } : {}),
}, () => 'original-publication-key')

test('a desktop Campus request can replay for the same Campus without replacing its original key', () => {
  const pending = pendingPublication('campus-A')
  assert.equal(incompatiblePublicationAttempt(pending, true, 'campus-A'), false)
  const payload = JSON.parse(pending.payload)
  assert.equal(isPublicationReplay(pending, payload), true)
  assert.equal(publicationAttempt(pending, payload, () => { throw new Error('Must replay the original request') }), pending)
})

test('shrinking the viewport blocks an unresolved Campus request from becoming a personal publication', () => {
  const pending = pendingPublication('campus-A')
  assert.equal(incompatiblePublicationAttempt(pending, false, 'campus-A'), true)
  assert.equal(JSON.parse(pending.payload).campusId, 'campus-A')
})

test('a personal mobile retry ignores a Campus selection retained in the desktop draft', () => {
  const pending = pendingPublication()
  assert.equal(incompatiblePublicationAttempt(pending, false, 'campus-A'), false)
  assert.equal(isPublicationReplay(pending, { title: 'Saved publication' }), true)
})

test('expanding the viewport cannot add a retained Campus selection to an unresolved personal request', () => {
  const pending = pendingPublication()
  assert.equal(incompatiblePublicationAttempt(pending, true, 'campus-A'), true)
  assert.equal(Object.hasOwn(JSON.parse(pending.payload), 'campusId'), false)
})

test('a personal request remains retryable when the viewport expands without a Campus selection', () => {
  const pending = pendingPublication()
  assert.equal(incompatiblePublicationAttempt(pending, true), false)
  assert.equal(publicationAttempt(pending, { title: 'Saved publication' }, () => 'unexpected-new-key'), pending)
})

test('changing Campus on an unresolved request requires an explicit new submission', () => {
  const pending = pendingPublication('campus-A')
  assert.equal(incompatiblePublicationAttempt(pending, true, 'campus-B'), true)
})

test('removing Campus from an unresolved desktop request requires an explicit new submission', () => {
  const pending = pendingPublication('campus-A')
  assert.equal(incompatiblePublicationAttempt(pending, true), true)
})

test('clearing the unresolved attempt permits a new publication at either viewport width', () => {
  for (const desktop of [false, true]) {
    assert.equal(incompatiblePublicationAttempt(null, desktop, 'campus-A'), false)
  }
})
