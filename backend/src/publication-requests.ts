import { createHash } from 'node:crypto'
import { get, now, run, tx } from './db.js'

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

export type PublicationRequest = { key: string; payloadHash: string; neutralPayloadHash?: string }
type Previous = { payload_hash: string; opportunity_id: string; hash_version?: string }

/** One write transaction owns retry lookup, any billing gate and publication creation. */
export function createPublication(userId: string, opportunityId: string, create: () => void, request?: PublicationRequest): string {
  return tx(() => {
    if (request) {
      const current = get<Previous>('SELECT payload_hash,opportunity_id,hash_version FROM publication_requests WHERE user_id=? AND request_key=?', userId, request.key)
      const previousBilling = get<Previous>('SELECT payload_hash,opportunity_id FROM billing_publication_requests WHERE user_id=? AND request_key=?', userId, request.key)
      const previous = current ?? previousBilling
      if (previous) {
        const currentMatches = !current || current.payload_hash === request.payloadHash || (current.hash_version === 'neutral' && current.payload_hash === request.neutralPayloadHash)
        const billingMatches = !previousBilling || previousBilling.payload_hash === request.payloadHash
        if (!currentMatches || !billingMatches || (current && previousBilling && current.opportunity_id !== previousBilling.opportunity_id))
          throw new PublicationRequestError(409, 'IDEMPOTENCY_CONFLICT', 'Этот ключ уже использован для другой публикации. Сохрани черновик и повтори с новым ключом.')
        if (!get('SELECT 1 FROM opportunities WHERE id=? AND author_id=?', previous.opportunity_id, userId))
          throw new PublicationRequestError(410, 'IDEMPOTENCY_GONE', 'Публикация по этому запросу уже удалена. Повтор запроса не создаёт её заново.')
        return previous.opportunity_id
      }
    }
    create()
    if (request) run("INSERT INTO publication_requests (user_id,request_key,payload_hash,opportunity_id,created_at,hash_version) VALUES (?,?,?,?,?,'v2')", userId, request.key, request.payloadHash, opportunityId, now())
    return opportunityId
  }, 'IMMEDIATE')
}
