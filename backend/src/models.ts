// Строки БД → JSON для фронтенда. Формы совпадают с типами в frontend/src/site/api.ts.
import { all, get } from './db.js'
import { canReadOpportunity } from './legacy-data.js'

export type UserRow = {
  id: string
  email: string
  password_hash: string
  name: string
  role: string
  city: string
  bio: string
  about: string
  avatar: string | null
  cover: string | null
  portfolio: string | null
  skills: string
  interests: string
  created_at: string
}

export type OpportunityRow = {
  id: string
  kind: string
  title: string
  subtitle: string
  meta: string
  city: string
  lat: number
  lng: number
  card: string
  about: string
  cta: string
  image: string | null
  hero: string | null
  topic: string | null
  date: string | null
  time: string | null
  place: string | null
  program: string | null
  organizer: string | null
  stage: string | null
  online: number
  roles: string | null
  conditions: string | null
  author_id: string | null
  created_at: string
}

const json = <T>(s: string | null | undefined, fallback: T): T => {
  if (!s) return fallback
  try {
    return JSON.parse(s) as T
  } catch {
    return fallback
  }
}
const opt = <T>(v: T | null) => v ?? undefined

export function personOf(u: Pick<UserRow, 'id' | 'name' | 'city' | 'avatar' | 'role'>) {
  return { id: u.id, name: u.name, short: u.name.split(' ')[0], city: u.city, avatar: opt(u.avatar), role: u.role || undefined }
}

export function findPerson(id: string | null) {
  if (!id) return undefined
  const u = get<UserRow>('SELECT * FROM users WHERE id = ?', id)
  return u && personOf(u)
}

export function profileOf(u: UserRow, self: boolean) {
  return {
    ...personOf(u),
    email: self ? u.email : undefined,
    bio: u.bio,
    about: u.about,
    cover: opt(u.cover),
    portfolio: opt(u.portfolio),
    skills: json<string[]>(u.skills, []),
    interests: json<string[]>(u.interests, []),
  }
}

export function opportunityOf(o: OpportunityRow, _viewerId?: string) {
  return {
    id: o.id,
    kind: o.kind,
    title: o.title,
    subtitle: o.subtitle,
    meta: o.meta,
    city: o.city,
    coords: [o.lat, o.lng] as [number, number],
    card: o.card,
    about: o.about,
    cta: o.cta,
    image: opt(o.image),
    hero: opt(o.hero),
    topic: opt(o.topic),
    date: opt(o.date),
    time: opt(o.time),
    place: opt(o.place),
    program: json<[string, string][] | undefined>(o.program, undefined),
    organizer: opt(o.organizer),
    stage: opt(o.stage),
    online: Boolean(o.online),
    roles: json<unknown[] | undefined>(o.roles, undefined),
    conditions: opt(o.conditions),
    author: findPerson(o.author_id),
    createdAt: o.created_at,
  }
}

export function opportunitiesByIds(ids: string[], viewerId?: string) {
  if (!ids.length) return []
  return all<OpportunityRow>(`SELECT * FROM opportunities WHERE id IN (${ids.map(() => '?').join(',')})`, ...ids)
    .filter((o) => canReadOpportunity(o.id, viewerId)).map((o) => opportunityOf(o, viewerId))
}
