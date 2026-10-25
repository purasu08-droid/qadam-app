import { Router } from 'express'
import { z } from 'zod'
import { me, param, requireAuth } from '../auth.js'
import { all, get, newId, now, run, tx } from '../db.js'
import { BILLING_SERVICES, publicationPayloadHash } from '../billing.js'
import { CampusError, campusAudit, campusMe, currentMembership, membershipOf, requireCampusAdmin, studentOf, type MembershipRow } from '../campus.js'
import { campusOverview } from '../campus-overview.js'
import { opportunityOf, type OpportunityRow } from '../models.js'
import { campusScopeAllowed } from '../campus-demo-policy.js'

export const campusRouter = Router()
campusRouter.use(requireAuth)
const Id = z.string().trim().min(1).max(100)
const Future = z.string().datetime({ offset: true }).transform((value) => new Date(value).toISOString()).refine((value) => value > now(), 'Срок должен быть в будущем')
const Page = z.coerce.number().int().min(1).max(1_000_000).default(1)
const PAGE_SIZE = 20
const Search = { q: z.string().trim().max(200).default(''), page: Page }
campusRouter.get('/me', (req, res) => res.json(campusMe(me(req))))
campusRouter.post('/enroll', (req, res) => {
  const body = z.object({ campusId: Id, faculty: z.string().trim().min(2).max(120), studyYear: z.number().int().min(1).max(8) }).strict().parse(req.body)
  const membership = tx(() => {
    if (!campusScopeAllowed(me(req), body.campusId)) throw new CampusError(403, 'CAMPUS_FORBIDDEN', 'Нет доступа к этому Campus')
    if (!get('SELECT 1 FROM campuses WHERE id=?', body.campusId)) throw new CampusError(404, 'CAMPUS_NOT_FOUND', 'Campus не найден')
    if (currentMembership(me(req))) throw new CampusError(409, 'MEMBERSHIP_EXISTS', 'У тебя уже есть действующее подтверждение Campus; изменение выполняет администратор вуза')
    run(`INSERT INTO campus_students (user_id,campus_id,status,faculty,study_year,requested_at) VALUES (?,?,'pending',?,?,?)
      ON CONFLICT(user_id) DO UPDATE SET campus_id=excluded.campus_id,status='pending',faculty=excluded.faculty,
        study_year=excluded.study_year,requested_at=excluded.requested_at,verified_at=NULL,expires_at=NULL,reviewed_by=NULL`,
    me(req), body.campusId, body.faculty, body.studyYear, now())
    campusAudit(body.campusId, me(req), 'enrollment_requested', me(req))
    return membershipOf(get<MembershipRow>('SELECT * FROM campus_students WHERE user_id=?', me(req))!)
  }, 'IMMEDIATE')
  res.status(201).json({ membership })
})
// Check capability before looking up scoped entities, including for unknown campus identifiers.
campusRouter.use('/:campusId', (req, _res, next) => { requireCampusAdmin(me(req), param(req, 'campusId')); next() })
campusRouter.get('/:campusId/overview', (req, res) => {
  const { days } = z.object({ days: z.coerce.number().refine((value) => [7, 30, 90].includes(value)).default(30) }).parse(req.query)
  res.json(campusOverview(param(req, 'campusId'), days as 7 | 30 | 90))
})
campusRouter.get('/:campusId/students', (req, res) => {
  const query = z.object({ ...Search, status: z.enum(['all', 'pending', 'verified', 'rejected', 'revoked']).default('all') }).parse(req.query)
  const where = `s.campus_id=? AND (?='all' OR s.status=?) AND (u.name LIKE ? OR u.email LIKE ? OR s.faculty LIKE ?)`
  const values = [param(req, 'campusId'), query.status, query.status, ...Array(3).fill(`%${query.q}%`)]
  const total = get<{ n: number }>(`SELECT COUNT(*) AS n FROM campus_students s JOIN users u ON u.id=s.user_id WHERE ${where}`, ...values)!.n
  const rows = all<MembershipRow>(`SELECT s.* FROM campus_students s JOIN users u ON u.id=s.user_id WHERE ${where} ORDER BY s.requested_at DESC,s.user_id LIMIT ? OFFSET ?`, ...values, PAGE_SIZE, (query.page - 1) * PAGE_SIZE)
  res.json({ items: rows.map(studentOf), total, page: query.page, pageSize: PAGE_SIZE })
})
campusRouter.patch('/:campusId/students/:userId', (req, res) => {
  const body = z.object({ status: z.enum(['verified', 'rejected', 'revoked']), expiresAt: Future.nullable().optional() }).strict().parse(req.body)
  const campusId = param(req, 'campusId'), userId = param(req, 'userId')
  const student = tx(() => {
    requireCampusAdmin(me(req), campusId)
    if (!campusScopeAllowed(userId, campusId)) throw new CampusError(403, 'CAMPUS_FORBIDDEN', 'Нет доступа к этому Campus')
    if (!get('SELECT 1 FROM campus_students WHERE campus_id=? AND user_id=?', campusId, userId)) throw new CampusError(404, 'STUDENT_NOT_FOUND', 'Студент не найден в этом Campus')
    run('UPDATE campus_students SET status=?,verified_at=?,expires_at=?,reviewed_by=? WHERE campus_id=? AND user_id=?',
      body.status, body.status === 'verified' ? now() : null, body.status === 'verified' ? body.expiresAt ?? null : null, me(req), campusId, userId)
    if (body.status !== 'verified') run('UPDATE billing_campus_grants SET revoked_at=COALESCE(revoked_at,?) WHERE campus_id=? AND user_id=?', now(), campusId, userId)
    campusAudit(campusId, me(req), `student_${body.status}`, userId)
    return studentOf(get<MembershipRow>('SELECT * FROM campus_students WHERE user_id=? AND campus_id=?', userId, campusId)!)
  }, 'IMMEDIATE')
  res.json({ student })
})
campusRouter.get('/:campusId/publications', (req, res) => {
  const query = z.object({ ...Search, status: z.enum(['all', 'visible', 'hidden']).default('all') }).parse(req.query)
  const where = `cp.campus_id=? AND (?='all' OR cp.hidden=?) AND (o.title LIKE ? OR o.card LIKE ?)`
  const values = [param(req, 'campusId'), query.status, query.status === 'hidden' ? 1 : 0, `%${query.q}%`, `%${query.q}%`]
  const total = get<{ n: number }>(`SELECT COUNT(*) AS n FROM campus_publications cp JOIN opportunities o ON o.id=cp.opportunity_id WHERE ${where}`, ...values)!.n
  const rows = all<OpportunityRow>(`SELECT o.* FROM campus_publications cp JOIN opportunities o ON o.id=cp.opportunity_id WHERE ${where} ORDER BY o.created_at DESC,o.id LIMIT ? OFFSET ?`, ...values, PAGE_SIZE, (query.page - 1) * PAGE_SIZE)
  res.json({ items: rows.map((o) => ({ ...opportunityOf(o, me(req)), moderationReason: get<{ reason: string | null }>('SELECT reason FROM campus_publications WHERE opportunity_id=?', o.id)!.reason })), total, page: query.page, pageSize: PAGE_SIZE })
})
campusRouter.patch('/:campusId/publications/:opportunityId', (req, res) => {
  const body = z.object({ hidden: z.boolean(), reason: z.string().trim().max(500) }).strict().refine((value) => !value.hidden || value.reason.length >= 3, 'Укажи причину скрытия (от 3 символов)').parse(req.body)
  const campusId = param(req, 'campusId'), id = param(req, 'opportunityId')
  const item = tx(() => {
    requireCampusAdmin(me(req), campusId)
    const row = get<OpportunityRow>('SELECT o.* FROM opportunities o JOIN campus_publications cp ON cp.opportunity_id=o.id WHERE o.id=? AND cp.campus_id=?', id, campusId)
    if (!row) throw new CampusError(404, 'PUBLICATION_NOT_FOUND', 'Публикация не найдена в этом Campus')
    run('UPDATE campus_publications SET hidden=?,reason=?,moderated_at=?,moderated_by=? WHERE opportunity_id=? AND campus_id=?', body.hidden ? 1 : 0, body.reason || null, now(), me(req), id, campusId)
    campusAudit(campusId, me(req), body.hidden ? 'publication_hidden' : 'publication_restored', id)
    return opportunityOf(row, me(req))
  }, 'IMMEDIATE')
  res.json({ item })
})
type GrantRow = { id: string; user_id: string; service: string; quota: number; valid_from: string; expires_at: string; revoked_at: string | null; created_at: string; campus_id: string }
function grantOf(row: GrantRow) {
  const used = get<{ n: number }>('SELECT COUNT(*) AS n FROM billing_usage WHERE campus_grant_id=?', row.id)!.n
  return { id: row.id, user: get<{ id: string; name: string; email: string }>('SELECT id,name,email FROM users WHERE id=?', row.user_id)!,
    service: row.service, quota: row.quota, used, remaining: Math.max(0, row.quota - used), validFrom: row.valid_from, expiresAt: row.expires_at,
    revokedAt: row.revoked_at, createdAt: row.created_at,
    active: !row.revoked_at && row.valid_from <= now() && row.expires_at > now() && used < row.quota && Boolean(currentMembership(row.user_id, row.campus_id)) }
}
campusRouter.get('/:campusId/grants', (req, res) => {
  const { page } = z.object({ page: Page }).parse(req.query)
  const campusId = param(req, 'campusId')
  const total = get<{ n: number }>('SELECT COUNT(*) AS n FROM billing_campus_grants WHERE campus_id=?', campusId)!.n
  const rows = all<GrantRow>('SELECT * FROM billing_campus_grants WHERE campus_id=? ORDER BY created_at DESC,id DESC LIMIT ? OFFSET ?', campusId, PAGE_SIZE, (page - 1) * PAGE_SIZE)
  res.json({ items: rows.map(grantOf), total, page, pageSize: PAGE_SIZE })
})
campusRouter.post('/:campusId/grants', (req, res) => {
  const body = z.object({ userId: Id, service: z.enum(BILLING_SERVICES), quota: z.number().int().min(1).max(100_000), expiresAt: z.string().datetime({ offset: true }).transform((value) => new Date(value).toISOString()) }).strict().parse(req.body)
  const key = z.string().trim().min(1).max(128).regex(/^[\x21-\x7e]+$/).parse(req.get('Idempotency-Key'))
  const campusId = param(req, 'campusId'), hash = publicationPayloadHash(body)
  const grant = tx(() => {
    requireCampusAdmin(me(req), campusId)
    const previous = get<{ payload_hash: string; grant_id: string }>('SELECT payload_hash,grant_id FROM campus_grant_requests WHERE campus_id=? AND request_key=?', campusId, key)
    if (previous) {
      if (previous.payload_hash !== hash) throw new CampusError(409, 'IDEMPOTENCY_CONFLICT', 'Этот ключ уже использован для другого гранта')
      return grantOf(get<GrantRow>('SELECT * FROM billing_campus_grants WHERE id=? AND campus_id=?', previous.grant_id, campusId)!)
    }
    if (!currentMembership(body.userId, campusId)) throw new CampusError(403, 'CURRENT_STUDENT_REQUIRED', 'Грант доступен только действующему подтверждённому студенту этого Campus')
    if (body.expiresAt <= now()) throw new CampusError(400, 'INVALID_EXPIRY', 'Срок должен быть в будущем')
    const id = newId('cg'), timestamp = now()
    run('INSERT INTO billing_campus_grants (id,user_id,service,quota,valid_from,expires_at,issuer,campus_id) VALUES (?,?,?,?,?,?,?,?)',
      id, body.userId, body.service, body.quota, timestamp, body.expiresAt, `campus:${campusId}`, campusId)
    run('INSERT INTO campus_grant_requests (campus_id,request_key,payload_hash,grant_id,created_at) VALUES (?,?,?,?,?)', campusId, key, hash, id, timestamp)
    campusAudit(campusId, me(req), 'grant_created', id)
    return grantOf(get<GrantRow>('SELECT * FROM billing_campus_grants WHERE id=?', id)!)
  }, 'IMMEDIATE')
  res.status(201).json({ grant })
})
campusRouter.post('/:campusId/grants/:grantId/revoke', (req, res) => {
  const campusId = param(req, 'campusId'), id = param(req, 'grantId')
  const grant = tx(() => {
    requireCampusAdmin(me(req), campusId)
    const row = get<GrantRow>('SELECT * FROM billing_campus_grants WHERE campus_id=? AND id=?', campusId, id)
    if (!row) throw new CampusError(404, 'GRANT_NOT_FOUND', 'Грант не найден в этом Campus')
    if (!row.revoked_at) {
      run('UPDATE billing_campus_grants SET revoked_at=? WHERE campus_id=? AND id=?', now(), campusId, id)
      campusAudit(campusId, me(req), 'grant_revoked', id)
    }
    return grantOf(get<GrantRow>('SELECT * FROM billing_campus_grants WHERE id=? AND campus_id=?', id, campusId)!)
  }, 'IMMEDIATE')
  res.json({ grant })
})
