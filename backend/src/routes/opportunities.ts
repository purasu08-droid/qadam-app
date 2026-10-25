import { Router } from 'express'
import { z } from 'zod'
import { me, param, requireAuth } from '../auth.js'
import { all, get, newId, now, run, tx } from '../db.js'
import { opportunityOf, type OpportunityRow } from '../models.js'
import { CITY_COORDS } from '../seed-data.js'
import { ensureDirect, postMessage } from './conversations.js'
import { createPublication, publicationPayloadHash } from '../publication-requests.js'
import { canReadOpportunity, publicOpportunityVisibility } from '../legacy-data.js'

export const opportunitiesRouter = Router()

const KIND = z.enum(['meetup', 'job', 'idea', 'event'])

const Query = z.object({
  city: z.string().optional(),
  kind: KIND.optional(),
  q: z.string().optional(),
  online: z.enum(['1', 'true']).optional(),
  author: z.string().optional(),
})

opportunitiesRouter.get('/', (req, res) => {
  const f = Query.parse(req.query)
  const where: string[] = [publicOpportunityVisibility()]
  const params: string[] = []
  if (f.city) where.push('city = ?'), params.push(f.city)
  if (f.kind) where.push('kind = ?'), params.push(f.kind)
  if (f.online) where.push('online = 1')
  if (f.author) where.push('author_id = ?'), params.push(f.author === 'me' ? (req.userId ?? '-') : f.author)
  if (f.q?.trim()) {
    where.push("(title || ' ' || meta || ' ' || card || ' ' || subtitle) LIKE ?")
    params.push(`%${f.q.trim()}%`)
  }
  const rows = all<OpportunityRow>(
    `SELECT * FROM opportunities ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY created_at DESC`,
    ...params,
  )
  res.json({ items: rows.map((o) => opportunityOf(o, req.userId)) })
})

opportunitiesRouter.get('/:id', (req, res) => {
  const row = get<OpportunityRow>('SELECT * FROM opportunities WHERE id = ?', param(req))
  if (!row || !canReadOpportunity(row.id, req.userId)) return void res.status(404).json({ error: 'Публикация не найдена' })
  res.json({ item: opportunityOf(row, req.userId) })
})

const Create = z.object({
  kind: KIND,
  title: z.string().trim().min(2, 'Название — минимум 2 символа').max(120),
  description: z.string().trim().min(10, 'Описание — минимум 10 символов').max(4000),
  direction: z.string().trim().max(60).default(''),
  stage: z.string().trim().max(60).default(''),
  city: z.string().trim().min(2).max(60).refine((city) => Object.hasOwn(CITY_COORDS, city), 'Выбери поддерживаемый город'),
  online: z.boolean().default(false),
  roles: z.array(z.string().trim().min(1).max(60)).min(1, 'Добавь хотя бы одну роль').max(10),
  size: z.string().trim().max(40).default(''),
  deadline: z.string().trim().max(40).default(''),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Дата — в формате ГГГГ-ММ-ДД').refine((value) => {
    const timestamp = Date.parse(`${value}T00:00:00.000Z`)
    return Number.isFinite(timestamp) && new Date(timestamp).toISOString().slice(0, 10) === value
  }, 'Укажи существующую календарную дату').optional(),
  time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d–([01]\d|2[0-3]):[0-5]\d$/, 'Время — в формате ЧЧ:ММ–ЧЧ:ММ')
    .refine((value) => value.slice(0, 5) < value.slice(6), 'Время окончания должно быть позже начала').optional(),
  place: z.string().trim().min(2).max(300).optional(),
  coords: z.tuple([z.number().finite().min(-90).max(90), z.number().finite().min(-180).max(180)]).optional(),
  cover: z.string().startsWith('/img/').max(200).optional(),
}).superRefine((value, ctx) => {
  if (value.kind !== 'event') return
  for (const field of ['date', 'time', 'place', 'coords'] as const) {
    if (value[field] === undefined) ctx.addIssue({ code: z.ZodIssueCode.custom, path: [field], message: 'Укажи дату, время, место и точку события на карте' })
  }
})

