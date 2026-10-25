import { get } from './db.js'

// Read-only compatibility with retired tables. They are never created, changed or dropped here.
export function hasLegacyTable(name: string) {
  return Boolean(get("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?", name))
}

export function isRetiredDemoUser(userId: string) {
  return hasLegacyTable('campus_demo_identities') && Boolean(get('SELECT 1 FROM campus_demo_identities WHERE user_id=?', userId))
}

export function publicOpportunityVisibility(alias = 'opportunities') {
  return hasLegacyTable('campus_publications')
    ? `NOT EXISTS (SELECT 1 FROM campus_publications archived WHERE archived.opportunity_id=${alias}.id AND archived.hidden=1)`
    : '1=1'
}

export function canReadOpportunity(opportunityId: string, viewerId?: string) {
  const item = get<{ author_id: string | null }>('SELECT author_id FROM opportunities WHERE id=?', opportunityId)
  if (!item) return false
  if (viewerId && item.author_id === viewerId) return true
  return !hasLegacyTable('campus_publications') || !get('SELECT 1 FROM campus_publications WHERE opportunity_id=? AND hidden=1', opportunityId)
}

export function hasArchivedFeatureData() {
  const tables = ['campuses', 'campus_admins', 'campus_students', 'campus_publications', 'campus_audit', 'campus_grant_requests', 'campus_demo_registry', 'campus_demo_identities', 'campus_demo_objects', 'billing_student_verifications', 'billing_campus_grants', 'billing_usage', 'billing_publication_requests']
  return tables.some((table) => hasLegacyTable(table) && Boolean(get(`SELECT 1 FROM ${table} LIMIT 1`)))
}
