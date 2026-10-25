import { Router, type Request } from 'express'
import { z } from 'zod'
import { me, param, requireAuth } from '../auth.js'
import { all, get, newId, now, run } from '../db.js'
import { findPerson, opportunityOf, type OpportunityRow } from '../models.js'
import { canReadOpportunity } from '../campus.js'

export const conversationsRouter = Router()
conversationsRouter.use(requireAuth)

type ConvRow = {
  id: string
  type: 'direct' | 'group'
  title: string | null
  kind: string | null
  letter: string | null
  opportunity_id: string | null
  last_read_at: string
}
type MessageRow = { id: string; sender_id: string; text: string; file_name: string | null; file_size: string | null; created_at: string }

export function findDirect(a: string, b: string) {
  return get<{ id: string }>(
    `SELECT c.id FROM conversations c
       JOIN conversation_members m1 ON m1.conversation_id = c.id AND m1.user_id = ?
       JOIN conversation_members m2 ON m2.conversation_id = c.id AND m2.user_id = ?
     WHERE c.type = 'direct' LIMIT 1`,
    a, b,
  )?.id
}

export function ensureDirect(a: string, b: string, opportunityId: string | null = null) {
  const existing = findDirect(a, b)
  if (existing) {
    if (opportunityId) run('UPDATE conversations SET opportunity_id = ? WHERE id = ?', opportunityId, existing)
    return existing
  }
  const id = newId('c')
  run("INSERT INTO conversations (id, type, opportunity_id) VALUES (?, 'direct', ?)", id, opportunityId)
  run('INSERT INTO conversation_members (conversation_id, user_id) VALUES (?, ?), (?, ?)', id, a, id, b)
  return id
}

export function postMessage(conversationId: string, senderId: string, text: string, createdAt = now()) {
  const id = newId('m')
  const previous = get<{ created_at: string }>('SELECT created_at FROM messages WHERE conversation_id = ? ORDER BY created_at DESC LIMIT 1', conversationId)
  // last_read_at is a timestamp cursor: keep it unambiguous even for rapid consecutive sends.
  if (previous && createdAt <= previous.created_at) createdAt = new Date(Date.parse(previous.created_at) + 1).toISOString()
  run('INSERT INTO messages (id, conversation_id, sender_id, text, created_at) VALUES (?, ?, ?, ?, ?)', id, conversationId, senderId, text, createdAt)
  return id
}

function membership(req: Request) {
  const conv = get<ConvRow>(
    `SELECT c.*, m.last_read_at FROM conversations c
       JOIN conversation_members m ON m.conversation_id = c.id AND m.user_id = ?
     WHERE c.id = ?`,
    me(req), param(req),
  )
  return conv
}

function summary(c: ConvRow, userId: string) {
  const other =
    c.type === 'direct'
      ? findPerson(get<{ user_id: string }>('SELECT user_id FROM conversation_members WHERE conversation_id = ? AND user_id != ?', c.id, userId)?.user_id ?? null)
      : undefined
  const last = get<MessageRow>('SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at DESC LIMIT 1', c.id)
  const unread = get<{ n: number }>(
    'SELECT COUNT(*) AS n FROM messages WHERE conversation_id = ? AND sender_id != ? AND created_at > ?',
    c.id, userId, c.last_read_at,
  )!.n
  const opp = c.opportunity_id ? get<OpportunityRow>('SELECT * FROM opportunities WHERE id = ?', c.opportunity_id) : undefined
  return {
    id: c.id,
    type: c.type,
    title: other?.name ?? c.title ?? 'Диалог',
    person: other,
    kind: c.kind ?? undefined,
    letter: c.letter ?? undefined,
    opportunity: opp && canReadOpportunity(opp.id, userId) ? opportunityOf(opp, userId) : undefined,
    lastMessage: last ? { text: last.text, createdAt: last.created_at, mine: last.sender_id === userId } : undefined,
    unread,
  }
}

conversationsRouter.get('/', (req, res) => {
  const userId = me(req)
  const rows = all<ConvRow & { last_at: string | null }>(
    `SELECT c.*, m.last_read_at, (SELECT MAX(created_at) FROM messages WHERE conversation_id = c.id) AS last_at
       FROM conversations c JOIN conversation_members m ON m.conversation_id = c.id AND m.user_id = ?
     ORDER BY COALESCE(last_at, c.created_at) DESC`,
    userId,
  )
  res.json({ items: rows.map((c) => summary(c, userId)) })
})

// Найти или создать личный диалог с пользователем (кнопка «Написать»).
conversationsRouter.post('/direct', (req, res) => {
  const { userId } = z.object({ userId: z.string().min(1) }).parse(req.body)
  if (userId === me(req)) return void res.status(400).json({ error: 'Нельзя написать самому себе' })
  if (!get('SELECT 1 FROM users WHERE id = ?', userId)) return void res.status(404).json({ error: 'Пользователь не найден' })
  res.json({ id: ensureDirect(me(req), userId) })
})

conversationsRouter.get('/:id', (req, res) => {
  const conv = membership(req)
  if (!conv) return void res.status(404).json({ error: 'Диалог не найден' })
  const userId = me(req)
  const messages = all<MessageRow>('SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at', conv.id).map((m) => ({
    id: m.id,
    mine: m.sender_id === userId,
    sender: m.sender_id === userId ? undefined : findPerson(m.sender_id),
    text: m.text,
    file: m.file_name ? { name: m.file_name, size: m.file_size ?? '' } : undefined,
    createdAt: m.created_at,
  }))
  res.json({ conversation: summary(conv, userId), messages })
})

conversationsRouter.post('/:id/messages', (req, res) => {
  const conv = membership(req)
  if (!conv) return void res.status(404).json({ error: 'Диалог не найден' })
  const { text } = z.object({ text: z.string().trim().min(1).max(4000) }).parse(req.body)
  const id = postMessage(conv.id, me(req), text)
  res.status(201).json({ message: { id, mine: true, text, createdAt: get<{ created_at: string }>('SELECT created_at FROM messages WHERE id = ?', id)!.created_at } })
})

conversationsRouter.post('/:id/read', (req, res) => {
  const conv = membership(req)
  if (!conv) return void res.status(404).json({ error: 'Диалог не найден' })
  const { messageId } = z.object({ messageId: z.string().min(1) }).parse(req.body)
  const message = get<{ created_at: string }>('SELECT created_at FROM messages WHERE id = ? AND conversation_id = ?', messageId, conv.id)
  if (!message) return void res.status(404).json({ error: 'Сообщение не найдено в этом диалоге' })
  run('UPDATE conversation_members SET last_read_at = MAX(last_read_at, ?) WHERE conversation_id = ? AND user_id = ?', message.created_at, conv.id, me(req))
  res.status(204).end()
})