opportunitiesRouter.post('/', requireAuth, (req, res) => {
  const d = Create.parse(req.body)
  const requestKey = z.string().trim().min(1).max(128).regex(/^[\x21-\x7e]+$/, 'Некорректный ключ повторного запроса').optional().parse(req.get('Idempotency-Key'))
  const userId = me(req)
  const base = CITY_COORDS[d.city]
  const jitter = () => (Math.random() - 0.5) * 0.03
  const id = newId('o')
  const event = d.kind === 'event'
  const coords = d.coords ?? [base[0] + jitter(), base[1] + jitter()]
  const roles = d.roles.map((r) => ({ title: r, text: d.direction, tags: d.stage ? [d.stage] : [], icon: /разраб|dev|программ/i.test(r) ? 'code' : 'pen' }))
  const author = get<{ name: string }>('SELECT name FROM users WHERE id = ?', userId)!

  const resultId = createPublication(userId, id, () => {
    run(
      `INSERT INTO opportunities (id, kind, title, subtitle, meta, city, lat, lng, card, about, cta, image, hero, topic,
         date, time, place, organizer, stage, online, roles, conditions, author_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Подробнее', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      id, d.kind, d.title, d.description.split('.')[0], event ? `${d.date} · ${d.city}` : d.roles.slice(0, 2).join(' · '),
      d.city, coords[0], coords[1], d.description, d.description,
      d.cover ?? null, d.cover ?? null, d.direction || null,
      event ? d.date! : null, event ? d.time! : null, event ? d.place! : null, event ? author.name : null,
      d.stage || null, d.online ? 1 : 0, JSON.stringify(roles),
      [d.size && `Команда: ${d.size}.`, event ? `Дата: ${d.date}.` : d.deadline && `Набор до: ${d.deadline}.`, 'Условия обсуждаются с автором.'].filter(Boolean).join(' '),
      userId,
    )
    // каждая публикация появляется в «Моих проектах» автора
    const projectId = newId('p')
    run(
      'INSERT INTO projects (id, title, text, cover, status, note, owner_id, opportunity_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      projectId, d.title, d.description.split('.')[0], d.cover ?? null, 'team', `Ищем: ${d.roles.join(', ')}`, userId, id,
    )
    run('INSERT INTO project_members (project_id, user_id) VALUES (?, ?)', projectId, userId)
  }, requestKey ? { key: requestKey, payloadHash: publicationPayloadHash(d), legacyPayloadHash: publicationPayloadHash({ ...d, ...(typeof req.body.campusId === 'string' && req.body.campusId.trim() ? { campusId: req.body.campusId.trim() } : {}) }) } : undefined)

  res.status(201).json({ item: opportunityOf(get<OpportunityRow>('SELECT * FROM opportunities WHERE id = ?', resultId)!, userId) })
})

opportunitiesRouter.delete('/:id', requireAuth, (req, res) => {
  const row = get<OpportunityRow>('SELECT * FROM opportunities WHERE id = ?', param(req))
  if (!row || !canReadOpportunity(row.id, req.userId)) return void res.status(404).json({ error: 'Публикация не найдена' })
  if (row.author_id !== me(req)) return void res.status(403).json({ error: 'Удалять можно только свои публикации' })
  run('DELETE FROM opportunities WHERE id = ?', row.id)
  res.status(204).end()
})

const Apply = z.object({
  role: z.string().trim().min(1).max(80),
  message: z.string().trim().min(1, 'Напиши сообщение автору').max(2000),
  portfolio: z.string().trim().max(300).default(''),
})

// Заявка: сохраняется и сразу уходит автору в личный чат.
opportunitiesRouter.post('/:id/apply', requireAuth, (req, res) => {
  const body = Apply.parse(req.body)
  const userId = me(req)
  const row = get<OpportunityRow>('SELECT * FROM opportunities WHERE id = ?', param(req))
  if (!row || !canReadOpportunity(row.id, req.userId)) return void res.status(404).json({ error: 'Публикация не найдена' })
  if (row.author_id === userId) return void res.status(400).json({ error: 'Нельзя откликнуться на свою публикацию' })

  const conversationId = tx(() => {
    run(
      `INSERT INTO applications (id, opportunity_id, user_id, role, message, portfolio) VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT (opportunity_id, user_id) DO UPDATE SET role = excluded.role, message = excluded.message,
         portfolio = excluded.portfolio, created_at = excluded.created_at`,
      newId('a'), row.id, userId, body.role, body.message, body.portfolio,
    )
    if (!row.author_id) return null
    const conv = ensureDirect(userId, row.author_id, row.id)
    const text = [`Заявка на «${row.title}» — роль: ${body.role}.`, body.message, body.portfolio && `Портфолио: ${body.portfolio}`]
      .filter(Boolean)
      .join('\n')
    postMessage(conv, userId, text)
    return conv
  })

  res.status(201).json({ application: { opportunityId: row.id, role: body.role, createdAt: now() }, conversationId })
})

opportunitiesRouter.delete('/:id/apply', requireAuth, (req, res) => {
  run('DELETE FROM applications WHERE opportunity_id = ? AND user_id = ?', param(req), me(req))
  res.status(204).end()
})

// «Я пойду» и «Сохранить» — идемпотентные PUT/DELETE.
for (const [path, table] of [['attend', 'attendance'], ['save', 'saved']] as const) {
  opportunitiesRouter.put(`/:id/${path}`, requireAuth, (req, res) => {
    if (!canReadOpportunity(param(req), req.userId))
      return void res.status(404).json({ error: 'Публикация не найдена' })
    run(`INSERT OR IGNORE INTO ${table} (user_id, opportunity_id) VALUES (?, ?)`, me(req), param(req))
    res.status(204).end()
  })
  opportunitiesRouter.delete(`/:id/${path}`, requireAuth, (req, res) => {
    run(`DELETE FROM ${table} WHERE user_id = ? AND opportunity_id = ?`, me(req), param(req))
    res.status(204).end()
  })
}
