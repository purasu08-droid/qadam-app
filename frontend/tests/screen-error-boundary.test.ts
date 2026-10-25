import assert from 'node:assert/strict'
import test from 'node:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import ScreenErrorBoundary, { ScreenErrorFallback } from '../src/site/components/ScreenErrorBoundary'

function fallback(language: string, theme: string) {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'document')
  Object.defineProperty(globalThis, 'document', { configurable: true, value: { documentElement: { lang: language, dataset: { theme } } } })
  try { return renderToStaticMarkup(createElement(ScreenErrorFallback)) }
  finally {
    if (previous) Object.defineProperty(globalThis, 'document', previous)
    else Reflect.deleteProperty(globalThis, 'document')
  }
}

test('recovery renders without a router, application provider or stylesheet in every supported language', () => {
  for (const [language, heading, button] of [
    ['ru', 'Не удалось открыть страницу', 'Обновить страницу'],
    ['kk', 'Бетті ашу мүмкін болмады', 'Бетті жаңарту'],
    ['en', 'Could not open the page', 'Reload page'],
  ]) {
    const html = fallback(language, 'light')
    assert.ok(html.includes(heading), language)
    assert.ok(html.includes(button), language)
    assert.ok(html.includes('role="alert"'), language)
    assert.ok(html.includes('aria-labelledby="qadam-screen-error-title"'), language)
    assert.ok(html.includes('type="button"'), language)
    assert.ok(html.includes('min-height:100vh'), language)
  }
})

test('recovery respects the HTML theme and safely falls back to Russian for an unsupported language', () => {
  const light = fallback('ru', 'light'), dark = fallback('ru', 'dark')
  assert.ok(light.includes('color-scheme:light'))
  assert.ok(dark.includes('color-scheme:dark'))
  assert.notEqual(light, dark)
  assert.ok(fallback('unknown', 'light').includes('Не удалось открыть страницу'))
})

test('the boundary keeps healthy children intact', () => {
  const html = renderToStaticMarkup(createElement(ScreenErrorBoundary, { children: createElement('p', null, 'Original page content') }))
  assert.equal(html, '<p>Original page content</p>')
})
