import assert from 'node:assert/strict'
import test from 'node:test'
import { localeFor, normalizeLanguage, translateMessage } from '../src/site/i18n-core'
import { translations } from '../src/site/i18n'
import { CITIES, KINDS, STATUS, FAQ } from '../src/site/data'

test('language choices accept canonical language codes and safely default to Russian', () => {
  assert.equal(normalizeLanguage('kk'), 'kk')
  assert.equal(normalizeLanguage('en'), 'en')
  for (const input of [undefined, null, '', 'kz', 'unknown', 'ru']) assert.equal(normalizeLanguage(input), 'ru')
  assert.deepEqual(['ru', 'kk', 'en'].map((language) => localeFor(normalizeLanguage(language))), ['ru-RU', 'kk-KZ', 'en-GB'])
})

test('every translated message has both target languages and preserves named parameters', () => {
  assert.ok(Object.keys(translations).length > 0)
  const placeholders = (text: string) => [...text.matchAll(/\{(\w+)\}/g)].map((match) => match[1]).sort()
  for (const [source, translated] of Object.entries(translations)) {
    for (const language of ['kk', 'en'] as const) {
      assert.ok(translated[language].trim(), `${language}: ${source}`)
      assert.deepEqual(placeholders(translated[language]), placeholders(source), `${language}: ${source}`)
    }
  }
})

test('shared categories, cities, project statuses and FAQ are translated consistently', () => {
  const messages = [
    ...CITIES.map((city) => city.name), ...Object.values(STATUS),
    ...Object.values(KINDS).flatMap(({label, plural, hint, tile, publish}) => [label, plural, hint, tile, publish]),
    ...FAQ.flatMap(({q, a}) => [q, a]),
  ]
  for (const message of messages) assert.ok(Object.hasOwn(translations, message), message)
})

test('interpolated user text stays intact and unknown messages safely fall back to source', () => {
  const value = 'A <B> $& {city}'
  assert.equal(translateMessage(translations, 'en', 'Город: {city}', {city:value}), `City: ${value}`)
  assert.equal(translateMessage(translations, 'ru', 'Город: {city}', {city:value}), `Город: ${value}`)
  assert.equal(translateMessage(translations, 'kk', 'An original user message'), 'An original user message')
  assert.equal(translateMessage(translations, 'en', 'Unknown {value}', {value:0}), 'Unknown 0')
})
