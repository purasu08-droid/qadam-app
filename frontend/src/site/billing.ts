import { getLocale, t } from './i18n'

export type BillingService = 'publication' | 'promotion3' | 'promotion7'
export type BillingSource = 'pilot' | 'monthly_free' | 'campus' | 'payment_required'
export type BillingQuote = {
  service: BillingService
  mode: 'preview' | 'enforced'
  pilotFree: boolean
  currency: 'KZT'
  period: string
  studentVerified: boolean
  unitPrice: number
  expectedAmount: number
  amountDue: number
  source: BillingSource
  expectedSource: Exclude<BillingSource, 'pilot'>
  usedPublications: number
  freeRemaining: number
  campusCovered: boolean
  paymentRequired: boolean
  canPublish: boolean
  promotionActivationAvailable: false
}

export type BillingAccount = {
  mode: 'preview' | 'enforced'
  pilotFree: boolean
  period: string
  studentVerified: boolean
  usedPublications: number
  freeRemaining: number
  campus: { service: BillingService; remaining: number; expiresAt: string }[]
}

export function formatTenge(value: number) {
  return Number.isSafeInteger(value) && value >= 0 ? `${new Intl.NumberFormat(getLocale()).format(value)} ₸` : '—'
}

export function publicationPriceText(quote: BillingQuote) {
  if (quote.pilotFree) return t('Бесплатно в пилоте')
  if (quote.source === 'monthly_free') return t('Первая публикация месяца — бесплатно')
  if (quote.source === 'campus') return t('Покрыто пакетом вуза — бесплатно для тебя')
  return t('К оплате: {amount}', {amount:formatTenge(quote.amountDue)})
}

export function publicationButtonText(quote?: BillingQuote | null, pendingReplay = false) {
  if (pendingReplay) return t('Проверить результат отправки')
  if (!quote) return t('Проверяем условия…')
  if (!quote.canPublish) return t('Оплата пока недоступна')
  return t(quote.amountDue === 0 ? 'Опубликовать бесплатно' : 'Опубликовать')
}

export function canSubmitPublication(quote: BillingQuote | null, error: string | null, pendingReplay: boolean) {
  return pendingReplay || (!!quote?.canPublish && !error)
}

export { isPublicationReplay, newPublicationKey, publicationAttempt, readPublicationAttempt } from './publication-attempt'
export type { PublicationAttempt } from './publication-attempt'
