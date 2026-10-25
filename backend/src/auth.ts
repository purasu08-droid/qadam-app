import { createHash, randomBytes, scrypt, scryptSync, timingSafeEqual } from 'node:crypto'
import type { NextFunction, Request, Response } from 'express'
import { config } from './config.js'
import { get, now, run } from './db.js'
import { campusDemoEnabled, campusDemoIdentity } from './campus-demo-policy.js'

export const SESSION_COOKIE = 'qadam_session'
const SESSION_DAYS = 30

export function hashPassword(password: string) {
  const salt = randomBytes(16)
  const hash = scryptSync(password, salt, 64)
  return `scrypt$${salt.toString('base64')}$${hash.toString('base64')}`
}

export function verifyPassword(password: string, stored: string) {
  const [algo, salt, hash] = stored.split('$')
  if (algo !== 'scrypt' || !salt || !hash) return false
  const expected = Buffer.from(hash, 'base64')
  const actual = scryptSync(password, Buffer.from(salt, 'base64'), expected.length)
  return timingSafeEqual(actual, expected)
}

const derivePassword = (password: string, salt: Buffer, length: number) =>
  new Promise<Buffer>((resolve, reject) => {
    scrypt(password, salt, length, (error, hash) => error ? reject(error) : resolve(hash))
  })

// HTTP handlers use the worker pool; the synchronous helper remains for the explicit seed command.
export async function hashPasswordAsync(password: string) {
  const salt = randomBytes(16)
  const hash = await derivePassword(password, salt, 64)
  return `scrypt$${salt.toString('base64')}$${hash.toString('base64')}`
}

export async function verifyPasswordAsync(password: string, stored: string) {
  const [algo, salt, hash] = stored.split('$')
  if (algo !== 'scrypt' || !salt || !hash) return false
  const expected = Buffer.from(hash, 'base64')
  if (expected.length !== 64) return false
  const actual = await derivePassword(password, Buffer.from(salt, 'base64'), expected.length)
  return timingSafeEqual(actual, expected)
}

const sha256 = (s: string) => createHash('sha256').update(s).digest('hex')

// В БД хранится только хэш токена: утечка базы не даёт войти чужой сессией.
export function startSession(res: Response, userId: string) {
  const token = randomBytes(32).toString('base64url')
  const expires = new Date(Date.now() + SESSION_DAYS * 86_400_000)
  run('INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)', sha256(token), userId, expires.toISOString())
  res.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: config.cookieSecure,
    expires,
    path: '/',
  })
}

export function endSession(req: Request, res: Response) {
  const token = req.cookies?.[SESSION_COOKIE]
  if (token) run('DELETE FROM sessions WHERE token_hash = ?', sha256(token))
  res.clearCookie(SESSION_COOKIE, { path: '/' })
}

declare module 'express-serve-static-core' {
  interface Request {
    userId?: string
  }
}

// Подставляет req.userId, если cookie сессии валидна. Не блокирует гостей.
export function loadSession(req: Request, res: Response, next: NextFunction) {
  const token = req.cookies?.[SESSION_COOKIE]
  if (token) {
    const s = get<{ user_id: string }>('SELECT user_id FROM sessions WHERE token_hash = ? AND expires_at > ?', sha256(token), now())
    if (s && campusDemoIdentity(s.user_id) && !campusDemoEnabled()) {
      run('DELETE FROM sessions WHERE token_hash = ?', sha256(token))
      res.clearCookie(SESSION_COOKIE, { path: '/' })
    } else if (s) req.userId = s.user_id
  }
  next()
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.userId) return void res.status(401).json({ error: 'Нужно войти в аккаунт' })
  next()
}

export function me(req: Request) {
  if (!req.userId) throw new Error('requireAuth missing')
  return req.userId
}

// В типах Express 5 параметры пути — string | string[]; у нас всегда одна строка.
export const param = (req: Request, key = 'id') => String(req.params[key])
