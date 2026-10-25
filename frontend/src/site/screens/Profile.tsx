import { useEffect, useId, useRef, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowRight, ExternalLink, MapPin, MessageCircle, Plus, Settings, X } from 'lucide-react'
import { api, type Profile as ProfileT } from '../api'
import { CITIES, OTHER_CITIES, type Opportunity } from '../data'
import { useApi, useSite } from '../state'
import { Avatar, Cover, KindBadge } from '../components/ui'
import { useI18n } from '../i18n'
import { useIsDesktop } from '../../useIsDesktop'

type ProfileData = { profile: ProfileT; publications: Opportunity[] }
type Row = { item: Opportunity; note: string }

const TABS = ['Публикации', 'Мои заявки', 'Сохранённое'] as const

export default function Profile() {
  const { id } = useParams()
  const { authVersion } = useSite()
  return <ProfileView key={`${authVersion}:${id ?? 'self'}`} />
}

function ProfileView() {
  const desktop = useIsDesktop()
  const { t, locale } = useI18n()
  const { id } = useParams()
  const { user, setUser } = useSite()
  const nav = useNavigate()
  const self = !id || id === user?.id
  const data = useApi<ProfileData>(self ? '/users/me' : `/users/${id}`)
  const activity = useApi<{ requests: Row[]; saved: Row[] }>(self && user ? '/users/me/activity' : null)
  const [tab, setTab] = useState<(typeof TABS)[number]>('Публикации')
  const [editing, setEditing] = useState(false)
  const [writing, setWriting] = useState(false)
  const [writeError, setWriteError] = useState<string | null>(null)
  const writePending = useRef(false)
  const writeController = useRef<AbortController | null>(null)
  const mounted = useRef(false)

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
      writeController.current?.abort()
    }
  }, [])

  if (!data.data) return <div className="page"><p className="empty" role="status">{data.error ? <>{t(data.error)} <button className="link-purple" onClick={data.reload}>{t('Повторить')}</button></> : t('Загрузка…')}</p></div>
  const { profile: p, publications } = data.data
  const portfolioHref = safePortfolio(p.portfolio)
  const activityTab = self && tab !== 'Публикации'

  const rows: Row[] =
    tab === 'Публикации'
      ? publications.map((o) => ({ item: o, note: o.kind === 'event' ? o.meta : o.subtitle }))
      : tab === 'Мои заявки'
        ? activity.data?.requests ?? []
        : activity.data?.saved ?? []

  const write = async () => {
    if (writePending.current) return
    if (!user) return nav(desktop ? '/signin' : '/account/signin', { state: { from: `/u/${p.id}` } })
    writePending.current = true
    setWriting(true)
    setWriteError(null)
    const controller = new AbortController()
    writeController.current = controller
    try {
      const { id: convId } = await api.post<{ id: string }>('/conversations/direct', { userId: p.id }, { signal: controller.signal })
      if (mounted.current) nav(`/chats/${convId}`)
    } catch (error) {
      if (mounted.current && !controller.signal.aborted) setWriteError((error as Error).message)
    } finally {
      writePending.current = false
      if (mounted.current) setWriting(false)
    }
  }

  return (
    <div className="page profile">
      {data.error && <p className="err" role="alert">{t(data.error)} <button className="link-purple" onClick={data.reload}>{t('Повторить загрузку профиля')}</button></p>}
      <section className="pf-top">
        <img className="pf-cover" src={p.cover ?? '/img/profile-cover.jpg'} alt="" />
        <span className="pf-avatar-wrap"><Avatar person={p} size={178} /></span>
        <div className="pf-id">
          <h1>{p.name}</h1>
          {p.role && <p className="purple-sub">{p.role}</p>}
          <p><MapPin size={17} /> {t(p.city)}</p>
          {p.bio && <p className="pf-bio">{p.bio}</p>}
        </div>
        <div className="pf-actions">
          <div className="row">
            {self ? (
              <>
                <button className="btn outline" onClick={() => setEditing(true)}>{t('Редактировать профиль')}</button>
                <button className="btn outline icon" aria-label={t('Настройки')} onClick={() => setEditing(true)}><Settings size={20} /></button>
              </>
            ) : (
              <button className="btn lime" onClick={() => { void write() }} disabled={writing}><MessageCircle size={18} /> {t(writing ? 'Открываем чат…' : writeError ? 'Повторить' : 'Написать')}</button>
            )}
          </div>
          {self && p.email && <small className="muted">{p.email}</small>}
          {writeError && <p className="err" role="alert">{t(writeError)}</p>}
        </div>
      </section>

      <dl className="mobile-original-only mobile-original-stats">
        <div><dt>{t('Публикации')}</dt><dd>{publications.length.toLocaleString(locale)}</dd></div>
        {self && <>
          <div><dt>{t('Мои заявки')}</dt><dd>{activity.data ? activity.data.requests.length.toLocaleString(locale) : '—'}</dd></div>
          <div><dt>{t('Сохранённое')}</dt><dd>{activity.data ? activity.data.saved.length.toLocaleString(locale) : '—'}</dd></div>
        </>}
      </dl>

      <div className="pf-grid">
        <aside className="panel pf-about">
          <h2>{t('Обо мне')}</h2>
          <p>{p.about || t(self ? 'Расскажи о себе — нажми «Редактировать профиль».' : 'Пользователь пока ничего не рассказал о себе.')}</p>
          {p.skills.length > 0 && (
            <>
              <hr />
              <h2>{t('Навыки')}</h2>
              <div className="chips">{p.skills.map((s) => <span key={s} className="chip lime">{s}</span>)}</div>
            </>
          )}
          {p.interests.length > 0 && (
            <>
              <hr />
              <h2>{t('Интересы')}</h2>
              <div className="chips">{p.interests.map((s) => <span key={s} className="chip purple">{s}</span>)}</div>
            </>
          )}
          {portfolioHref && (
            <>
              <hr />
              <h2>{t('Портфолио')}</h2>
              <a className="btn outline dblock between" href={portfolioHref} target="_blank" rel="noopener noreferrer">
                <span className="row"><ExternalLink size={18} /> {t('Посмотреть работы')}</span> <ArrowRight size={18} />
              </a>
            </>
          )}
        </aside>

        <section className="panel pf-main">
          <nav className="tabs">
            {(self ? TABS : (['Публикации'] as const)).map((label) => (
              <button key={label} className={tab === label ? 'on' : ''} aria-pressed={tab === label} onClick={() => setTab(label)}>{t(label)}</button>
            ))}
          </nav>
          <div className="row between pf-sub">
            <h2>{t(tab === 'Публикации' ? (self ? 'Мои публикации' : 'Публикации') : tab)}</h2>
            {self && tab === 'Публикации' && <Link to="/create" className="link-purple"><Plus size={18} /> {t('Создать публикацию')}</Link>}
          </div>
          <div className="pub-grid">
            {rows.map(({ item: o, note }) => (
              <article key={`${o.id}-${note}`} className="pub">
                <Link to={`/p/${o.id}`} className="pub-img"><Cover o={o} /></Link>
                <div className="pub-body">
                  <KindBadge kind={o.kind} solid />
                  <h3>{o.title}</h3>
                  <p>{note}</p>
                  <Link to={`/p/${o.id}`} className="btn outline xs">{t('Открыть')} <ArrowRight size={14} /></Link>
                </div>
              </article>
            ))}
          </div>
          {activityTab && activity.error && <p className="err" role="alert">{t(activity.error)} <button className="link-purple" onClick={activity.reload}>{t('Повторить')}</button></p>}
          {activityTab && activity.loading && !activity.data && <p className="empty" role="status">{t('Загрузка…')}</p>}
          {rows.length === 0 && !(activityTab && (activity.loading || activity.error)) && (
            <p className="empty">
              {t(tab === 'Публикации' ? 'Публикаций пока нет.' : tab === 'Мои заявки' ? 'Заявок пока нет.' : 'Здесь пока пусто.')} {' '}
              {self && <Link to={tab === 'Публикации' ? '/create' : '/map'} className="link-purple">{t(tab === 'Публикации' ? 'Создать публикацию' : 'Найти возможности')}</Link>}
            </p>
          )}
        </section>
      </div>

      {editing && (
        <EditProfile
          p={p}
          onClose={() => setEditing(false)}
          onSaved={(d) => {
            data.setData(d)
            setUser(d.profile)
            setEditing(false)
          }}
        />
      )}
    </div>
  )
}

