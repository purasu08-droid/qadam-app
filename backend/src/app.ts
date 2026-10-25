import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import cookieParser from 'cookie-parser'
import express, { type ErrorRequestHandler } from 'express'
import { ZodError } from 'zod'
import { loadSession } from './auth.js'
import { config } from './config.js'
import { PublicationRequestError } from './publication-requests.js'
import { authRouter } from './routes/auth.js'
import { conversationsRouter } from './routes/conversations.js'
import { opportunitiesRouter } from './routes/opportunities.js'
import { projectsRouter, usersRouter } from './routes/users.js'

export function createApp() {
  const app = express()
  app.disable('x-powered-by')
  app.use(express.json({ limit: '100kb' }))
  app.use(cookieParser())
  app.use(loadSession)

  app.get('/api/health', (_req, res) => res.json({ ok: true }))
  app.use('/api/auth', authRouter)
  app.use('/api/opportunities', opportunitiesRouter)
  app.use('/api/conversations', conversationsRouter)
  app.use('/api/users', usersRouter)
  app.use('/api/projects', projectsRouter)
  app.use('/api', (_req, res) => res.status(404).json({ error: 'Нет такого метода API' }))

  // Продакшен: тот же сервер раздаёт собранный фронтенд (npm run build в корне).
  if (existsSync(config.frontendDist)) {
    app.use(express.static(config.frontendDist, { index: false }))
    app.get(/^(?!\/api).*/, (_req, res) => res.sendFile(resolve(config.frontendDist, 'index.html')))
  }

  const onError: ErrorRequestHandler = (err, _req, res, _next) => {
    if (err instanceof PublicationRequestError) return void res.status(err.status).json({ error: err.message, code: err.code })
    if (err instanceof ZodError) {
      const first = err.issues[0]
      return void res.status(400).json({ error: first?.message ?? 'Некорректные данные', issues: err.issues })
    }
    if (err?.type === 'entity.parse.failed') return void res.status(400).json({ error: 'Некорректный JSON' })
    console.error(err)
    res.status(500).json({ error: 'Ошибка сервера' })
  }
  app.use(onError)

  return app
}
