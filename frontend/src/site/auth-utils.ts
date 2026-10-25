const RETURN_ORIGIN = 'https://qadam.invalid'
const SIGN_IN_PATH = /^\/(?:account\/)?signin\/*$/i
const ACCOUNT_SIGN_IN_PATH = /^\/account\/signin\/*$/i

function internalPath(value: unknown): string | null {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//') || /[\\\u0000-\u001f\u007f]/.test(value)) return null
  try {
    const url = new URL(value, RETURN_ORIGIN)
    if (url.origin !== RETURN_ORIGIN || SIGN_IN_PATH.test(decodeURIComponent(url.pathname))) return null
    return `${url.pathname}${url.search}${url.hash}`
  } catch {
    return null
  }
}

/** Accept only in-app return paths, including their query and fragment. */
export function safeReturnPath(value: unknown, fallback = '/') {
  return internalPath(value) ?? internalPath(fallback) ?? '/'
}

/** Server sign-in retains a real API account destination on small screens. */
export function siteAuthReturnPath(value: unknown, pathname: string) {
  let fallback = '/'
  try {
    const url = new URL(pathname, RETURN_ORIGIN)
    if (url.origin === RETURN_ORIGIN && ACCOUNT_SIGN_IN_PATH.test(decodeURIComponent(url.pathname))) fallback = '/account/profile'
  } catch { /* An invalid sign-in location uses the normal home fallback. */ }
  return safeReturnPath(value, fallback)
}

