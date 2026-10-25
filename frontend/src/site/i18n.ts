import { useSyncExternalStore } from 'react'
import { localeFor, normalizeLanguage, translateMessage, type Language, type MessageParams } from './i18n-core'
import { common } from './locales/common'
import { campus } from './locales/campus'
import { forms } from './locales/forms'
import { community } from './locales/community'
import { errors } from './locales/errors'
import { formatLocalizedDate } from './i18n-date'

export { localeFor, normalizeLanguage } from './i18n-core'
export type { Language, TranslationCatalog, MessageParams } from './i18n-core'
export const translations = { ...community, ...forms, ...campus, ...common, ...errors }
const STORAGE_KEY = 'qadam.site.language'
const listeners = new Set<() => void>()
let initialized = false
let listening = false

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
  // Original mobile screens do not subscribe to this store. Continue receiving
  // other tabs' choices while those screens replace the server interface.
  if (!listening) { window.addEventListener('storage', syncLanguage); listening = true }
  listeners.add(listener)
  if (!initialized) {
    initialized = true
    try { applyLanguage(normalizeLanguage(localStorage.getItem(STORAGE_KEY))) } catch { /* Keep the bootstrap language. */ }
  }
  return () => {
    listeners.delete(listener)
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
