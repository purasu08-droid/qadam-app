import assert from 'node:assert/strict'
import test from 'node:test'
import { formatTenge, publicationButtonText, publicationPriceText, type BillingQuote } from '../src/site/billing'

function quote(changes: Partial<BillingQuote> = {}): BillingQuote {
  return {
    service: 'publication', mode: 'enforced', pilotFree: false, currency: 'KZT', period: '2026-10',
    studentVerified: false, unitPrice: 500, expectedAmount: 500, amountDue: 500,
    source: 'payment_required', expectedSource: 'payment_required', usedPublications: 1,
    freeRemaining: 0, campusCovered: false, paymentRequired: true, canPublish: false,
    promotionActivationAvailable: false, ...changes,
  }
}

test('tenge formatting preserves whole KZT amounts and rejects invalid monetary values', () => {
  assert.equal(formatTenge(0), '0 ₸')
  assert.equal(formatTenge(250), '250 ₸')
  assert.equal(formatTenge(1000).replace(/\s/g, ' '), '1 000 ₸')
  for (const invalid of [-1, 0.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) assert.equal(formatTenge(invalid), '—')
})

test('pilot publication displays zero actual cost despite a nonzero future price', () => {
  const pilot = quote({ mode: 'preview', pilotFree: true, source: 'pilot', amountDue: 0, paymentRequired: false, canPublish: true, usedPublications: 12 })
  assert.match(publicationPriceText(pilot), /бесплатно.*пилот/i)
  assert.equal(publicationButtonText(pilot), 'Опубликовать бесплатно')
  assert.equal(pilot.expectedAmount, 500)
  assert.equal(pilot.amountDue, 0)
})

test('the monthly free publication is free even though the service has a list price', () => {
  const monthly = quote({ source: 'monthly_free', expectedSource: 'monthly_free', usedPublications: 0, freeRemaining: 1, expectedAmount: 0, amountDue: 0, paymentRequired: false, canPublish: true })
  assert.match(publicationPriceText(monthly), /первая публикация месяца.*бесплатно/i)
  assert.equal(publicationButtonText(monthly), 'Опубликовать бесплатно')
})

test('Campus coverage shows university funding rather than a second student charge', () => {
  const campus = quote({ studentVerified: true, unitPrice: 250, source: 'campus', expectedSource: 'campus', campusCovered: true, expectedAmount: 0, amountDue: 0, paymentRequired: false, canPublish: true })
  assert.match(publicationPriceText(campus), /покрыто.*вуз.*бесплатно/i)
  assert.doesNotMatch(publicationPriceText(campus), /250/)
  assert.equal(publicationButtonText(campus), 'Опубликовать бесплатно')
})

test('preview does not present a hypothetical Campus allocation as already consumed', () => {
  const campusPilot = quote({ mode: 'preview', pilotFree: true, source: 'pilot', expectedSource: 'campus', campusCovered: true, expectedAmount: 0, amountDue: 0, paymentRequired: false, canPublish: true })
  assert.match(publicationPriceText(campusPilot), /пилот/i)
  assert.doesNotMatch(publicationPriceText(campusPilot), /покрыто|списано/i)
})

test('a payment-required publication does not offer a fake checkout or successful publish', () => {
  for (const price of [500, 250]) {
    const blocked = quote({ studentVerified: price === 250, unitPrice: price, expectedAmount: price, amountDue: price })
    assert.match(publicationPriceText(blocked), new RegExp(String(price)))
    assert.equal(publicationButtonText(blocked), 'Оплата пока недоступна')
    assert.doesNotMatch(publicationButtonText(blocked), /опубликовать|оплатить/i)
  }
})

test('missing eligibility keeps the publish action in a checking state', () => {
  assert.equal(publicationButtonText(null), 'Проверяем условия…')
  assert.equal(publicationButtonText(undefined), 'Проверяем условия…')
})
