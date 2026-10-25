import { useSyncExternalStore } from 'react'
import { localeFor, normalizeLanguage, translateMessage, type Language, type MessageParams } from './i18n-core'
import { common } from './locales/common'
import { forms } from './locales/forms'
import { community } from './locales/community'
import { errors } from './locales/errors'
import { formatLocalizedDate } from './i18n-date'

export { localeFor, normalizeLanguage } from './i18n-core'
export type { Language, TranslationCatalog, MessageParams } from './i18n-core'
export const translations = { ...community, ...forms, ...common, ...errors }
const STORAGE_KEY = 'qadam.site.language'
const listeners = new Set<() => void>()
let initialized = false

export function getLanguage(): Language {
  return normalizeLanguage(typeof document === 'undefined' ? null : document.documentElement.lang)
}

export function getLocale() { return localeFor(getLanguage()) }

export function formatDate(date: Date, options: Intl.DateTimeFormatOptions) {
  return formatLocalizedDate(date, getLanguage(), options)
}

// Call only for interface messages and known system labels, never user content.
export function t(source: string, params?: MessageParams) {
  return translateMessage(translations, getLanguage(), source, params)
}

function applyLanguage(language: Language) {
  document.documentElement.lang = language
  listeners.forEach((listener) => listener())
}

function syncLanguage(event: StorageEvent) {
  if (event.key !== STORAGE_KEY && event.key !== null) return
  try {
    if (event.storageArea === localStorage) applyLanguage(normalizeLanguage(localStorage.getItem(STORAGE_KEY)))
  } catch { /* Keep the current language when storage is unavailable. */ }
}

function subscribe(listener: () => void) {
  if (listeners.size === 0) window.addEventListener('storage', syncLanguage)
  listeners.add(listener)
  if (!initialized) {
    initialized = true
    try { applyLanguage(normalizeLanguage(localStorage.getItem(STORAGE_KEY))) } catch { /* Keep the bootstrap language. */ }
  }
  return () => {
    listeners.delete(listener)
    if (listeners.size === 0) window.removeEventListener('storage', syncLanguage)
  }
}

export function setLanguage(language: Language) {
  initialized = true
  applyLanguage(language)
  try { localStorage.setItem(STORAGE_KEY, language) } catch { /* Choice remains active for this page. */ }
}

export function useI18n() {
  const language = useSyncExternalStore(subscribe, getLanguage, () => 'ru' as const)
  return { language, locale: localeFor(language), setLanguage, t }
}
