import { all, get, newId, now, run } from './db.js'
import { campusScopeAllowed, demoCampus } from './campus-demo-policy.js'

export type Campus = { id: string; name: string; city: string; isDemo?: true }
export type MembershipRow = { user_id: string; campus_id: string; status: 'pending' | 'verified' | 'rejected' | 'revoked'; faculty: string; study_year: number; requested_at: string; verified_at: string | null; expires_at: string | null }
export class CampusError extends Error {
  constructor(public status: number, public code: string, message: string) { super(message) }
}
export function campusOf(id: string) {
  const campus = get<Campus>('SELECT id, name, city FROM campuses WHERE id = ?', id)
  return campus && { ...campus, ...(demoCampus(id) ? { isDemo: true as const } : {}) }
}
export function campusAdmin(userId: string, campusId: string) { return campusScopeAllowed(userId, campusId) && Boolean(get('SELECT 1 FROM campus_admins WHERE user_id = ? AND campus_id = ?', userId, campusId)) }
export function requireCampusAdmin(userId: string, campusId: string) {
  if (!campusAdmin(userId, campusId)) throw new CampusError(403, 'CAMPUS_FORBIDDEN', 'Нет доступа к этому Campus')
}
export function currentMembership(userId: string, campusId?: string, timestamp = now()) {
  const row = get<MembershipRow>(`SELECT * FROM campus_students WHERE user_id = ? AND status = 'verified'
    AND verified_at <= ? AND (expires_at IS NULL OR expires_at > ?) ${campusId ? 'AND campus_id = ?' : ''}`,
    userId, timestamp, timestamp, ...(campusId ? [campusId] : []))
  return row && campusScopeAllowed(userId, row.campus_id) ? row : undefined
}
export function membershipCurrent(row: MembershipRow, timestamp = now()) {
  return row.status === 'verified' && row.verified_at !== null && row.verified_at <= timestamp && (!row.expires_at || row.expires_at > timestamp)
}
export function membershipOf(row: MembershipRow) {
  return { userId: row.user_id, campus: campusOf(row.campus_id)!, status: row.status, faculty: row.faculty,
    studyYear: row.study_year, requestedAt: row.requested_at, verifiedAt: row.verified_at, expiresAt: row.expires_at, current: membershipCurrent(row) }
}
export function studentOf(row: MembershipRow) {
  const user = get<{ id: string; name: string; email: string; city: string }>('SELECT id, name, email, city FROM users WHERE id = ?', row.user_id)!
  const { campus: _campus, userId: _userId, ...membership } = membershipOf(row)
  return { user, ...membership }
}
export function campusMe(userId: string) {
  const membership = get<MembershipRow>('SELECT * FROM campus_students WHERE user_id = ?', userId)
  return { adminOf: all<Campus>('SELECT c.id,c.name,c.city FROM campuses c JOIN campus_admins a ON a.campus_id=c.id WHERE a.user_id=? ORDER BY c.name,c.id', userId)
      .filter((c) => campusScopeAllowed(userId, c.id)).map((c) => campusOf(c.id)!),
    membership: membership && campusScopeAllowed(userId, membership.campus_id) ? membershipOf(membership) : null,
    available: all<Campus>('SELECT id,name,city FROM campuses ORDER BY name,id').filter((c) => campusScopeAllowed(userId, c.id)).map((c) => campusOf(c.id)!) }
}
export function campusAudit(campusId: string, actorId: string | null, action: string, targetId: string) {
  // Only opaque references and event names; never store profile text, messages or moderation reasons here.
  run('INSERT INTO campus_audit (id,campus_id,actor_id,action,target_id,created_at) VALUES (?,?,?,?,?,?)', newId('ca'), campusId, actorId, action, targetId, now())
}
export function bindCampusPublication(userId: string, opportunityId: string, campusId?: string) {
  if (!campusId) return
  if (!currentMembership(userId, campusId)) throw new CampusError(403, 'CAMPUS_MEMBERSHIP_REQUIRED', 'Для публикации от Campus нужно действующее подтверждение студента этого вуза')
  run('INSERT INTO campus_publications (opportunity_id,campus_id,created_at) VALUES (?,?,?)', opportunityId, campusId, now())
  campusAudit(campusId, userId, 'publication_created', opportunityId)
}
export function publicCampusVisibility(alias = 'opportunities') {
  return `NOT EXISTS (SELECT 1 FROM campus_publications cp WHERE cp.opportunity_id = ${alias}.id AND cp.hidden = 1)`
}
export function canReadOpportunity(opportunityId: string, viewerId?: string) {
  const item = get<{ author_id: string | null; campus_id: string | null; hidden: number | null }>(
    `SELECT o.author_id,cp.campus_id,cp.hidden FROM opportunities o LEFT JOIN campus_publications cp ON cp.opportunity_id=o.id WHERE o.id=?`, opportunityId)
  return Boolean(item && (!item.hidden || (viewerId && (item.author_id === viewerId || (item.campus_id && campusAdmin(viewerId, item.campus_id))))))
}
export function publicationCampusInfo(opportunityId: string, viewerId?: string) {
  const link = get<{ campus_id: string; hidden: number; reason: string | null; author_id: string | null }>(
    `SELECT cp.campus_id,cp.hidden,cp.reason,o.author_id FROM campus_publications cp JOIN opportunities o ON o.id=cp.opportunity_id WHERE cp.opportunity_id=?`, opportunityId)
  if (!link) return {}
  const privileged = viewerId && (viewerId === link.author_id || campusAdmin(viewerId, link.campus_id))
  return { campus: campusOf(link.campus_id)!, campusHidden: Boolean(link.hidden), ...(privileged ? { moderationReason: link.reason } : {}) }
}
