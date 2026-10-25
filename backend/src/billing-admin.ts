import { parseArgs } from 'node:util'
import { pathToFileURL } from 'node:url'
import { z } from 'zod'
import { BILLING_SERVICES } from './billing.js'
import { db, get, newId, run } from './db.js'

const Email = z.string().trim().email('Укажи существующий email').max(200)
const Instant = z.string().datetime({ offset: true, message: 'Нужна ISO-дата с часовым поясом: 2027-01-01T00:00:00+05:00' })

function futureExpiry(value: unknown, timestamp: string) {
  const iso = Instant.parse(value)
  const normalized = new Date(iso).toISOString()
  if (normalized <= timestamp) throw new Error('Срок действия должен быть в будущем')
  return normalized
}

function existingUser(email: string) {
  const user = get<{ id: string; email: string }>('SELECT id, email FROM users WHERE email = ?', email)
  if (!user) throw new Error('Пользователь с таким email не найден; сначала он должен зарегистрироваться')
  return user
}

/** Trusted local administration only. This function is never mounted as an HTTP route. */
export function runBillingAdmin(command: string, args: string[]) {
  const timestamp = new Date().toISOString()
  if (command === 'student') {
    const { values } = parseArgs({ args, options: {
      email: { type: 'string' }, source: { type: 'string' }, expires: { type: 'string' },
      'verified-by': { type: 'string' }, revoke: { type: 'boolean', default: false },
    }, strict: true, allowPositionals: false })
    const user = existingUser(Email.parse(values.email))
    if (values.revoke) {
      if (values.source || values.expires || values['verified-by']) throw new Error('Для отзыва укажи только --email и --revoke')
      run('DELETE FROM billing_student_verifications WHERE user_id = ?', user.id)
      return { status: 'revoked', email: user.email }
    }
    const source = z.enum(['admin', 'university']).parse(values.source)
    const verifiedBy = z.string().trim().min(2).max(120).parse(values['verified-by'] ?? `local-cli:${source}`)
    const expiresAt = values.expires ? futureExpiry(values.expires, timestamp) : null
    run(`INSERT INTO billing_student_verifications (user_id, source, verified_by, verified_at, expires_at) VALUES (?, ?, ?, ?, ?)
      ON CONFLICT (user_id) DO UPDATE SET source = excluded.source, verified_by = excluded.verified_by,
        verified_at = excluded.verified_at, expires_at = excluded.expires_at`,
    user.id, source, verifiedBy, timestamp, expiresAt)
    return { status: 'verified', email: user.email, source, verifiedBy, expiresAt }
  }
  if (command === 'grant') {
    const { values } = parseArgs({ args, options: {
      email: { type: 'string' }, service: { type: 'string' }, quota: { type: 'string' },
      expires: { type: 'string' }, starts: { type: 'string' }, campus: { type: 'string' },
    }, strict: true, allowPositionals: false })
    const user = existingUser(Email.parse(values.email))
    const service = z.enum(BILLING_SERVICES).parse(values.service)
    const quota = z.coerce.number().int().min(1).max(100_000).parse(values.quota)
    const expiresAt = futureExpiry(values.expires, timestamp)
    const validFrom = values.starts ? new Date(Instant.parse(values.starts)).toISOString() : timestamp
    if (expiresAt <= validFrom) throw new Error('Срок окончания должен быть позже начала действия')
    const issuer = z.string().trim().min(2).max(120).parse(values.campus)
    const id = newId('cg')
    run('INSERT INTO billing_campus_grants (id, user_id, service, quota, valid_from, expires_at, issuer) VALUES (?, ?, ?, ?, ?, ?, ?)',
      id, user.id, service, quota, validFrom, expiresAt, issuer)
    return { status: 'granted', id, email: user.email, service, quota, validFrom, expiresAt, issuer }
  }
  throw new Error('Команда: student --email EMAIL --source admin|university [--expires ISO] [--verified-by NAME]; student --email EMAIL --revoke; grant --email EMAIL --service publication|promotion3|promotion7 --quota N --expires ISO --campus NAME')
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  try {
    console.log(JSON.stringify(runBillingAdmin(process.argv[2] ?? '', process.argv.slice(3)), null, 2))
  } catch (error) {
    console.error(error instanceof Error ? error.message : 'Не удалось изменить статус')
    process.exitCode = 1
  } finally {
    db.close()
  }
}
