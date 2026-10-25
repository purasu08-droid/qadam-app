import { get } from './db.js'

// The demo-reset safety check never changes protected records or schema.
export function hasLegacyTable(name: string) {
  return Boolean(get("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?", name))
}

export function hasArchivedFeatureData() {
  const tables = ['publication_requests', 'campuses', 'campus_admins', 'campus_students', 'campus_publications', 'campus_audit', 'campus_grant_requests', 'campus_demo_registry', 'campus_demo_identities', 'campus_demo_objects', 'billing_student_verifications', 'billing_campus_grants', 'billing_usage', 'billing_publication_requests']
  return tables.some((table) => hasLegacyTable(table) && Boolean(get(`SELECT 1 FROM ${table} LIMIT 1`)))
}
