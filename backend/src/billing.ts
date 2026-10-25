import { createPublication, type PublicationRequest } from './publication-requests.js'
export { publicationPayloadHash } from './publication-requests.js'
import { config } from './config.js'
import { all, get, newId, run, tx } from './db.js'
import { currentMembership } from './campus.js'

export const BILLING_TIMEZONE = 'Asia/Almaty'
export const BILLING_SERVICES = ['publication', 'promotion3', 'promotion7'] as const
export type BillingService = typeof BILLING_SERVICES[number]
type Coverage = 'monthly_free' | 'campus' | 'payment_required'
const PRICES = {
  publication: { regular: 500, student: 250 },
  promotion3: { regular: 500, student: 250 },
  promotion7: { regular: 1000, student: 500 },
} as const
const monthFormatter = new Intl.DateTimeFormat('en', { timeZone: BILLING_TIMEZONE, year: 'numeric', month: '2-digit' })

export function billingPeriod(at: Date | string = new Date()) {
  const parts = monthFormatter.formatToParts(typeof at === 'string' ? new Date(at) : at)
  return `${parts.find((part) => part.type === 'year')!.value}-${parts.find((part) => part.type === 'month')!.value}`
}

export function billingPlans() {
  return {
    mode: config.billingMode,
    pilotFree: config.billingMode === 'preview',
    currency: 'KZT' as const,
    timezone: BILLING_TIMEZONE,
    publication: { freePerMonth: 1, ...PRICES.publication },
    promotion3: { days: 3, ...PRICES.promotion3 },
    promotion7: { days: 7, ...PRICES.promotion7 },
    campus: { price: null, universityPaid: true },
    paymentAvailable: false,
  }
}

function verifiedStudent(userId: string, timestamp: string) {
  return Boolean(currentMembership(userId, undefined, timestamp) || get(`SELECT 1 FROM billing_student_verifications WHERE user_id = ? AND verified_at <= ?
    AND (expires_at IS NULL OR expires_at > ?)`, userId, timestamp, timestamp))
}

type CampusGrant = { id: string; service: BillingService; remaining: number; expiresAt: string }
function campusGrants(userId: string, timestamp: string) {
  return all<CampusGrant>(
    `SELECT g.id, g.service, g.expires_at AS expiresAt,
       g.quota - (SELECT COUNT(*) FROM billing_usage u WHERE u.campus_grant_id = g.id) AS remaining
     FROM billing_campus_grants g WHERE g.user_id = ? AND g.valid_from <= ? AND g.expires_at > ? AND g.revoked_at IS NULL
       AND (g.campus_id IS NULL OR EXISTS (SELECT 1 FROM campus_students s WHERE s.user_id=g.user_id AND s.campus_id=g.campus_id
         AND s.status='verified' AND s.verified_at <= ? AND (s.expires_at IS NULL OR s.expires_at > ?)))
       AND g.quota > (SELECT COUNT(*) FROM billing_usage u WHERE u.campus_grant_id = g.id)
     ORDER BY g.expires_at, g.created_at, g.id`,
    userId, timestamp, timestamp, timestamp, timestamp,
  )
}

function publicationUsage(userId: string, period: string) {
  return get<{ n: number }>("SELECT COUNT(*) AS n FROM billing_usage WHERE user_id = ? AND service = 'publication' AND period = ?", userId, period)!.n
}

export function billingMe(userId: string, at = new Date()) {
  const period = billingPeriod(at)
  const timestamp = at.toISOString()
  const usedPublications = publicationUsage(userId, period)
  return {
    mode: config.billingMode,
    pilotFree: config.billingMode === 'preview',
    period,
    studentVerified: verifiedStudent(userId, timestamp),
    usedPublications,
    freeRemaining: Math.max(0, 1 - usedPublications),
    campus: campusGrants(userId, timestamp).map(({ service, remaining, expiresAt }) => ({ service, remaining, expiresAt })),
  }
}

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
  source: Coverage | 'pilot'
  expectedSource: Coverage
  usedPublications: number
  freeRemaining: number
  campusCovered: boolean
  paymentRequired: boolean
  canPublish: boolean
  promotionActivationAvailable: false
}

export class BillingError extends Error {
  constructor(public status: number, public code: string, message: string, public quote?: BillingQuote) {
    super(message)
  }
}

