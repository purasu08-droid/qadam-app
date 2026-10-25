import { pathToFileURL } from 'node:url'
import { hashPassword } from './auth.js'
import { db, get, newId, run, tx } from './db.js'
import { hasArchivedFeatureData } from './legacy-data.js'
import { CONVERSATIONS, DEMO_PASSWORD, DEMO_STATE, OPPORTUNITIES, PROJECTS, USERS } from './seed-data.js'

const TABLES = ['publication_requests', 'campus_demo_objects', 'campus_demo_identities', 'campus_demo_registry', 'campus_grant_requests', 'campus_audit', 'campus_publications', 'campus_students', 'campus_admins', 'billing_publication_requests', 'billing_usage', 'billing_campus_grants', 'billing_student_verifications', 'campuses', 'messages', 'conversation_members', 'conversations', 'project_members', 'projects', 'saved', 'attendance', 'applications', 'opportunities', 'sessions', 'users']

// ISO-время для «day дней назад в ЧЧ:ММ» по локальному времени сервера.
function at(day: number, hhmm: string) {
  const [h, m] = hhmm.split(':').map(Number)
  const d = new Date()
  d.setDate(d.getDate() - day)
  d.setHours(h, m, 0, 0)
  return d.toISOString()
}

export function seed({ reset = false } = {}) {
  if (!reset && get('SELECT 1 FROM users LIMIT 1')) return false
  tx(() => {
    if (reset && hasArchivedFeatureData()) throw new Error('Сброс остановлен: база содержит защищённые данные публикаций или Campus. Сохрани её и выбери отдельный DB_PATH для демо.')
    if (reset) for (const t of TABLES) db.exec(`DELETE FROM ${t}`)

    const ids = new Map<string, string>()
    const password = hashPassword(DEMO_PASSWORD)
    for (const u of USERS) {
      const id = newId('u')
      ids.set(u.key, id)
      run(
        `INSERT INTO users (id, email, password_hash, name, role, city, bio, about, avatar, cover, portfolio, skills, interests)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        id, u.email, password, u.name, u.role, u.city, u.bio ?? '', u.about ?? '', u.avatar ?? null, u.cover ?? null,
        u.portfolio ?? null, JSON.stringify(u.skills ?? []), JSON.stringify(u.interests ?? []),
      )
    }
    const user = (key: string) => ids.get(key)!

    // старые публикации идут первыми в списке «сначала новые» — сохраняем порядок макета
    OPPORTUNITIES.forEach((o, i) => {
      run(
        `INSERT INTO opportunities (id, kind, title, subtitle, meta, city, lat, lng, card, about, cta, image, hero, topic, date,
           time, place, program, organizer, stage, online, roles, conditions, author_id, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        o.id, o.kind, o.title, o.subtitle, o.meta, o.city, o.coords[0], o.coords[1], o.card, o.about, o.cta,
        o.image ?? null, o.hero ?? null, o.topic ?? null, o.date ?? null, o.time ?? null, o.place ?? null,
        o.program ? JSON.stringify(o.program) : null, o.organizer ?? null, o.stage ?? null, o.online ? 1 : 0,
        o.roles ? JSON.stringify(o.roles) : null, o.conditions ?? null, o.author ? user(o.author) : null,
        new Date(Date.now() - i * 60_000).toISOString(),
      )
    })

    const projectIds = new Map<string, string>()
    PROJECTS.forEach((p, i) => {
      const id = newId('p')
      projectIds.set(p.key, id)
      run(
        'INSERT INTO projects (id, title, text, cover, status, note, owner_id, opportunity_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        id, p.title, p.text, p.cover, p.status, p.note, user(p.owner), p.opportunity ?? null, new Date(Date.now() - i * 60_000).toISOString(),
      )
      for (const m of [p.owner, ...p.members]) run('INSERT INTO project_members (project_id, user_id) VALUES (?, ?)', id, user(m))
    })

    for (const c of CONVERSATIONS) {
      const id = newId('c')
      run(
        'INSERT INTO conversations (id, type, title, kind, letter, opportunity_id, project_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
        id, c.type, c.title ?? null, c.kind ?? null, c.letter ?? null, c.opportunity ?? null, c.project ? projectIds.get(c.project)! : null,
      )
      const times = c.messages.map((m) => at(m.day, m.at))
      c.messages.forEach((m, i) =>
        run(
          'INSERT INTO messages (id, conversation_id, sender_id, text, file_name, file_size, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
          newId('m'), id, user(m.from), m.text, m.file?.name ?? null, m.file?.size ?? null, times[i],
        ),
      )
      for (const key of c.members) {
        const unread = c.unreadFor?.[key] ?? 0
        const readUpTo = times[times.length - 1 - unread] ?? '1970-01-01T00:00:00.000Z'
        run('INSERT INTO conversation_members (conversation_id, user_id, last_read_at) VALUES (?, ?, ?)', id, user(key), readUpTo)
      }
    }

    const demo = user('zhantore')
    for (const o of DEMO_STATE.attending) run('INSERT INTO attendance (user_id, opportunity_id) VALUES (?, ?)', demo, o)
    for (const o of DEMO_STATE.saved) run('INSERT INTO saved (user_id, opportunity_id) VALUES (?, ?)', demo, o)
    for (const a of DEMO_STATE.applications)
      run('INSERT INTO applications (id, opportunity_id, user_id, role, message) VALUES (?, ?, ?, ?, ?)', newId('a'), a.opportunity, demo, a.role, a.message)
  }, 'IMMEDIATE')
  return true
}

// npm run seed → пересоздать демо-данные
if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  seed({ reset: process.argv.includes('--reset') })
  console.log('Демо-данные загружены.')
}
