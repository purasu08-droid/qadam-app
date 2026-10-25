import { parseArgs } from 'node:util'
import { pathToFileURL } from 'node:url'
import { z } from 'zod'
import { db, get, newId, run, tx } from './db.js'
import { campusAudit, campusOf } from './campus.js'
import { campusDemoIdentity, campusScopeAllowed } from './campus-demo-policy.js'

function userByEmail(value: unknown) {
  const email = z.string().trim().email().max(200).parse(value)
  const user = get<{ id: string; email: string }>('SELECT id,email FROM users WHERE email=?', email)
  if (!user) throw new Error('Пользователь с таким email не найден; сначала он должен зарегистрироваться')
  return user
}
export function runCampusAdmin(command: string, args: string[]) {
  if (command === 'create') {
    const { values } = parseArgs({ args, options: { name: { type: 'string' }, city: { type: 'string' }, 'admin-email': { type: 'string' } }, strict: true, allowPositionals: false })
    const name = z.string().trim().min(2).max(120).parse(values.name), city = z.string().trim().min(2).max(60).parse(values.city)
    const admin = values['admin-email'] ? userByEmail(values['admin-email']) : null
    if (admin && campusDemoIdentity(admin.id)) throw new Error('Демо-пользователю нельзя выдавать права на реальный Campus')
    return tx(() => {
      const id = newId('campus')
      run('INSERT INTO campuses (id,name,city) VALUES (?,?,?)', id, name, city)
      if (admin) run('INSERT INTO campus_admins (campus_id,user_id) VALUES (?,?)', id, admin.id)
      campusAudit(id, admin?.id ?? null, 'campus_created', id)
      if (admin) campusAudit(id, admin.id, 'admin_granted', admin.id)
      return { campus: campusOf(id)!, admin }
    }, 'IMMEDIATE')
  }
  if (command === 'admin') {
    const { values } = parseArgs({ args, options: { campus: { type: 'string' }, email: { type: 'string' }, grant: { type: 'boolean' }, revoke: { type: 'boolean' } }, strict: true, allowPositionals: false })
    const id = z.string().trim().min(1).max(100).parse(values.campus), user = userByEmail(values.email)
    if (values.grant && values.revoke) throw new Error('Выбери только одно действие: --grant или --revoke')
    return tx(() => {
      if (!campusOf(id)) throw new Error('Campus не найден')
      if (!values.revoke && !campusScopeAllowed(user.id, id)) throw new Error('Демо-стенд изолирован от реальных пользователей и Campus')
      const exists = Boolean(get('SELECT 1 FROM campus_admins WHERE campus_id=? AND user_id=?', id, user.id))
      if (!values.revoke && !exists) {
        run('INSERT INTO campus_admins (campus_id,user_id) VALUES (?,?)', id, user.id)
        campusAudit(id, null, 'admin_granted', user.id)
      }
      if (values.revoke && exists) {
        run('DELETE FROM campus_admins WHERE campus_id=? AND user_id=?', id, user.id)
        campusAudit(id, null, 'admin_revoked', user.id)
      }
      return { campus: campusOf(id)!, user, status: values.revoke ? 'revoked' : 'granted' }
    }, 'IMMEDIATE')
  }
  throw new Error('Команда create --name NAME --city CITY --admin-email EMAIL; admin --campus ID --email EMAIL --grant|--revoke')
}
if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  try { console.log(JSON.stringify(runCampusAdmin(process.argv[2] ?? '', process.argv.slice(3)), null, 2)) }
  catch (error) { console.error(error instanceof Error ? error.message : 'Ошибка Campus'); process.exitCode = 1 }
  finally { db.close() }
}
