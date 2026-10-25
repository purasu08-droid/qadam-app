export function isPublicationReplay(previous: PublicationAttempt | null, payload: unknown) {
  return previous?.payload === JSON.stringify(payload)
}

export type PublicationAttempt = { payload: string; key: string }

export function newPublicationKey() {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  return Array.from(crypto.getRandomValues(new Uint8Array(16)), (byte) => byte.toString(16).padStart(2, '0')).join('')
}

// Retrying an uncertain request must reuse its key; editing it starts a new operation.
export function publicationAttempt(previous: PublicationAttempt | null, payload: unknown, makeKey: () => string): PublicationAttempt {
  const serialized = JSON.stringify(payload)
  return previous?.payload === serialized ? previous : { payload: serialized, key: makeKey() }
}

export function readPublicationAttempt(storageKey: string): PublicationAttempt | null {
  try {
    const raw = localStorage.getItem(storageKey)
    const value = raw ? JSON.parse(raw) : null
    return value && typeof value.payload === 'string' && typeof value.key === 'string' && /^[A-Za-z0-9_-]{16,128}$/.test(value.key) ? value : null
  } catch { return null }
}
