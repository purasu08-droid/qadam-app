import { useSyncExternalStore } from 'react'

export type Theme = 'dark' | 'light'
const STORAGE_KEY = 'qadam.site.theme'
const listeners = new Set<() => void>()
let initialized = false
let listening = false
const normalizeTheme = (value: string | null): Theme => value === 'light' ? 'light' : 'dark'

function getTheme(): Theme {
  return normalizeTheme(document.documentElement.getAttribute('data-theme'))
}

function applyTheme(theme: Theme) {
  document.documentElement.setAttribute('data-theme', theme)
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'light' ? '#f6f7f2' : '#0a0912')
  listeners.forEach((listener) => listener())
}

function syncTheme(event: StorageEvent) {
  try { if (event.storageArea !== localStorage) return } catch { return }
  if (event.key !== STORAGE_KEY && event.key !== null) return
  // A queued event may describe an older choice than the one currently stored.
  try { applyTheme(normalizeTheme(localStorage.getItem(STORAGE_KEY))) } catch { /* Keep the current theme. */ }
}

function subscribe(listener: () => void) {
  // The archive has no theme subscribers, but preferences can still change in
  // another tab. Keep this singleton listener for the lifetime of the page.
  if (!listening) { window.addEventListener('storage', syncTheme); listening = true }
  listeners.add(listener)
  if (!initialized) {
    initialized = true
    // Reconcile changes made in another tab while the application was loading.
    try { applyTheme(normalizeTheme(localStorage.getItem(STORAGE_KEY))) } catch { /* Keep the bootstrap theme. */ }
  }
  return () => {
    listeners.delete(listener)
  }
}

export function setTheme(theme: Theme) {
  initialized = true
  applyTheme(theme)
  // Private browsing or a full storage must not prevent switching the interface.
  try { localStorage.setItem(STORAGE_KEY, theme) } catch { /* Keep the choice for this page. */ }
}

export function useTheme() {
  const theme = useSyncExternalStore(subscribe, getTheme, () => 'dark' as const)
  return { theme, setTheme }
}