const list = (s: string) => s.split(',').map((x) => x.trim()).filter(Boolean)

function safePortfolio(value?: string) {
  if (!value?.trim()) return null
  try {
    const url = new URL(value.trim())
    return (url.protocol === 'https:' || url.protocol === 'http:') && url.hostname ? url.href : null
  } catch {
    return null
  }
}

function EditProfile({ p, onClose, onSaved }: { p: ProfileT; onClose: () => void; onSaved: (d: ProfileData) => void }) {
  const { t } = useI18n()
  const titleId = useId()
  const errorId = useId()
  const portfolioHintId = useId()
  const dialog = useRef<HTMLDialogElement>(null)
  const nameInput = useRef<HTMLInputElement>(null)
  const portfolioInput = useRef<HTMLInputElement>(null)
  const skillsInput = useRef<HTMLInputElement>(null)
  const interestsInput = useRef<HTMLInputElement>(null)
  const mounted = useRef(false)
  const inFlight = useRef(false)
  const controller = useRef<AbortController | null>(null)
  const [f, setF] = useState({
    name: p.name,
    role: p.role ?? '',
    city: p.city,
    bio: p.bio,
    about: p.about,
    portfolio: p.portfolio ?? '',
    skills: p.skills.join(', '),
    interests: p.interests.join(', '),
  })
  const [error, setError] = useState<string | null>(null)
  const [invalid, setInvalid] = useState<'name' | 'portfolio' | 'skills' | 'interests' | null>(null)
  const [busy, setBusy] = useState(false)
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => {
    setF((s) => ({ ...s, [k]: e.target.value }))
    if (invalid === k) { setInvalid(null); setError(null) }
  }

  useEffect(() => {
    mounted.current = true
    const node = dialog.current
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    if (node && !node.open) node.showModal()
    nameInput.current?.focus({ preventScroll: true })
    return () => {
      mounted.current = false
      controller.current?.abort()
      if (node?.open) node.close()
      document.body.style.overflow = previousOverflow
      if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true })
    }
  }, [])

  const close = () => { if (!inFlight.current) onClose() }
  const fail = (field: NonNullable<typeof invalid>, message: string) => {
    setInvalid(field)
    setError(message)
    const input = { name: nameInput, portfolio: portfolioInput, skills: skillsInput, interests: interestsInput }[field]
    input.current?.focus()
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (inFlight.current) return
    const skills = list(f.skills)
    const interests = list(f.interests)
    if (f.name.trim().length < 2) return fail('name', 'Имя — минимум 2 символа.')
    if (f.portfolio.trim() && !safePortfolio(f.portfolio)) return fail('portfolio', 'Укажи полную ссылку на портфолио с http:// или https://.')
    if (skills.length > 20 || skills.some((s) => s.length > 40)) return fail('skills', 'Добавь до 20 навыков, каждый — до 40 символов.')
    if (interests.length > 20 || interests.some((s) => s.length > 40)) return fail('interests', 'Добавь до 20 интересов, каждый — до 40 символов.')
    inFlight.current = true
    setBusy(true)
    setError(null)
    setInvalid(null)
    const request = new AbortController()
    controller.current = request
    try {
      const saved = await api.patch<ProfileData>('/users/me', {
        ...f, name: f.name.trim(), portfolio: f.portfolio.trim(), skills, interests,
      }, { signal: request.signal })
      if (mounted.current) onSaved(saved)
    } catch (err) {
      if (mounted.current && !request.signal.aborted) setError((err as Error).message)
    } finally {
      inFlight.current = false
      if (mounted.current) setBusy(false)
    }
  }

  return (
    <dialog
      ref={dialog}
      className="modal-back"
      aria-labelledby={titleId}
      style={{ margin: 0, width: '100%', height: '100%', maxWidth: 'none', maxHeight: 'none', border: 0, color: 'inherit' }}
      onCancel={(e) => { e.preventDefault(); close() }}
      onMouseDown={(e) => { if (e.target === e.currentTarget) close() }}
    >
      <form className="panel modal" onSubmit={(e) => { void submit(e) }} noValidate aria-busy={busy} aria-describedby={error ? errorId : undefined}>
        <div className="row between">
          <h2 id={titleId}>{t('Редактировать профиль')}</h2>
          <button type="button" className="icon-btn" onClick={close} aria-label={t('Закрыть')} disabled={busy}><X size={20} /></button>
        </div>
        <fieldset disabled={busy} style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>
        <div className="two">
          <label className="fld"><span>{t('Имя')}</span><input ref={nameInput} autoComplete="name" value={f.name} onChange={set('name')} required minLength={2} maxLength={80} aria-invalid={invalid === 'name'} aria-describedby={invalid === 'name' ? errorId : undefined} /></label>
          <label className="fld"><span>{t('Роль')}</span><input value={f.role} onChange={set('role')} placeholder={t('UI/UX-дизайнер')} maxLength={80} /></label>
          <label className="fld">
            <span>{t('Город')}</span>
            <span className="select">
              <select value={f.city} onChange={set('city')}>
                {[...CITIES.map((c) => c.name), ...OTHER_CITIES].map((c) => <option key={c} value={c}>{t(c)}</option>)}
              </select>
            </span>
          </label>
          <label className="fld">
            <span>{t('Портфолио')}</span>
            <input ref={portfolioInput} type="url" inputMode="url" autoComplete="url" value={f.portfolio} onChange={set('portfolio')} placeholder="https://…" maxLength={300} aria-invalid={invalid === 'portfolio'} aria-describedby={`${portfolioHintId}${invalid === 'portfolio' ? ` ${errorId}` : ''}`} />
            <small id={portfolioHintId} className="muted">{t('Полная ссылка с http:// или https://. Поле можно оставить пустым.')}</small>
          </label>
        </div>
        <label className="fld"><span>{t('Коротко о себе')}</span><input value={f.bio} onChange={set('bio')} maxLength={200} /></label>
        <label className="fld"><span>{t('Обо мне')}</span><textarea rows={3} value={f.about} onChange={set('about')} maxLength={1000} /></label>
        <label className="fld"><span>{t('Навыки (через запятую)')}</span><input ref={skillsInput} value={f.skills} onChange={set('skills')} placeholder="Figma, React" maxLength={1000} aria-invalid={invalid === 'skills'} aria-describedby={invalid === 'skills' ? errorId : undefined} /></label>
        <label className="fld"><span>{t('Интересы (через запятую)')}</span><input ref={interestsInput} value={f.interests} onChange={set('interests')} maxLength={1000} aria-invalid={invalid === 'interests'} aria-describedby={invalid === 'interests' ? errorId : undefined} /></label>
        </fieldset>
        {error && <p id={errorId} className="err" role="alert">{t(error)}</p>}
        {busy && <p className="muted" role="status">{t('Сохраняем изменения…')}</p>}
        <div className="row modal-actions">
          <button type="button" className="btn outline" onClick={close} disabled={busy}>{t('Отмена')}</button>
          <button type="submit" className="btn lime" disabled={busy}>{t(busy ? 'Сохраняем…' : 'Сохранить')}</button>
        </div>
      </form>
    </dialog>
  )
}
