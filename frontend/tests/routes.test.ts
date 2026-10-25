import assert from 'node:assert/strict'
import { test } from 'node:test'
import { legacyTarget } from '../src/site/routes'

test('mobile conversation links keep the specific conversation, query and anchor', () => {
  assert.deepEqual(legacyTarget('/chats', { id: 'c_123', search: '?q=hello', hash: '#last' }), { pathname: '/chats/c_123', search: 'q=hello', hash: '#last' })
})
test('legacy categories map to shared API kinds without losing search or city', () => {
  const target = legacyTarget('/map', { search: '?category=ideas&q=React&city=Астана', list: true })
  const params = new URLSearchParams(target.search)
  assert.equal(params.get('kind'), 'idea')
  assert.equal(params.get('q'), 'React')
  assert.equal(params.get('city'), 'Астана')
  assert.equal(params.get('view'), 'list')
  assert.equal(params.has('category'), false)
  assert.equal(legacyTarget('/map', { search: '?view=map', list: true }).search, 'view=map')
})
