import { all, get } from './db.js'
import { campusOf } from './campus.js'

const calendar = new Intl.DateTimeFormat('en', { timeZone: 'Asia/Almaty', year: 'numeric', month: '2-digit', day: '2-digit' })
function dateKey(value: string | Date) {
  const parts = calendar.formatToParts(typeof value === 'string' ? new Date(value) : value)
  return `${parts.find((p) => p.type === 'year')!.value}-${parts.find((p) => p.type === 'month')!.value}-${parts.find((p) => p.type === 'day')!.value}`
}
export function campusOverview(campusId: string, days: 7 | 30 | 90, at = new Date()) {
  const through = dateKey(at)
  const from = new Date(Date.parse(`${through}T00:00:00Z`) - (days - 1) * 86_400_000).toISOString().slice(0, 10)
  const inRange = (timestamp: string) => { const date = dateKey(timestamp); return date >= from && date <= through && timestamp <= at.toISOString() }
  const publications = all<{ id: string; kind: string; author_id: string; created_at: string; hidden: number }>(
    'SELECT o.id,o.kind,o.author_id,o.created_at,cp.hidden FROM opportunities o JOIN campus_publications cp ON cp.opportunity_id=o.id WHERE cp.campus_id=?', campusId).filter((o) => inRange(o.created_at))
  const applications = all<{ user_id: string; created_at: string }>(`SELECT a.user_id,a.created_at FROM applications a
    JOIN opportunities o ON o.id=a.opportunity_id JOIN campus_publications cp ON cp.opportunity_id=o.id WHERE cp.campus_id=?`, campusId).filter((a) => inRange(a.created_at))
  const daily = Array.from({ length: days }, (_, index) => ({ date: new Date(Date.parse(`${from}T00:00:00Z`) + index * 86_400_000).toISOString().slice(0, 10), publications: 0, applications: 0 }))
  const byDay = new Map(daily.map((row) => [row.date, row]))
  for (const row of publications) byDay.get(dateKey(row.created_at))!.publications++
  for (const row of applications) byDay.get(dateKey(row.created_at))!.applications++
  const members = all<{ user_id: string; status: string; verified_at: string | null; expires_at: string | null }>('SELECT user_id,status,verified_at,expires_at FROM campus_students WHERE campus_id=?', campusId)
  const memberIds = new Set(members.map((s) => s.user_id))
  const activeStudents = new Set([...publications.map((o) => o.author_id), ...applications.map((a) => a.user_id)].filter((id) => memberIds.has(id))).size
  return { campus: campusOf(campusId)!, days, from, through,
    counts: { studentsTotal: members.length, pendingStudents: members.filter((s) => s.status === 'pending').length,
      verifiedStudents: members.filter((s) => s.status === 'verified' && s.verified_at && s.verified_at <= at.toISOString() && (!s.expires_at || s.expires_at > at.toISOString())).length,
      activeStudents, publications: publications.length, hiddenPublications: publications.filter((o) => o.hidden).length, applications: applications.length,
      attendancesTotal: get<{ n: number }>(`SELECT COUNT(*) AS n FROM attendance a JOIN opportunities o ON o.id=a.opportunity_id
        JOIN campus_publications cp ON cp.opportunity_id=o.id WHERE cp.campus_id=?`, campusId)!.n },
    daily, byKind: ['meetup', 'job', 'idea', 'event'].map((kind) => ({ kind, count: publications.filter((o) => o.kind === kind).length })),
    recentActivity: all<{ id: string; action: string; targetId: string; createdAt: string }>('SELECT id,action,target_id AS targetId,created_at AS createdAt FROM campus_audit WHERE campus_id=? ORDER BY created_at DESC,id DESC LIMIT 20', campusId) }
}
