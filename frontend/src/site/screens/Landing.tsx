import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { ArrowRight, ArrowUpRight, ChevronDown, ChevronRight, List, Map as MapIcon, MapPin, Search, SlidersHorizontal } from 'lucide-react'
import { CITIES, FAQ, KIND_ORDER, KINDS, OTHER_CITIES } from '../data'
import { useSite } from '../state'
import { IconTile, OppCard, kindStyle } from '../components/ui'
import SiteMap from '../components/SiteMap'
import { PricingTeaser } from '../components/Billing'
import { useTheme } from '../theme'
import { useI18n } from '../i18n'
import { useIsDesktop } from '../../useIsDesktop'

export default function Landing() {
  const desktop = useIsDesktop()
  const { t } = useI18n()
  const nav = useNavigate()
  const { hash } = useLocation()
  const { theme } = useTheme()
  const { city, setCity, opportunities, opportunitiesLoading, loadError } = useSite()
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(0)

  useEffect(() => {
    if (hash) document.getElementById(hash.slice(1))?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [hash])

  const search = (e?: FormEvent) => {
    e?.preventDefault()
    const p = new URLSearchParams()
    p.set('city', city)
    p.set('view', 'list')
    if (query.trim()) p.set('q', query.trim())
    nav(`/map?${p}`)
  }

  const cityInfo = CITIES.find((c) => c.name === city) ?? CITIES[0]
  const nearby = useMemo(() => opportunities.filter((o) => o.city === cityInfo.name).sort((a, b) => (Date.parse(b.createdAt ?? '') || 0) - (Date.parse(a.createdAt ?? '') || 0)), [opportunities, cityInfo.name])
  const featured = nearby.slice(0, 4)
  const mapLink = (extra: Record<string, string> = {}) => `/map?${new URLSearchParams({ city: cityInfo.name, view: 'map', ...extra })}`

  return (
    <div className={`page landing ${hash === '#faq' ? 'mobile-show-faq' : ''}`}>
      <section className="mobile-home mobile-original-only" aria-label={t('Категории')}>
        <form className="mobile-home-search" onSubmit={search}>
          <input aria-label={t('Поиск возможностей')} placeholder={t('Что хочешь найти?')} value={query} onChange={(event) => setQuery(event.target.value)} />
          <button type="submit" aria-label={t('Найти')}><Search size={18} /></button>
        </form>
        <nav className="mobile-home-segments" aria-label={t('Категории и карта')}>
          <span aria-current="page">{t('Категории')}</span>
          <Link to={mapLink()}>{t('Карта')}</Link>
        </nav>
        <div className="mobile-category-stack">
          {KIND_ORDER.map((kind) => (
            <Link key={kind} className={`mobile-category-band mobile-band-${kind}`} to={mapLink({ kind, view: 'list' })}>
              <h2>{t(KINDS[kind].plural)}</h2>
              <span className="mobile-category-count"><b>{opportunitiesLoading || loadError ? '—' : nearby.filter((item) => item.kind === kind).length}</b><small>{t('Публикации')}</small></span>
              <ChevronRight size={28} aria-hidden="true" />
            </Link>
          ))}
        </div>
        <div className="mobile-home-links">
          <Link to="/projects">{t('Мои проекты')}</Link>
        </div>
      </section>
      <section className="hero">
        <img key={theme} className="hero-image" src={theme === 'light' ? '/img/hero-qadam-light.png' : '/img/hero-qadam-green.png'} width="2231" height="705" alt="" aria-hidden="true" loading="eager" />
        <div className="hero-text">
          <span className="eyebrow-mono">{t("КАЗАХСТАН ·")} {CITIES.length + OTHER_CITIES.length} {t("ГОРОДОВ")}</span>
          <h1 className="wordmark">QADAM</h1>
          <p>{t("От идеи — к первому шагу.")}<br />{t("Находи единомышленников, присоединяйся к проектам и встречайся на событиях.")}</p>
        </div>
      </section>

      <form className="searchbar" onSubmit={search}>
        <label className="sb-q">
          <Search size={22} />
          <input placeholder={t("Что хочешь найти?")} value={query} onChange={(e) => setQuery(e.target.value)} />
        </label>
        <label className="sb-city">
          <MapPin size={18} />
          <select value={city} onChange={(e) => setCity(e.target.value)}>
            {CITIES.map((c) => <option key={c.name} value={c.name}>{t(c.name)}</option>)}
          </select>
          <ChevronDown size={16} />
        </label>
        <button className="btn lime" type="submit">{t("Найти")}</button>
        <Link to={mapLink({ filters: '1' })} className="btn icon outline" aria-label={t("Фильтры")}><SlidersHorizontal size={20} /></Link>
      </form>

      <section id="categories" className="sec">
        <span className="eyebrow">{t("01 / НАЙДИ СВОЁ")}</span>
        <h2>{t("Выбери, с чего начать")}</h2>
        <p className="sec-sub">{t("Люди, идеи и возможности рядом с тобой.")}</p>
        <div className="cats">
          {KIND_ORDER.map((k) => (
            <Link key={k} to={mapLink({ kind: k })} className="cat" style={kindStyle(k)}>
              <IconTile kind={k} size={64} />
              <ArrowRight className="cat-arrow" size={22} />
              <h3>{t(KINDS[k].plural)}</h3>
              <p>{t(KINDS[k].hint)}</p>
            </Link>
          ))}
        </div>
      </section>

      <section className="sec">
        <div className="sec-row">
          <div>
            <h2 className="h-md">{t("Возможности рядом")}</h2>
            <p className="sec-sub">{t("Найди то, с чего начнётся твоя история")}</p>
          </div>
          <div className="seg">
            <Link className="on" to={mapLink({ view: 'list' })}><List size={17} /> {t("Список")}</Link>
            <Link to={mapLink()}><MapIcon size={17} /> {t("Карта")}</Link>
          </div>
        </div>
        <div className="grid4">
          {featured.map((o) => <OppCard key={o.id} o={o} />)}
        </div>
        {featured.length === 0 && <p className="empty" role="status">{opportunitiesLoading ? t("Загружаем возможности…") : loadError ? t("Не удалось загрузить возможности. Повтори загрузку выше.") : t('В городе {city} пока нет публикаций. Создай первую или выбери другой город.', {city:t(cityInfo.name)})}</p>}
      </section>

      <section className="sec">
        <div className="sec-row">
          <div>
            <span className="eyebrow">{t("02 / РЯДОМ С ТОБОЙ")}</span>
            <h2>{t("Твой город. Твои люди.")}</h2>
            <p className="sec-sub">{t("Посмотри, что происходит поблизости.")}</p>
          </div>
          <Link to={mapLink()} className="btn outline-purple">{t("Открыть карту")} <ArrowUpRight size={18} /></Link>
        </div>
        <div className="city-split">
          <div className="city-map">
            <SiteMap
              items={nearby}
              center={cityInfo.coords}
              zoom={12}
              label={cityInfo.name}
              variant="square"
              controls="zoom-left"
              onSelect={(o) => nav(`/p/${o.id}`)}
            />
          </div>
          <div className="city-pick">
            <h3>{t("Выбери город")}</h3>
            {CITIES.map((c) => (
              <button key={c.name} className={c.name === city ? 'on' : ''} onClick={() => setCity(c.name)}>
                <i className="radio" /> {t(c.name)} <ArrowRight size={18} />
              </button>
            ))}
          </div>
        </div>
      </section>

      {desktop && <PricingTeaser />}

      <section id="faq" className="sec">
        <span className="eyebrow">03 / FAQ</span>
        <h2>{t("Частые вопросы")}</h2>
        <div className="faq">
          {FAQ.map((f, i) => (
            <div key={f.q} className={`faq-item ${open === i ? 'open' : ''}`}>
              <button onClick={() => setOpen(open === i ? -1 : i)} aria-expanded={open === i}>
                <span className="grow">{t(f.q)}</span>
                <ChevronDown size={20} />
              </button>
              {open === i && <p>{t(f.a, {cities:CITIES.map((c)=>t(c.name)).join(', ')})}</p>}
            </div>
          ))}
        </div>
      </section>

      <footer className="foot">
        <span>{t("© 2026 QADAM · Казахстан")}</span>
        {desktop && <Link to="/pricing">{t("Тарифы и Qadam Campus")}</Link>}
        <span className="muted">{t("Маленькие шаги, большие перемены")}</span>
      </footer>
    </div>
  )
}
