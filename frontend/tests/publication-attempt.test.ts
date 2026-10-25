import assert from 'node:assert/strict'
import { test } from 'node:test'
import { isPublicationReplay, publicationAttempt } from '../src/site/publication-attempt'

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
