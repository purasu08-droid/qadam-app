import assert from 'node:assert/strict'
import test from 'node:test'
import { formatLocalizedDate } from '../src/site/i18n-date'

const date = new Date('2026-10-24T12:34:56.000Z')

test('Kazakh month and weekday names do not depend on any kk Intl locale data', () => {
  const native = Intl.DateTimeFormat
  Intl.DateTimeFormat = new Proxy(native, {
    construct(target, args) {
      assert.ok(!String(args[0]).includes('kk'), 'Kazakh formatting must not request missing kk ICU data')
      return Reflect.construct(target, args)
    },
  })
  try {
    assert.equal(formatLocalizedDate(date, 'kk', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }), 'сенбі, 24 қазан 2026 ж.')
    assert.equal(formatLocalizedDate(date, 'kk', { weekday: 'short', timeZone: 'UTC' }), 'сб')
    assert.equal(formatLocalizedDate(date, 'kk', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }), '24 қаз. 2026 ж.')
  } finally { Intl.DateTimeFormat = native }
})

test('all twelve Kazakh months and all seven weekdays have explicit names', () => {
  const months = ['қаңтар', 'ақпан', 'наурыз', 'сәуір', 'мамыр', 'маусым', 'шілде', 'тамыз', 'қыркүйек', 'қазан', 'қараша', 'желтоқсан']
  months.forEach((name, month) => assert.equal(formatLocalizedDate(new Date(Date.UTC(2026, month, 15)), 'kk', { month: 'long', timeZone: 'UTC' }), name))
  const weekdays = ['жексенбі', 'дүйсенбі', 'сейсенбі', 'сәрсенбі', 'бейсенбі', 'жұма', 'сенбі']
  weekdays.forEach((name, day) => assert.equal(formatLocalizedDate(new Date(Date.UTC(2026, 9, 18 + day)), 'kk', { weekday: 'long', timeZone: 'UTC' }), name))
})

test('Kazakh dates and clock parts use the requested time zone across a month boundary', () => {
  const boundary = new Date('2026-10-31T22:07:09.000Z')
  const options: Intl.DateTimeFormatOptions = { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }
  assert.equal(formatLocalizedDate(boundary, 'kk', { ...options, timeZone: 'UTC' }), '31 қазан 2026 ж., 22:07:09')
  assert.equal(formatLocalizedDate(boundary, 'kk', { ...options, timeZone: 'Asia/Almaty' }), '01 қараша 2026 ж., 03:07:09')
})

test('numeric dates, two-digit years and time-only options preserve their parts', () => {
  assert.equal(formatLocalizedDate(date, 'kk', { day: '2-digit', month: '2-digit', year: '2-digit', timeZone: 'UTC' }), '24.10.26')
  assert.equal(formatLocalizedDate(date, 'kk', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false, timeZone: 'UTC' }), '12:34:56')
  assert.equal(formatLocalizedDate(date, 'kk', { day: 'numeric', month: 'long', timeZone: 'UTC' }), '24 қазан')
})

test('Russian and English preserve normal Intl formatting, including explicit time zones', () => {
  const options: Intl.DateTimeFormatOptions = { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'America/New_York' }
  assert.equal(formatLocalizedDate(date, 'ru', options), new Intl.DateTimeFormat('ru-RU', options).format(date))
  assert.equal(formatLocalizedDate(date, 'en', options), new Intl.DateTimeFormat('en-GB', options).format(date))
})
