import { Router } from 'express'
import { z } from 'zod'
import { endSession, hashPasswordAsync, startSession, verifyPasswordAsync } from '../auth.js'
import { config } from '../config.js'
import { get, newId, run } from '../db.js'
import { profileOf, type UserRow } from '../models.js'
import { DEMO_EMAIL, DEMO_PASSWORD, USERS } from '../seed-data.js'
import { authRateLimit } from '../rate-limit.js'
import { isRetiredDemoUser } from '../legacy-data.js'

export const authRouter = Router()
authRouter.use(['/register', '/login', '/demo'], authRateLimit())
const demoEmails = new Set(USERS.map((user) => user.email.toLowerCase()))
authRouter.get('/options', (_req, res) => {
  res.setHeader('Cache-Control', 'no-store')
  res.json({ demoLogin: config.allowDemoLogin && Boolean(get('SELECT 1 FROM users WHERE email=?', DEMO_EMAIL)) })
})

const Register = z.object({
  name: z.string().trim().min(2, 'Имя — минимум 2 символа').max(80),
  email: z.string().trim().email('Некорректный email').max(200),
  password: z.string().min(6, 'Пароль — минимум 6 символов').max(200),
  city: z.string().trim().max(60).optional(),
})

const Login = z.object({
  email: z.string().trim().email('Некорректный email').max(200),
  password: z.string().min(1, 'Введи пароль').max(200),
})

authRouter.post('/register', async (req, res) => {
  const body = Register.parse(req.body)
  const passwordHash = await hashPasswordAsync(body.password)
  // Check after the await so concurrent registrations cannot pass the uniqueness check together.
  if (get('SELECT 1 FROM users WHERE email = ?', body.email))
    return void res.status(409).json({ error: 'Аккаунт с таким email уже есть' })
  const id = newId('u')
  run(
    'INSERT INTO users (id, email, password_hash, name, city) VALUES (?, ?, ?, ?, ?)',
    id, body.email, passwordHash, body.name, body.city ?? 'Алматы',
  )
  startSession(res, id)
  res.status(201).json({ user: profileOf(get<UserRow>('SELECT * FROM users WHERE id = ?', id)!, true) })
})

authRouter.post('/login', async (req, res) => {
  const body = Login.parse(req.body)
  const user = get<UserRow>('SELECT * FROM users WHERE email = ?', body.email)
  if (!user || isRetiredDemoUser(user.id) || !await verifyPasswordAsync(body.password, user.password_hash))
    return void res.status(401).json({ error: 'Неверный email или пароль' })
  // Existing databases may contain the public seed credentials even when automatic seeding is off.
  // A changed password on the same email remains usable; only the verified public credential is blocked.
  if (!config.allowDemoLogin && demoEmails.has(user.email.toLowerCase()) && body.password === DEMO_PASSWORD)
    return void res.status(401).json({ error: 'Неверный email или пароль' })
  startSession(res, user.id)
  res.json({ user: profileOf(user, true) })
})

// Быстрый вход в демо-аккаунт (кнопка «Продолжить с Apple» на прототипе).
authRouter.post('/demo', (_req, res) => {
  if (!config.allowDemoLogin) return void res.status(403).json({ error: 'Демо-вход выключен' })
  const user = get<UserRow>('SELECT * FROM users WHERE email = ?', DEMO_EMAIL)
  if (!user) return void res.status(503).json({ error: 'Обычный демо-аккаунт недоступен' })
  startSession(res, user.id)
  res.json({ user: profileOf(user, true) })
})

authRouter.post('/logout', (req, res) => {
  endSession(req, res)
  res.status(204).end()
})

authRouter.get('/me', (req, res) => {
  const user = req.userId ? get<UserRow>('SELECT * FROM users WHERE id = ?', req.userId) : undefined
  res.json({ user: user ? profileOf(user, true) : null })
})
