import { randomBytes } from 'node:crypto'
import { all, get, newId, now, run, tx } from './db.js'
import { CampusError, campusAudit, campusOf } from './campus.js'
import { campusDemoEnabled } from './campus-demo-policy.js'
import { billingPeriod } from './billing.js'
import { ensureDirect, postMessage } from './routes/conversations.js'
import type { UserRow } from './models.js'

const SLOT = 'enu-v1'
const ACTORS = [
  { key: 'admin', name: 'DEMO · Администратор ЕНУ', role: 'admin' },
  { key: 'verified1', name: 'DEMO · Айдана', role: 'student' },
  { key: 'verified2', name: 'DEMO · Марат', role: 'student' },
  { key: 'pending1', name: 'DEMO · Алия', role: 'student' },
  { key: 'pending2', name: 'DEMO · Тимур', role: 'student' },
] as const
const PUBLICATIONS = [
  { key: '1', author: 'verified1', kind: 'idea', title: 'DEMO · Студенческий сервис ЕНУ', day: 6 },
  { key: '2', author: 'verified2', kind: 'job', title: 'DEMO · Дизайнер в команду проекта', day: 4 },
  { key: '3', author: 'verified1', kind: 'meetup', title: 'DEMO · Клуб студенческих команд', day: 2 },
  { key: '4', author: 'verified2', kind: 'event', title: 'DEMO · День проектов ЕНУ', day: 0 },
] as const
type Registry = { campus_id: string; namespace_token: string; fixture_version: number }
type Identity = { user_id: string; actor_key: string; identity_token: string; role: string; email: string; password_hash: string }
function collision(): never { throw new CampusError(409, 'CAMPUS_DEMO_COLLISION', 'Демо-стенд имеет несовместимые записи; вход остановлен без изменения данных') }
function objectId(namespace: string, kind: string, key: string) { return `demo_${namespace}_${kind}_${key}` }

/** Validate ownership by immutable tokens and references, never by a display name or discovered email. */
function existingDemo(registry: Registry) {
  if (!/^[a-f0-9]{32}$/.test(registry.namespace_token) || registry.fixture_version !== 1 || registry.campus_id !== `campus_demo_${registry.namespace_token}`) collision()
  const campus = campusOf(registry.campus_id)
  if (!campus) collision()
  const identities = all<Identity>(`SELECT i.*,u.email,u.password_hash FROM campus_demo_identities i JOIN users u ON u.id=i.user_id WHERE i.slot=?`, SLOT)
  if (identities.length !== ACTORS.length) collision()
  const owned = new Set(identities.map((i) => i.user_id))
  for (const actor of ACTORS) {
    const identity = identities.find((i) => i.actor_key === actor.key)
    if (!identity || !/^[a-f0-9]{32}$/.test(identity.identity_token) || identity.role !== actor.role
      || identity.user_id !== `user_campus_demo_${identity.identity_token}`
      || identity.email !== `${actor.key}.${identity.identity_token}@campus-demo.invalid`
      || identity.password_hash !== `campus-demo-disabled:${identity.identity_token}`) collision()
    const membership = get<{ campus_id: string }>('SELECT campus_id FROM campus_students WHERE user_id=?', identity.user_id)
    if ((actor.role === 'student' && !membership) || (membership && membership.campus_id !== registry.campus_id)) collision()
  }
  for (const row of all<{ user_id: string }>('SELECT user_id FROM campus_students WHERE campus_id=? UNION SELECT user_id FROM campus_admins WHERE campus_id=?', registry.campus_id, registry.campus_id)) {
    if (!owned.has(row.user_id)) collision()
  }
  const objects = all<{ object_key: string; object_kind: string; object_id: string }>('SELECT * FROM campus_demo_objects WHERE slot=?', SLOT)
  if (objects.length !== PUBLICATIONS.length + 1) collision()
  for (const publication of PUBLICATIONS) {
    const id = objectId(registry.namespace_token, 'publication', publication.key)
    if (!objects.some((o) => o.object_key === `publication:${publication.key}` && o.object_kind === 'publication' && o.object_id === id)) collision()
    const item = get<{ author_id: string; campus_id: string | null }>('SELECT o.author_id,cp.campus_id FROM opportunities o LEFT JOIN campus_publications cp ON cp.opportunity_id=o.id WHERE o.id=?', id)
    if (item && (item.author_id !== identities.find((i) => i.actor_key === publication.author)!.user_id || item.campus_id !== registry.campus_id)) collision()
  }
  const grantId = objectId(registry.namespace_token, 'grant', '1')
  if (!objects.some((o) => o.object_key === 'grant:1' && o.object_kind === 'grant' && o.object_id === grantId)) collision()
  const grant = get<{ user_id: string; campus_id: string | null; service: string }>('SELECT user_id,campus_id,service FROM billing_campus_grants WHERE id=?', grantId)
  if (grant && (grant.campus_id !== registry.campus_id || grant.user_id !== identities.find((i) => i.actor_key === 'verified1')!.user_id || grant.service !== 'publication')) collision()
  return { user: get<UserRow>('SELECT * FROM users WHERE id=?', identities.find((i) => i.actor_key === 'admin')!.user_id)!, campus }
}

