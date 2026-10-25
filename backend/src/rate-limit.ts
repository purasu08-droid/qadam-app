import type { RequestHandler } from 'express'

const WINDOW_MS = 15 * 60_000
const MAX_BUCKETS = 10_000
type Bucket = { attempts: number; expiresAt: number }

// Per-process protection. A shared limiter is required if the API runs on multiple instances.
export function authRateLimit(): RequestHandler {
  const buckets = new Map<string, Bucket>()
  let cleanupAt = 0
  return (req, res, next) => {
    const timestamp = Date.now()
    if (timestamp >= cleanupAt) {
      for (const [key, bucket] of buckets) if (bucket.expiresAt <= timestamp) buckets.delete(key)
      cleanupAt = timestamp + 60_000
    }
    const ip = req.ip ?? req.socket.remoteAddress ?? 'unknown'
    const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase().slice(0, 200) : ''
    const limits = [{ key: `ip:${ip}`, max: 30 }]
    if (email) limits.push({ key: `email:${ip}:${email}`, max: 10 })
    let retryAfter = 0
    for (const { key, max } of limits) {
      let bucket = buckets.get(key)
      if (!bucket || bucket.expiresAt <= timestamp) {
        if (!bucket && buckets.size >= MAX_BUCKETS) {
          retryAfter = Math.max(retryAfter, 60)
          continue
        }
        bucket = { attempts: 0, expiresAt: timestamp + WINDOW_MS }
        buckets.set(key, bucket)
      }
      if (bucket.attempts >= max) retryAfter = Math.max(retryAfter, Math.ceil((bucket.expiresAt - timestamp) / 1000))
      else bucket.attempts++
    }
    if (retryAfter) {
      res.setHeader('Retry-After', retryAfter)
      return void res.status(429).json({ error: 'Слишком много попыток входа или регистрации. Попробуй позже.', retryAfter })
    }
    next()
  }
}