export function billingQuote(userId: string, service: BillingService, options: { opportunityId?: string; at?: Date } = {}): BillingQuote {
  const at = options.at ?? new Date()
  if (service !== 'publication') {
    if (!options.opportunityId) throw new BillingError(400, 'OPPORTUNITY_REQUIRED', 'Выбери свою публикацию для продвижения')
    const opportunity = get<{ author_id: string | null }>('SELECT author_id FROM opportunities WHERE id = ?', options.opportunityId)
    if (!opportunity) throw new BillingError(404, 'OPPORTUNITY_NOT_FOUND', 'Публикация не найдена')
    if (opportunity.author_id !== userId) throw new BillingError(403, 'NOT_OWNER', 'Продвигать можно только свою публикацию')
  }
  const period = billingPeriod(at)
  const timestamp = at.toISOString()
  const studentVerified = verifiedStudent(userId, timestamp)
  const usedPublications = publicationUsage(userId, period)
  const freeRemaining = Math.max(0, 1 - usedPublications)
  const grant = campusGrants(userId, timestamp).find((candidate) => candidate.service === service)
  const unitPrice = studentVerified ? PRICES[service].student : PRICES[service].regular
  const expectedSource: Coverage = service === 'publication' && freeRemaining > 0 ? 'monthly_free' : grant ? 'campus' : 'payment_required'
  const expectedAmount = expectedSource === 'payment_required' ? unitPrice : 0
  const pilotFree = config.billingMode === 'preview' && service === 'publication'
  return {
    service, mode: config.billingMode, pilotFree, currency: 'KZT', period, studentVerified, unitPrice,
    expectedAmount, amountDue: pilotFree ? 0 : expectedAmount,
    source: pilotFree ? 'pilot' : expectedSource, expectedSource, usedPublications, freeRemaining,
    campusCovered: expectedSource === 'campus', paymentRequired: !pilotFree && expectedAmount > 0,
    canPublish: service === 'publication' && (pilotFree || expectedAmount === 0), promotionActivationAvailable: false,
  }
}

/** Retry lookup happens before the billing gate and Campus binding in one transaction. */
export function createPublicationWithBilling(userId: string, opportunityId: string, create: () => void, at?: Date, idempotency?: PublicationRequest): string {
  return createPublication(userId, opportunityId, () => {
    // Capture time after the neutral wrapper obtains the write lock.
    const effectiveAt = at ?? new Date()
    const quote = billingQuote(userId, 'publication', { at: effectiveAt })
    if (!quote.canPublish) throw new BillingError(402, 'PAYMENT_REQUIRED', 'Бесплатная публикация за этот месяц уже использована. Оплата пока недоступна; сохрани черновик.', quote)
    const grant = quote.source === 'campus' ? campusGrants(userId, effectiveAt.toISOString()).find((candidate) => candidate.service === 'publication') : undefined
    create()
    run(`INSERT INTO billing_usage (id, user_id, service, opportunity_id, period, funding, campus_grant_id, unit_price, amount_charged, created_at)
      VALUES (?, ?, 'publication', ?, ?, ?, ?, ?, 0, ?)`,
    newId('bu'), userId, opportunityId, quote.period, quote.source, grant?.id ?? null, quote.unitPrice, effectiveAt.toISOString())
  }, idempotency)
}

/** Existing publications count in their original calendar month, without inventing payments or Campus consumption. */
export function backfillPublicationUsage() {
  tx(() => {
    const legacy = all<{ id: string; author_id: string; created_at: string }>(
      `SELECT history.id,history.author_id,history.created_at FROM (
         SELECT o.id,o.author_id,o.created_at FROM opportunities o WHERE o.author_id IS NOT NULL
         UNION ALL
         SELECT p.opportunity_id AS id,p.user_id AS author_id,MIN(p.created_at) AS created_at
         FROM publication_requests p WHERE NOT EXISTS (SELECT 1 FROM opportunities o WHERE o.id=p.opportunity_id)
         GROUP BY p.opportunity_id,p.user_id
       ) history WHERE NOT EXISTS (SELECT 1 FROM billing_usage u WHERE u.service='publication' AND u.opportunity_id=history.id)`,
    )
    for (const opportunity of legacy) {
      run(`INSERT OR IGNORE INTO billing_usage (id, user_id, service, opportunity_id, period, funding, unit_price, amount_charged, created_at)
        VALUES (?, ?, 'publication', ?, ?, 'legacy', 0, 0, ?)`,
      newId('bu'), opportunity.author_id, opportunity.id, billingPeriod(opportunity.created_at), opportunity.created_at)
    }
  }, 'IMMEDIATE')
}
