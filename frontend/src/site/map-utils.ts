import { CITIES, KIND_ORDER, OTHER_CITIES, type Kind, type Opportunity } from './data'

export type MapFilters = {
  query: string
  kind: Kind | null
  city: string
  onlineOnly: boolean
  view: 'map' | 'list'
  focus: string | null
}

function knownCity(city: string | null | undefined) {
  return city && [...CITIES.map((c) => c.name), ...OTHER_CITIES].includes(city) ? city : null
}

export function matchesMapQuery(item: Opportunity, query: string) {
  const q = query.trim().toLocaleLowerCase('ru-RU')
  return !q || `${item.title} ${item.meta} ${item.card}`.toLocaleLowerCase('ru-RU').includes(q)
}

export function readMapFilters(params: URLSearchParams, savedCity: string, opportunities: Opportunity[]): MapFilters {
  const rawKind = params.get('kind')
  const focus = params.get('focus') || null
  const item = focus ? opportunities.find((o) => o.id === focus) : undefined
  const query = params.get('q') ?? ''
  const kind = KIND_ORDER.includes(rawKind as Kind) ? rawKind as Kind : null
  return {
    query: item && !matchesMapQuery(item, query) ? '' : query,
    kind: item && item.kind !== kind ? null : kind,
    city: item?.city ?? knownCity(params.get('city')) ?? knownCity(savedCity) ?? CITIES[0].name,
    onlineOnly: params.get('online') === '1' && (!item || Boolean(item.online)),
    view: params.get('view') === 'list' ? 'list' : 'map',
    focus,
  }
}

export function canonicalMapParams(params: URLSearchParams, filters: MapFilters) {
  const next = new URLSearchParams(params)
  const fields = { q: filters.query, kind: filters.kind, city: filters.city, online: filters.onlineOnly ? '1' : null, view: filters.view, focus: filters.focus }
  for (const [key, value] of Object.entries(fields)) {
    if (value) next.set(key, value)
    else next.delete(key)
  }
  return next
}

export function filterMapItems(opportunities: Opportunity[], filters: MapFilters) {
  return opportunities.filter((o) => o.city === filters.city && (!filters.kind || o.kind === filters.kind) && (!filters.onlineOnly || o.online) && matchesMapQuery(o, filters.query))
}
