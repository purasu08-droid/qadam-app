export function legacyTarget(to: string, options: { search?: string; hash?: string; id?: string; list?: boolean } = {}) {
  const params = new URLSearchParams(options.search)
  const oldKind = params.get('category')
  const kinds: Record<string, string> = { meetups: 'meetup', jobs: 'job', ideas: 'idea', events: 'event' }
  if (oldKind && kinds[oldKind]) { params.set('kind', kinds[oldKind]); params.delete('category') }
  if (options.list && !params.has('view')) params.set('view', 'list')
  return { pathname: options.id ? `${to}/${encodeURIComponent(options.id)}` : to, search: params.toString(), hash: options.hash ?? '' }
}
