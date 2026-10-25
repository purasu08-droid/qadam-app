import { formatDate, t } from './i18n'
import type { BillingService } from './billing'
import type { CampusStatus } from './campus-types'

export const CAMPUS_STATUS: Record<CampusStatus, string> = { pending: 'На проверке', verified: 'Подтверждён', rejected: 'Отклонён', revoked: 'Отозван' }
export const CAMPUS_SERVICE: Record<BillingService, string> = { publication: 'Публикации', promotion3: 'Продвижение на 3 дня', promotion7: 'Продвижение на 7 дней' }

export function campusDate(value?: string | null, withTime = false) {
  if (!value) return t('Не указан')
  const date = new Date(value.length === 10 ? `${value}T12:00:00Z` : value)
  return Number.isFinite(date.getTime()) ? formatDate(date, { day: 'numeric', month: 'short', year: 'numeric', ...(withTime ? { hour: '2-digit', minute: '2-digit' } : {}) }) : t('Не указан')
}

export function futureExpiry(value: string, now = Date.now()) {
  const time = value ? new Date(value).getTime() : NaN
  if (!Number.isFinite(time) || time <= now) throw new Error('Укажи срок действия в будущем.')
  return new Date(time).toISOString()
}

export type GrantBody = { userId: string; service: BillingService; quota: number; expiresAt: string }
export type GrantAttempt = { key: string; payload: string; label: string }

export function parseGrantAttempt(raw: string | null): GrantAttempt | null {
  try {
    const attempt = raw ? JSON.parse(raw) : null
    if (!attempt || typeof attempt.key !== 'string' || !/^[A-Za-z0-9_-]{16,128}$/.test(attempt.key) || typeof attempt.payload !== 'string' || typeof attempt.label !== 'string') return null
    const body = JSON.parse(attempt.payload)
    if (typeof body.userId !== 'string' || !body.userId || !Object.hasOwn(CAMPUS_SERVICE, body.service) || !Number.isSafeInteger(body.quota) || body.quota < 1 || body.quota > 100_000 || typeof body.expiresAt !== 'string' || !Number.isFinite(Date.parse(body.expiresAt))) return null
    return { key: attempt.key, payload: attempt.payload, label: attempt.label }
  } catch { return null }
}

export function grantAttempt(body: GrantBody, previous: GrantAttempt | null, makeKey: () => string, label: string): GrantAttempt {
  const payload = JSON.stringify(body)
  if (previous) {
    if (previous.payload !== payload) throw new Error('Сначала проверь результат предыдущей отправки пакета.')
    return previous
  }
  return { key: makeKey(), payload, label }
}

export function uncertainCampusWrite(status: number) { return status === 0 || status >= 500 }

export function campusActivity(action: string) {
  const labels: Record<string, string> = {
    campus_created: 'Кампус подключён', admin_granted: 'Назначен администратор', admin_revoked: 'Доступ администратора отозван',
    enrollment_requested: 'Получена заявка студента', student_verified: 'Студент подтверждён', student_rejected: 'Заявка отклонена', student_revoked: 'Статус студента отозван',
    publication_created: 'Опубликована возможность', publication_hidden: 'Публикация скрыта', publication_restored: 'Публикация восстановлена', grant_created: 'Выдан пакет услуг', grant_revoked: 'Пакет услуг отозван',
  }
  return labels[action] ?? 'Обновление кампуса'
}
