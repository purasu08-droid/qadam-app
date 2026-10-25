import { config } from './config.js'
import { get } from './db.js'

export function campusDemoEnabled() { return !config.production && config.allowDemoLogin }
export function demoCampus(campusId: string) { return Boolean(get('SELECT 1 FROM campus_demo_registry WHERE campus_id=?', campusId)) }
export function campusDemoIdentity(userId: string) {
  return get<{ campus_id: string; role: 'admin' | 'student' }>(`SELECT r.campus_id,i.role FROM campus_demo_identities i
    JOIN campus_demo_registry r ON r.slot=i.slot WHERE i.user_id=?`, userId)
}
export function campusScopeAllowed(userId: string, campusId: string) {
  const identity = campusDemoIdentity(userId)
  if (identity) return campusDemoEnabled() && identity.campus_id === campusId && demoCampus(campusId)
  return !demoCampus(campusId)
}
