import assert from 'node:assert/strict'
import test from 'node:test'
import { advanceApiSession, api, ApiError, isAbortError, subscribeUnauthorized } from '../src/site/api'

test('a failed request reports a user-facing connection error', async () => {
  const originalFetch = globalThis.fetch
  globalThis.fetch = async () => { throw new TypeError('offline') }
  try {
    await assert.rejects(api.get('/opportunities'), (error: unknown) => error instanceof ApiError && error.status === 0 && !error.message.includes('npm'))
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('timeouts fail while an explicit abort stays distinguishable', async () => {
  const originalFetch = globalThis.fetch
  globalThis.fetch = async (_input, init) => new Promise<Response>((_resolve, reject) => {
    const fail = () => reject(new DOMException('Aborted', 'AbortError'))
    if (init?.signal?.aborted) fail()
    else init?.signal?.addEventListener('abort', fail, { once: true })
  })
  try {
    await assert.rejects(api.get('/opportunities', { timeoutMs: 5 }), (error: unknown) => error instanceof ApiError && error.message.includes('вовремя'))
    const controller = new AbortController()
    const request = api.get('/opportunities', { signal: controller.signal })
    controller.abort()
    await assert.rejects(request, isAbortError)
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('a protected 401 expires the session, a rejected login does not', async () => {
  const originalFetch = globalThis.fetch
  let expirations = 0
  const unsubscribe = subscribeUnauthorized(() => { expirations += 1 })
  globalThis.fetch = async () => new Response(JSON.stringify({ error: 'Нужен вход' }), { status: 401 })
  try {
    await assert.rejects(api.post('/auth/login', { email: 'a@b.kz', password: 'wrong' }))
    assert.equal(expirations, 0)
    await assert.rejects(api.get('/users/me/state'))
    assert.equal(expirations, 1)
  } finally {
    unsubscribe()
    globalThis.fetch = originalFetch
  }
})

test('a late 401 from an earlier account cannot expire the new session', async () => {
  const originalFetch = globalThis.fetch
  let finish!: (response: Response) => void
  globalThis.fetch = async () => new Promise<Response>((resolve) => { finish = resolve })
  let expirations = 0
  const unsubscribe = subscribeUnauthorized(() => { expirations += 1 })
  try {
    const request = api.get('/users/me/state')
    advanceApiSession()
    finish(new Response(JSON.stringify({ error: 'Нужен вход' }), { status: 401 }))
    await assert.rejects(request)
    assert.equal(expirations, 0)
  } finally {
    unsubscribe()
    globalThis.fetch = originalFetch
  }
})

test('successful malformed JSON is rejected instead of pretending to be typed data', async () => {
  const originalFetch = globalThis.fetch
  globalThis.fetch = async () => new Response('<html>Gateway error</html>', { status: 200 })
  try {
    await assert.rejects(api.get('/opportunities'), (error: unknown) => error instanceof ApiError && error.status === 502)
  } finally {
    globalThis.fetch = originalFetch
  }
})
