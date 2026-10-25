import type { BillingService } from './billing'
import type { Kind, Opportunity } from './data'

export type Campus = { id: string; name: string; city: string; isDemo?: boolean }
export type CampusStatus = 'pending' | 'verified' | 'rejected' | 'revoked'
export type CampusMembership = {
  userId: string
  campus: Campus
  status: CampusStatus
  faculty: string
  studyYear: number
  requestedAt: string
  verifiedAt: string | null
  expiresAt: string | null
  current: boolean
}
export type CampusMe = { adminOf: Campus[]; membership: CampusMembership | null; available: Campus[] }
export type CampusStudent = Omit<CampusMembership, 'campus' | 'userId'> & { user: { id: string; name: string; email: string; city: string } }
export type CampusPublication = Opportunity & { campus: Campus; campusHidden: boolean; moderationReason: string | null }
export type CampusGrant = {
  id: string
  user: { id: string; name: string; email: string }
  service: BillingService
  quota: number
  used: number
  remaining: number
  validFrom: string
  expiresAt: string
  revokedAt: string | null
  active: boolean
  createdAt: string
}
export type CampusPage<T> = { items: T[]; total: number; page: number; pageSize: number }
export type CampusOverview = {
  campus: Campus
  days: 7 | 30 | 90
  from: string
  through: string
  counts: { studentsTotal: number; pendingStudents: number; verifiedStudents: number; publications: number; hiddenPublications: number; applications: number; attendancesTotal: number; activeStudents: number }
  daily: { date: string; publications: number; applications: number }[]
  byKind: { kind: Kind; count: number }[]
  recentActivity: { id: string; action: string; targetId: string; createdAt: string }[]
}
