import { Router } from 'express'
import { z } from 'zod'
import { me, param, requireAuth } from '../auth.js'
import { all, get, run } from '../db.js'
import { findPerson, opportunitiesByIds, opportunityOf, profileOf, type OpportunityRow, type UserRow } from '../models.js'
import { findDirect } from './conversations.js'
import { publicOpportunityVisibility } from '../legacy-data.js'

export const usersRouter = Router()

function profileResponse(user: UserRow, self: boolean) {
  const publications = all<OpportunityRow>(`SELECT * FROM opportunities WHERE author_id = ? ${self ? '' : `AND ${publicOpportunityVisibility()}`} ORDER BY created_at DESC`, user.id).map((o) => opportunityOf(o, self ? user.id : undefined))
  return { profile: profileOf(user, self), publications }
}

// Состояние текущего пользователя для кнопок «Я пойду», «Сохранить», «Заявка отправлена».
usersRouter.get('/me/state', requireAuth, (req, res) => {
  const userId = me(req)
  const ids = (sql: string) => all<{ id: string }>(sql, userId).map((r) => r.id)
  res.json({
    saved: ids('SELECT opportunity_id AS id FROM saved WHERE user_id = ?'),
    attending: ids('SELECT opportunity_id AS id FROM attendance WHERE user_id = ?'),
    applications: all<{ opportunityId: string; role: string; createdAt: string; authorId: string | null }>(
      `SELECT a.opportunity_id AS opportunityId, a.role, a.created_at AS createdAt, o.author_id AS authorId
       FROM applications a JOIN opportunities o ON o.id = a.opportunity_id WHERE a.user_id = ? ORDER BY a.created_at DESC`,
      userId,
    ).map(({ authorId, ...application }) => ({ ...application, conversationId: authorId ? findDirect(userId, authorId) ?? null : null })),
    unread: get<{ n: number }>(
      `SELECT COUNT(*) AS n FROM messages msg
         JOIN conversation_members m ON m.conversation_id = msg.conversation_id AND m.user_id = ?
       WHERE msg.sender_id != m.user_id AND msg.created_at > m.last_read_at`,
      userId,
    )!.n,
  })
})

// Вкладки профиля «Мои заявки» и «Сохранённое».
usersRouter.get('/me/activity', requireAuth, (req, res) => {
  const userId = me(req)
  const applied = all<{ id: string; role: string }>('SELECT opportunity_id AS id, role FROM applications WHERE user_id = ? ORDER BY created_at DESC', userId)
  const attending = all<{ id: string }>('SELECT opportunity_id AS id FROM attendance WHERE user_id = ?', userId)
  const saved = all<{ id: string }>('SELECT opportunity_id AS id FROM saved WHERE user_id = ?', userId)
  const byId = new Map(opportunitiesByIds([...new Set([...applied, ...attending, ...saved].map((r) => r.id))], userId).map((o) => [o.id, o]))
  res.json({
    requests: [
      ...applied.map((a) => ({ item: byId.get(a.id), note: `Заявка: ${a.role}` })),
      ...attending.map((a) => ({ item: byId.get(a.id), note: 'Ты идёшь' })),
    ].filter((r) => r.item),
    saved: saved.map((s) => ({ item: byId.get(s.id), note: 'В сохранённом' })).filter((r) => r.item),
  })
})

usersRouter.get('/me', requireAuth, (req, res) => {
  res.json(profileResponse(get<UserRow>('SELECT * FROM users WHERE id = ?', me(req))!, true))
})

const Patch = z.object({
  name: z.string().trim().min(2).max(80),
  role: z.string().trim().max(80),
  city: z.string().trim().min(2).max(60),
  bio: z.string().trim().max(200),
  about: z.string().trim().max(1000),
  portfolio: z.union([z.string().trim().url().max(300).refine((value) => /^https?:\/\//i.test(value), 'Ссылка на портфолио должна начинаться с http(s)://'), z.literal('')]),
  skills: z.array(z.string().trim().min(1).max(40)).max(20),
  interests: z.array(z.string().trim().min(1).max(40)).max(20),
}).partial()

usersRouter.patch('/me', requireAuth, (req, res) => {
  const p = Patch.parse(req.body)
  const cols: string[] = []
  const vals: string[] = []
  for (const [k, v] of Object.entries(p)) {
    if (v === undefined) continue
    cols.push(`${k} = ?`)
    vals.push(Array.isArray(v) ? JSON.stringify(v) : k === 'portfolio' && v === '' ? '' : String(v))
  }
  if (cols.length) run(`UPDATE users SET ${cols.join(', ')} WHERE id = ?`, ...vals, me(req))
  res.json(profileResponse(get<UserRow>('SELECT * FROM users WHERE id = ?', me(req))!, true))
})

usersRouter.get('/:id', (req, res) => {
  const user = get<UserRow>('SELECT * FROM users WHERE id = ?', param(req))
  if (!user) return void res.status(404).json({ error: 'Пользователь не найден' })
  res.json(profileResponse(user, user.id === req.userId))
})

export const projectsRouter = Router()

type ProjectRow = { id: string; title: string; text: string; cover: string | null; status: string; note: string; owner_id: string; opportunity_id: string | null }

projectsRouter.get('/', requireAuth, (req, res) => {
  const userId = me(req)
  const rows = all<ProjectRow>(
    `SELECT p.* FROM projects p JOIN project_members pm ON pm.project_id = p.id AND pm.user_id = ?
     ORDER BY p.created_at DESC`,
    userId,
  )
  res.json({
    items: rows.map((p) => ({
      id: p.id,
      title: p.title,
      text: p.text,
      cover: p.cover ?? undefined,
      status: p.status,
      note: p.note,
      mine: p.owner_id === userId,
      opportunityId: p.opportunity_id ?? undefined,
      team: all<{ user_id: string }>('SELECT user_id FROM project_members WHERE project_id = ?', p.id).map((m) => findPerson(m.user_id)!).filter(Boolean),
      conversationId: get<{ id: string }>('SELECT id FROM conversations WHERE project_id = ? LIMIT 1', p.id)?.id,
    })),
  })
})
