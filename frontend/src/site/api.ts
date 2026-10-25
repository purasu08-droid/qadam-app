// Клиент API бэкенда (backend/). В dev Vite проксирует /api на http://localhost:3001.
import type { Kind, Opportunity, Person, ProjectStatus } from './data'
import { formatDate, getLocale, t } from './i18n'

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message)
    this.name = 'ApiError'
  }
}

export type RequestOptions = { signal?: AbortSignal; timeoutMs?: number; idempotencyKey?: string }

let sessionVersion = 0
const unauthorizedListeners = new Set<() => void>()

// A response from the previous account must never expire the current account.
export function advanceApiSession() {
  sessionVersion += 1
}

export function subscribeUnauthorized(listener: () => void) {
  unauthorizedListeners.add(listener)
  return () => { unauthorizedListeners.delete(listener) }
}

export const isAbortError = (error: unknown) => error instanceof Error && error.name === 'AbortError'

async function request<T>(method: string, path: string, body?: unknown, options: RequestOptions = {}): Promise<T> {
  const version = sessionVersion
  const controller = new AbortController()
  const onAbort = () => controller.abort()
  options.signal?.addEventListener('abort', onAbort, { once: true })
  if (options.signal?.aborted) controller.abort()
  let timedOut = false
  const timer = setTimeout(() => {
    timedOut = true
    controller.abort()
  }, options.timeoutMs ?? 15_000)
  try {
    const res = await fetch(`/api${path}`, {
      method,
      credentials: 'same-origin',
      headers: body === undefined && !options.idempotencyKey ? undefined : { ...(body === undefined ? {} : { 'content-type': 'application/json' }), ...(options.idempotencyKey ? { 'idempotency-key': options.idempotencyKey } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
    })
    if (res.status === 401 && !path.startsWith('/auth/') && version === sessionVersion) {
      for (const listener of unauthorizedListeners) listener()
    }
    if (res.status === 204) return undefined as T
    let data: unknown
    try {
      data = await res.json()
    } catch (error) {
      if (controller.signal.aborted) throw error
      if (res.ok) throw new ApiError(502, 'Не удалось прочитать ответ сервера. Попробуйте ещё раз.')
    }
    if (!res.ok) {
      const message = data && typeof data === 'object' && 'error' in data && typeof data.error === 'string' ? data.error : null
      throw new ApiError(res.status, message ?? (res.status === 401 ? 'Сессия завершилась. Войдите снова.' : res.status >= 500 ? 'Сервер временно недоступен. Попробуйте позже.' : 'Не удалось выполнить запрос.'))
    }
    return data as T
  } catch (error) {
    if (options.signal?.aborted) throw new DOMException('Запрос отменён', 'AbortError')
    if (timedOut) throw new ApiError(0, 'Сервер не ответил вовремя. Попробуйте ещё раз.')
    if (error instanceof ApiError) throw error
    throw new ApiError(0, 'Нет связи с сервером. Проверьте подключение и попробуйте ещё раз.')
  } finally {
    clearTimeout(timer)
    options.signal?.removeEventListener('abort', onAbort)
  }
}

export const api = {
  get: <T>(path: string, options?: RequestOptions) => request<T>('GET', path, undefined, options),
  post: <T>(path: string, body?: unknown, options?: RequestOptions) => request<T>('POST', path, body ?? {}, options),
  put: <T>(path: string, options?: RequestOptions) => request<T>('PUT', path, undefined, options),
  patch: <T>(path: string, body: unknown, options?: RequestOptions) => request<T>('PATCH', path, body, options),
  del: <T>(path: string, options?: RequestOptions) => request<T>('DELETE', path, undefined, options),
}

export type Profile = Person & {
  email?: string
  bio: string
  about: string
  cover?: string
  portfolio?: string
  skills: string[]
  interests: string[]
}

export type MeState = {
  saved: string[]
  attending: string[]
  applications: { opportunityId: string; role: string; createdAt: string; conversationId?: string | null }[]
  unread: number
}

export type ConversationSummary = {
  id: string
  type: 'direct' | 'group'
  title: string
  person?: Person
  kind?: Kind
  letter?: string
  opportunity?: Opportunity
  lastMessage?: { text: string; createdAt: string; mine: boolean }
  unread: number
}

export type ChatMessage = {
  id: string
  mine: boolean
  sender?: Person
  text: string
  file?: { name: string; size: string }
  createdAt: string
}

export type ProjectItem = {
  id: string
  title: string
  text: string
  cover?: string
  status: ProjectStatus
  note: string
  mine: boolean
  opportunityId?: string
  team: Person[]
  conversationId?: string
}

export type NewPublication = {
  campusId?: string
  kind: Kind
  title: string
  description: string
  direction: string
  stage: string
  city: string
  online: boolean
  roles: string[]
  size: string
  deadline: string
  cover?: string
  date?: string
  time?: string
  place?: string
  coords?: [number, number]
}

export const timeOf = (iso: string) => new Date(iso).toLocaleTimeString(getLocale(), { hour: '2-digit', minute: '2-digit', hour12: false })

// «14:32», «Вчера», «Пн» или «12.10» — как в списке диалогов макета.
export function shortWhen(iso: string) {
  const d = new Date(iso)
  const today = new Date()
  const days = Math.round((new Date(today.toDateString()).getTime() - new Date(d.toDateString()).getTime()) / 86_400_000)
  if (days <= 0) return timeOf(iso)
  if (days === 1) return t('Вчера')
  if (days < 7) return formatDate(d, { weekday: 'short' }).replace(/^./, (c) => c.toUpperCase())
  return formatDate(d, { day: '2-digit', month: '2-digit' })
}

export function dayLabel(iso: string) {
  const date = new Date(iso)
  const today = new Date()
  const days = Math.round((new Date(today.toDateString()).getTime() - new Date(date.toDateString()).getTime()) / 86_400_000)
  if (days <= 0) return t('Сегодня')
  return days === 1 ? t('Вчера') : formatDate(date, { day: 'numeric', month: 'long' })
}
