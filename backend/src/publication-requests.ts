import { createHash } from 'node:crypto'
import { get, now, run, tx } from './db.js'
import { hasLegacyTable } from './legacy-data.js'

export class PublicationRequestError extends Error {
  constructor(public status: number, public code: string, message: string) { super(message) }
}

function canonicalPayload(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalPayload)
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>
    return Object.fromEntries(Object.keys(record).sort().filter((key) => record[key] !== undefined)
      .map((key) => [key, canonicalPayload(record[key])]))
  }
  return value
}

export function publicationPayloadHash(parsedBody: Record<string, unknown>) {
  return createHash('sha256').update(JSON.stringify(canonicalPayload(parsedBody))).digest('hex')
}

type PublicationRequest = { key: string; payloadHash: string; legacyPayloadHash?: string }
type Previous = { payload_hash: string; opportunity_id: string }

/** A free publication and its retry key commit atomically; no quota or payment state is involved. */
export function createPublication(userId: string, opportunityId: string, create: () => void, request?: PublicationRequest): string {
  return tx(() => {
    if (request) {
      const current = get<Previous>('SELECT payload_hash,opportunity_id FROM publication_requests WHERE user_id=? AND request_key=?', userId, request.key)
      const archived = !current && hasLegacyTable('billing_publication_requests')
        ? get<Previous>('SELECT payload_hash,opportunity_id FROM billing_publication_requests WHERE user_id=? AND request_key=?', userId, request.key)
        : undefined
      const previous = current ?? archived
      if (previous) {
        if (previous.payload_hash !== request.payloadHash && !(archived && previous.payload_hash === request.legacyPayloadHash))
          throw new PublicationRequestError(409, 'IDEMPOTENCY_CONFLICT', 'Этот ключ уже использован для другой публикации. Сохрани черновик и повтори с новым ключом.')
        if (!get('SELECT 1 FROM opportunities WHERE id=? AND author_id=?', previous.opportunity_id, userId))
          throw new PublicationRequestError(410, 'IDEMPOTENCY_GONE', 'Публикация по этому запросу уже удалена. Повтор запроса не создаёт её заново.')
        return previous.opportunity_id
      }
    }
    create()
    if (request) run('INSERT INTO publication_requests (user_id,request_key,payload_hash,opportunity_id,created_at) VALUES (?,?,?,?,?)', userId, request.key, request.payloadHash, opportunityId, now())
    return opportunityId
  }, 'IMMEDIATE')
}
