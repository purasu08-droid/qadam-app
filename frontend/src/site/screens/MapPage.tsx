import { useCallback, useEffect, useMemo, useRef } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ArrowRight, CalendarDays, ChevronRight, List, Map as MapIcon, MapPin, Search, SlidersHorizontal, X } from 'lucide-react'
import { CITIES, KIND_ORDER, KINDS, formatEventDate, type Opportunity } from '../data'
import { useSite } from '../state'
import { IconTile, KindBadge, KindIcon, OppCard, kindStyle } from '../components/ui'
import SiteMap from '../components/SiteMap'
import { canonicalMapParams, filterMapItems, readMapFilters } from '../map-utils'
import { useI18n } from '../i18n'

export default function MapPage() {
  const { t, language } = useI18n()
  const [params, setParams] = useSearchParams()
  const { city: savedCity, setCity, opportunities, opportunitiesLoading, loadError } = useSite()
  const filters = params.get('filters') === '1'
  const state = readMapFilters(params, savedCity, opportunities)
  const { city, query, kind, onlineOnly, view, focus: selected } = state
  const focused = opportunities.find((o) => o.id === selected)
  const search = params.toString()
  const previous = useRef<{ search: string; city: string } | null>(null)

  useEffect(() => {
    const before = previous.current
    // Header changes the shared city; browser navigation changes the URL.
    if (before && before.search === search && before.city !== savedCity) {
      const next = new URLSearchParams(params)
      next.set('city', savedCity)
      next.delete('focus')
      previous.current = { search: next.toString(), city: savedCity }
      setParams(next)
      return
    }
    const next = canonicalMapParams(params, state)
    previous.current = { search: next.toString(), city }
    if (next.toString() !== search) setParams(next, { replace: true })
    if (savedCity !== city) setCity(city)
  }, [search, savedCity, city, query, kind, onlineOnly, view, selected, setParams, setCity]) // eslint-disable-line react-hooks/exhaustive-deps

  const set = useCallback((key: string, value: string | null, replace = false) => {
    const p = new URLSearchParams(params)
    if (['city', 'kind', 'q', 'online'].includes(key)) p.delete('focus')
    if (value) p.set(key, value)
    else p.delete(key)
    setParams(p, { replace })
  }, [params, setParams])

  const cityCenter = CITIES.find((c) => c.name === city)?.coords ?? opportunities.find((o) => o.city === city)?.coords ?? CITIES[0].coords
  const center = focused?.coords ?? cityCenter
  const items = useMemo(() => filterMapItems(opportunities, state), [opportunities, city, kind, onlineOnly, query]) // eslint-disable-line react-hooks/exhaustive-deps

  const onSelect = useCallback((o: Opportunity) => set('focus', o.id), [set])
  const popup = useCallback(
    (o: Opportunity) => (
      <div className="pop-card">
        <button className="pop-x" onClick={() => set('focus', null)} aria-label={t('Закрыть')}><X size={18} /></button>
        <KindBadge kind={o.kind} />
        <h4>{o.title}</h4>
        <p><CalendarDays size={15} /> {o.date ? `${formatEventDate(o.date)}${o.time ? ` · ${o.time.split('–')[0]}` : ''}` : o.meta}</p>
        <p><MapPin size={15} /> {o.place ?? o.subtitle} · {t(o.city)}</p>
        <Link to={`/p/${o.id}`} className="btn lime sm dblock">
          {t(o.kind === 'event' ? 'Открыть событие' : 'Открыть')} <ArrowRight size={16} />
        </Link>
      </div>
    ),
    [set, language],
  )

  return (
    <div className="page wide mappage">
      <div className="map-toolbar">
        <h1>{t('Возможности рядом')}</h1>
        <label className="tb-search">
          <MapPin size={18} />
          <input aria-label={t('Поиск возможностей')} placeholder={t('{city}: что ищем?', { city: t(city) })} value={query} onChange={(e) => set('q', e.target.value, true)} />
          <Search size={18} />
        </label>
        <button className={`btn outline ${filters ? 'on' : ''}`} aria-expanded={filters} onClick={() => set('filters', filters ? null : '1')}><SlidersHorizontal size={18} /> {t('Фильтры')}</button>
        <div className="kind-chips">
          <button className={!kind ? 'on' : ''} onClick={() => set('kind', null)}>{t('Все')}</button>
          {KIND_ORDER.map((k) => (
            <button key={k} className={kind === k ? 'on' : ''} data-kind={k} style={kindStyle(k)} onClick={() => set('kind', kind === k ? null : k)}>
              <KindIcon kind={k} size={17} /> {t(KINDS[k].plural)}
            </button>
          ))}
        </div>
        <div className="seg">
          <button className={view === 'list' ? 'on' : ''} onClick={() => set('view', 'list')}><List size={17} /> {t('Список')}</button>
          <button className={view === 'map' ? 'on' : ''} onClick={() => set('view', 'map')}><MapIcon size={17} /> {t('Карта')}</button>
        </div>
      </div>

      {filters && (
        <div className="filter-row">
          <span className="muted">{t('Город:')}</span>
          {CITIES.map((c) => (
            <button key={c.name} className={`chip ${c.name === city ? 'on' : ''}`} onClick={() => set('city', c.name)}>{t(c.name)}</button>
          ))}
          {!CITIES.some((c) => c.name === city) && <span className="chip on">{t(city)}</span>}
          <label className="cbx">
            <input type="checkbox" checked={onlineOnly} onChange={(e) => set('online', e.target.checked ? '1' : null)} />
            <i /> {t('Можно участвовать онлайн')}
          </label>
        </div>
      )}

      {selected && !focused && !opportunitiesLoading && !loadError && <p className="empty" role="status">{t('Эта публикация больше недоступна.')} <button className="link-purple" onClick={() => set('focus', null)}>{t('Показать другие')}</button></p>}

      {view === 'list' ? (
        <>
          <div className="grid4">{items.map((o) => <OppCard key={o.id} o={o} />)}</div>
          {items.length === 0 && <Empty loading={opportunitiesLoading} error={loadError} />}
        </>
      ) : (
        <div className="map-split">
          <aside className="panel map-list">
            <h2>{t('На карте')}</h2>
            <p className="muted">{t('{city} · {count} публикаций', { city: t(city), count: items.length })}</p>
            <ul>
              {items.map((o) => (
                <li key={o.id}>
                  <button className={selected === o.id ? 'on' : ''} onClick={() => onSelect(o)}>
                    <IconTile kind={o.kind} size={44} />
                    <span className="grow">
                      <b>{o.title}</b>
                      <span className="ml-meta"><KindBadge kind={o.kind} /> {o.meta}</span>
                    </span>
                    <ChevronRight size={18} />
                  </button>
                </li>
              ))}
            </ul>
            {items.length === 0 && <Empty loading={opportunitiesLoading} error={loadError} />}
          </aside>
          <div className="panel map-box">
            <SiteMap items={items} center={center} zoom={13} selected={selected} onSelect={onSelect} popup={popup} />
          </div>
        </div>
      )}
    </div>
  )
}

function Empty({ loading, error }: { loading: boolean; error: string | null }) {
  const { t } = useI18n()
  if (loading) return <p className="empty" role="status">{t('Загружаем возможности…')}</p>
  if (error) return <p className="empty">{t('Не удалось загрузить возможности. Повтори загрузку выше.')}</p>
  return <p className="empty">{t('Пока ничего не нашлось. Попробуй другой фильтр или город.')}</p>
}
