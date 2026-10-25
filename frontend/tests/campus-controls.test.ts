import assert from 'node:assert/strict'
import test from 'node:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { CampusLoad, CampusPager } from '../src/site/components/campus/CampusShared'

test('campus pagination inside a grant form never becomes a submit control', () => {
  const html = renderToStaticMarkup(createElement('form', {}, createElement(CampusPager, { page: 2, total: 60, pageSize: 20, loading: false, change: () => {} })))
  const buttons = html.match(/<button\b[^>]*>/g) ?? []
  assert.equal(buttons.length, 2)
  assert.ok(buttons.every((button) => /\btype="button"/.test(button)))
})

test('retrying a campus GET from inside a grant form never submits a grant', () => {
  const html = renderToStaticMarkup(createElement('form', {}, createElement(CampusLoad, { loading: false, error: 'Нет связи', retry: () => {} })))
  const buttons = html.match(/<button\b[^>]*>/g) ?? []
  assert.equal(buttons.length, 1)
  assert.match(buttons[0], /\btype="button"/)
})