/** One atomic bootstrap. Existing changes, deletions and revoked permissions are deliberately preserved. */
export function bootstrapCampusDemo() {
  if (!campusDemoEnabled()) throw new CampusError(403, 'CAMPUS_DEMO_DISABLED', 'Демо-кабинет Campus выключен')
  return tx(() => {
    const previous = get<Registry>('SELECT campus_id,namespace_token,fixture_version FROM campus_demo_registry WHERE slot=?', SLOT)
    if (previous) return existingDemo(previous)
    const namespace = randomBytes(16).toString('hex'), campusId = `campus_demo_${namespace}`
    const timestamp = now(), origin = Date.parse(timestamp)
    const ago = (days: number) => new Date(origin - days * 86_400_000).toISOString()
    const expires = new Date(origin + 365 * 86_400_000).toISOString()
    run('INSERT INTO campuses (id,name,city,created_at) VALUES (?,?,?,?)', campusId, 'ЕНУ · демо', 'Астана', ago(7))
    run('INSERT INTO campus_demo_registry (slot,campus_id,namespace_token,fixture_version,created_at) VALUES (?,?,?,1,?)', SLOT, campusId, namespace, timestamp)
    const actors = new Map<string, string>()
    for (const actor of ACTORS) {
      const token = randomBytes(16).toString('hex'), id = `user_campus_demo_${token}`
      run('INSERT INTO users (id,email,password_hash,name,city,role,created_at) VALUES (?,?,?,?,?,?,?)',
        id, `${actor.key}.${token}@campus-demo.invalid`, `campus-demo-disabled:${token}`, actor.name, 'Астана', actor.role === 'admin' ? 'DEMO · Администратор' : 'DEMO · Студент', ago(7))
      run('INSERT INTO campus_demo_identities (user_id,slot,actor_key,identity_token,role) VALUES (?,?,?,?,?)', id, SLOT, actor.key, token, actor.role)
      actors.set(actor.key, id)
    }
    const admin = actors.get('admin')!
    run('INSERT INTO campus_admins (campus_id,user_id) VALUES (?,?)', campusId, admin)
    campusAudit(campusId, admin, 'campus_created', campusId); campusAudit(campusId, admin, 'admin_granted', admin)
    for (const actor of ACTORS.filter((a) => a.role === 'student')) {
      const verified = actor.key.startsWith('verified')
      run(`INSERT INTO campus_students (user_id,campus_id,status,faculty,study_year,requested_at,verified_at,expires_at,reviewed_by)
        VALUES (?,?,?,?,?,?,?,?,?)`, actors.get(actor.key)!, campusId, verified ? 'verified' : 'pending', 'DEMO · Информационные технологии', 2,
        ago(7), verified ? ago(7) : null, verified ? expires : null, verified ? admin : null)
      campusAudit(campusId, actors.get(actor.key)!, 'enrollment_requested', actors.get(actor.key)!)
      if (verified) campusAudit(campusId, admin, 'student_verified', actors.get(actor.key)!)
    }
    for (const publication of PUBLICATIONS) {
      const id = objectId(namespace, 'publication', publication.key), author = actors.get(publication.author)!, createdAt = ago(publication.day)
      const event = publication.kind === 'event'
      run(`INSERT INTO opportunities (id,kind,title,subtitle,card,about,city,lat,lng,author_id,roles,date,time,place,organizer,created_at)
        VALUES (?,?,?,?,?,?,'Астана',51.1577,71.4713,?,?,?,?,?,?,?)`,
      id, publication.kind, publication.title, 'Только тестовые данные DEMO', 'DEMO · Пример для знакомства с кабинетом Campus',
      'DEMO · Это учебный пример. Участники, заявки и события этого демо-кабинета вымышлены.', author,
      JSON.stringify([{ title: 'DEMO · Участник', text: 'Учебный пример', tags: ['DEMO'], icon: 'code' }]),
      event ? new Date(origin + 7 * 86_400_000).toISOString().slice(0, 10) : null, event ? '15:00–17:00' : null,
      event ? 'DEMO · Учебная площадка' : null, event ? 'DEMO · Команда' : null, createdAt)
      run('INSERT INTO campus_publications (opportunity_id,campus_id,created_at) VALUES (?,?,?)', id, campusId, createdAt)
      run('INSERT INTO campus_demo_objects (slot,object_key,object_kind,object_id) VALUES (?,?,?,?)', SLOT, `publication:${publication.key}`, 'publication', id)
      run(`INSERT INTO billing_usage (id,user_id,service,opportunity_id,period,funding,unit_price,amount_charged,created_at)
        VALUES (?,?,'publication',?,?,'legacy',0,0,?)`, newId('bu'), author, id, billingPeriod(createdAt), createdAt)
      const projectId = objectId(namespace, 'project', publication.key)
      run('INSERT INTO projects (id,title,text,owner_id,opportunity_id,created_at) VALUES (?,?,?,?,?,?)', projectId, publication.title, 'DEMO · Учебный пример', author, id, createdAt)
      run('INSERT INTO project_members (project_id,user_id) VALUES (?,?)', projectId, author)
      campusAudit(campusId, author, 'publication_created', id)
    }
    for (const [key, applicant, author, day] of [['1', 'verified2', 'verified1', 5], ['2', 'verified1', 'verified2', 3], ['3', 'pending1', 'verified1', 1]] as const) {
      const opportunity = objectId(namespace, 'publication', key), sender = actors.get(applicant)!
      run('INSERT INTO applications (id,opportunity_id,user_id,role,message,created_at) VALUES (?,?,?,?,?,?)',
        objectId(namespace, 'application', key), opportunity, sender, 'DEMO · Участник', 'DEMO · Тестовый отклик для знакомства с кабинетом', ago(day))
      const conversation = ensureDirect(sender, actors.get(author)!, opportunity)
      postMessage(conversation, sender, 'DEMO · Тестовый отклик для знакомства с кабинетом', ago(day))
    }
    for (const key of ['verified1', 'pending2']) run('INSERT INTO attendance (user_id,opportunity_id) VALUES (?,?)', actors.get(key)!, objectId(namespace, 'publication', '4'))
    const grantId = objectId(namespace, 'grant', '1')
    run('INSERT INTO billing_campus_grants (id,user_id,service,quota,valid_from,expires_at,issuer,campus_id,created_at) VALUES (?,?,\'publication\',2,?,?,?,?,?)',
      grantId, actors.get('verified1')!, ago(7), expires, 'DEMO · Учебный подарочный грант', campusId, timestamp)
    run('INSERT INTO campus_demo_objects (slot,object_key,object_kind,object_id) VALUES (?,\'grant:1\',\'grant\',?)', SLOT, grantId)
    campusAudit(campusId, admin, 'grant_created', grantId)
    return existingDemo({ campus_id: campusId, namespace_token: namespace, fixture_version: 1 })
  }, 'IMMEDIATE')
}
