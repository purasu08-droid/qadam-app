import assert from 'node:assert/strict'
import test from 'node:test'
import { canonicalMapParams, filterMapItems, readMapFilters } from '../src/site/map-utils'
import type { Opportunity } from '../src/site/data'

const items: Opportunity[] = [
  { id: 'almaty', title: 'Дизайн', kind: 'event', city: 'Алматы', coords: [43.2, 76.9], meta: 'Встреча', card: 'Общение', subtitle: '', about: '', cta: '' },
  { id: 'astana', title: 'Команда проекта', kind: 'idea', city: 'Астана', coords: [51.1, 71.4], meta: 'Разработка', card: 'Новый проект', subtitle: '', about: '', cta: '', online: false },
]

test('a focused publication overrides a saved city and incompatible filters', () => {
  const params = new URLSearchParams('focus=astana&city=Алматы&kind=event&q=дизайн&online=1')
  const state = readMapFilters(params, 'Шымкент', items)
  assert.equal(state.city, 'Астана')
  assert.equal(state.kind, null)
  assert.equal(state.query, '')
  assert.equal(state.onlineOnly, false)
  assert.deepEqual(filterMapItems(items, state).map((o) => o.id), ['astana'])
  assert.equal(canonicalMapParams(params, state).get('city'), 'Астана')
})

test('URL filters override saved preferences and survive serialization', () => {
  const params = new URLSearchParams('city=Алматы&kind=event&q=ДИЗАЙН&online=0&view=list')
  const state = readMapFilters(params, 'Астана', items)
  assert.deepEqual(filterMapItems(items, state).map((o) => o.id), ['almaty'])
  assert.deepEqual(readMapFilters(canonicalMapParams(params, state), 'Шымкент', items), state)
})

test('invalid kinds and cities are normalized, empty results remain empty', () => {
  const params = new URLSearchParams('kind=__proto__&city=unknown&view=unknown&q=нет')
  const state = readMapFilters(params, 'Астана', items)
  assert.equal(state.kind, null)
  assert.equal(state.city, 'Астана')
  assert.equal(state.view, 'map')
  assert.deepEqual(filterMapItems(items, state), [])
  assert.equal(canonicalMapParams(params, state).has('kind'), false)
})
