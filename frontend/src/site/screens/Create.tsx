import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { ApiError, type NewPublication } from '../api'
import { ArrowLeft, ArrowRight, CalendarDays, Camera, Check, ChevronDown, FileText, MapPin, Plus, X } from 'lucide-react'
import { CITIES, KIND_ORDER, KINDS, type Kind } from '../data'
import { useSite } from '../state'
import { KindBadge, KindIcon, kindStyle } from '../components/ui'
import LocationPicker from '../components/LocationPicker'
import { isPublicationReplay, newPublicationKey, publicationAttempt, readPublicationAttempt } from '../publication-attempt'
import { useI18n } from '../i18n'

const DIRECTIONS = ['AI / Разработка', 'Дизайн', 'Образование', 'Экология', 'Игры', 'Спорт', 'Бизнес']
const STAGES = ['Идея', 'Прототип', 'MVP', 'Рост']
const SIZES = ['2 участника', '3 участника', '5 участников', '10 участников', 'Без ограничений']
const COVERS = ['/img/preview-chip.jpg', '/img/thumb-floppy.jpg', '/img/cover-campus.jpg', '/img/cover-study.jpg']

type Draft = {
  kind: Kind
  title: string
  direction: string
  stage: string
  city: string
  online: boolean
  description: string
  roles: string[]
  size: string
  deadline: string
  cover: number
  date: string
  startTime: string
  endTime: string
  place: string
  coords?: [number, number]
}

const EMPTY: Draft = {
  kind: 'idea',
  title: '',
  direction: DIRECTIONS[0],
  stage: 'Идея',
  city: 'Алматы',
  online: false,
  description: '',
  roles: [],
  size: '5 участников',
  deadline: '',
  cover: 0,
  date: '',
  startTime: '',
  endTime: '',
  place: '',
}

function loadDraft(key: string, city: string): Draft {
  try {
    const raw = localStorage.getItem(key)
    const parsed = raw ? JSON.parse(raw) : {}
    const fields = parsed && typeof parsed === 'object' ? Object.fromEntries(Object.entries(parsed).filter(([field]) => Object.keys(EMPTY).includes(field) || field === 'coords')) : {}
    const d = { ...EMPTY, city, ...fields }
    if (!KIND_ORDER.includes(d.kind) || !CITIES.some((c) => c.name === d.city) || !Array.isArray(d.roles) || d.roles.some((r: unknown) => typeof r !== 'string')) return { ...EMPTY, city }
    for (const key of ['title', 'description', 'direction', 'stage', 'size', 'deadline', 'date', 'startTime', 'endTime', 'place'] as const) if (typeof d[key] !== 'string') d[key] = EMPTY[key]
    d.cover = Number.isInteger(d.cover) && d.cover >= 0 && d.cover < COVERS.length ? d.cover : 0
    d.online = d.online === true
    if (!Array.isArray(d.coords) || d.coords.length !== 2 || !d.coords.every((n: unknown) => typeof n === 'number' && Number.isFinite(n)) || Math.abs(d.coords[0]) > 90 || Math.abs(d.coords[1]) > 180) d.coords = undefined
    return d
  } catch {
    return { ...EMPTY, city }
  }
}

export default function Create() {
  const { t, locale } = useI18n()
  const nav = useNavigate()
  const { publish, user, city } = useSite()
  const draftKey = `qadam.site.draft.${user!.id}`
  const attemptKey = `qadam.site.publication-attempt.${user!.id}`
  const [initialAttempt] = useState(() => readPublicationAttempt(attemptKey))
  const requestAttempt = useRef(initialAttempt)
  const [closedAttempt, setClosedAttempt] = useState(() => {
    if (!initialAttempt) return false
    try {
      const previous: unknown = JSON.parse(initialAttempt.payload)
      return !!previous && typeof previous === 'object' && 'campusId' in previous
    } catch { return true }
  })
  const [d, setD] = useState<Draft>(() => loadDraft(draftKey, city))
  const payload: NewPublication = {
    kind: d.kind, title: d.title.trim(), description: d.description.trim(), direction: d.direction,
    stage: d.kind === 'idea' ? d.stage : '', city: d.city, online: d.online, roles: d.roles,
    size: d.size, deadline: d.deadline, cover: COVERS[d.cover],
    ...(d.kind === 'event' ? { date: d.date, time: `${d.startTime}–${d.endTime}`, place: d.place.trim(), coords: d.coords } : {}),
  }
  const pendingReplay = isPublicationReplay(requestAttempt.current, payload)
  const canSubmit = !closedAttempt
  const active = useRef(true)
  useEffect(() => { active.current = true; return () => { active.current = false } }, [])
  const [savedAt, setSavedAt] = useState<Date | null>(null)
  const [adding, setAdding] = useState(false)
  const [newRole, setNewRole] = useState('')
  const [tried, setTried] = useState(false)
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((s) => ({ ...s, [k]: v, ...(k === 'city' ? { coords: undefined } : {}) }))

  useEffect(() => setSavedAt(null), [d])

  const saveDraft = () => {
    try {
      localStorage.setItem(draftKey, JSON.stringify(d))
    } catch {
      setError('Не удалось сохранить черновик. Проверь свободное место и разрешения браузера.')
      return
    }
    setSavedAt(new Date())
  }

  const addRole = () => {
    const r = newRole.trim()
    if (r && r.length <= 60 && d.roles.length < 10 && !d.roles.includes(r)) set('roles', [...d.roles, r])
    setNewRole('')
    setAdding(false)
  }

  const event = d.kind === 'event'
  const valid = d.title.trim().length >= 2 && d.description.trim().length >= 10 && d.roles.length > 0 && (!event || (!!d.date && !!d.startTime && !!d.endTime && d.endTime > d.startTime && d.place.trim().length >= 2 && !!d.coords))
  const [busy, setBusy] = useState(false)
  const submitting = useRef(false)
  const [error, setError] = useState<string | null>(null)
  const resetAttempt = () => {
    requestAttempt.current = null
    try { localStorage.removeItem(attemptKey) } catch { /* storage unavailable */ }
    setClosedAttempt(false)
    setError(null)
  }
  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (submitting.current) return
    setTried(true)
    if (!valid) return setError(event ? 'Заполни название, описание, участников, дату, время окончания позже начала, адрес и точку на карте.' : 'Заполни название, описание (от 10 символов) и хотя бы одну роль')
    if (!canSubmit) return
    submitting.current = true
    setError(null)
    setBusy(true)
    try {
      requestAttempt.current = publicationAttempt(requestAttempt.current, payload, newPublicationKey)
      try {
        localStorage.setItem(draftKey, JSON.stringify(d))
        localStorage.setItem(attemptKey, JSON.stringify(requestAttempt.current))
      } catch { /* In-memory retries remain protected if storage is unavailable. */ }
      const o = await publish(payload, requestAttempt.current.key)
      if (!active.current) return
      try {
        localStorage.removeItem(draftKey)
        localStorage.removeItem(attemptKey)
      } catch {
        /* storage unavailable */
      }
      nav(`/p/${o.id}`)
    } catch (err) {
      if (active.current) {
        setError((err as Error).message)
        setBusy(false)
        if (err instanceof ApiError && (err.status === 409 || err.status === 410)) setClosedAttempt(true)
      }
    } finally {
      submitting.current = false
    }
  }

  const [first, ...rest] = d.title.trim().split(' ')

  return (
    <form className="page create" onSubmit={submit} noValidate>
      <div className="create-head">
        <div>
          <button type="button" className="back" onClick={() => nav(-1)}><ArrowLeft size={17} /> {t('Назад')}</button>
          <h1>{t('Создать публикацию')}</h1>
          <p className="purple-sub">{t('Расскажи, кого или что ты ищешь')}</p>
        </div>
        <button type="button" className="btn outline sm" onClick={saveDraft}><FileText size={16} /> {savedAt ? t('Сохранено {time}', { time: savedAt.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' }) }) : t('Черновик')}</button>
      </div>

      <div className="create-grid">
        <div className="create-main">
          <section className="panel">
            <h2>{t('Тип публикации')}</h2>
            <div className="types">
              {KIND_ORDER.map((kk) => (
                <button type="button" key={kk} aria-pressed={d.kind === kk} className={`type ${d.kind === kk ? 'on' : ''}`} style={kindStyle(kk)} onClick={() => { set('kind', kk); if (kk === 'event' && !d.roles.length) set('roles', ['Участник']) }}>
                  {d.kind === kk && <span className="tick"><Check size={14} strokeWidth={3} /></span>}
                  <KindIcon kind={kk} size={34} />
                  <b>{t(KINDS[kk].label)}</b>
                  <span>{t(KINDS[kk].tile)}</span>
                </button>
              ))}
            </div>
          </section>

          <section className="panel">
            <h2>{t(d.kind === 'event' ? 'О событии' : d.kind === 'job' ? 'О вакансии' : d.kind === 'meetup' ? 'О встрече' : 'О проекте')}</h2>
            <label className="fld">
              <span>{t('Название')} <i className="req">*</i></span>
              <input required maxLength={120} className={tried && d.title.trim().length < 2 ? 'bad' : ''} value={d.title} onChange={(e) => set('title', e.target.value)} placeholder={t('Например, NomadCode AI')} />
            </label>
            <div className="two">
              <Select label="Направление" value={d.direction} options={DIRECTIONS} onChange={(v) => set('direction', v)} />
              {d.kind === 'idea' && <Select label="Стадия проекта" value={d.stage} options={STAGES} onChange={(v) => set('stage', v)} />}
              <Select label="Город" value={d.city} options={CITIES.map((c) => c.name)} onChange={(v) => set('city', v)} />
              <label className="cbx big">
                <input type="checkbox" checked={d.online} onChange={(e) => set('online', e.target.checked)} />
                <i><Check size={16} strokeWidth={3} /></i> {t('Можно участвовать онлайн')}
              </label>
            </div>
            <label className="fld">
              <span>{t('Описание')} <i className="req">*</i></span>
              <textarea required maxLength={4000} className={tried && d.description.trim().length < 10 ? 'bad' : ''} rows={4} placeholder={t('Что планируете сделать и как можно присоединиться?')} value={d.description} onChange={(e) => set('description', e.target.value)} />
            </label>

            <hr />
            <h2>{t(event ? 'Участники' : 'Кого ищем')}</h2>
            <div className="roles-row">
              <span className="lbl">{t('Навыки и роли')} <i className="req">*</i></span>
              {d.roles.map((r) => (
                <span key={r} className="chip purple">
                  {r}
                  <button type="button" onClick={() => set('roles', d.roles.filter((x) => x !== r))} aria-label={t('Убрать {role}', { role: r })}><X size={14} /></button>
                </span>
              ))}
              {adding ? (
                <input
                  autoFocus
                  className="chip-input"
                  value={newRole}
                  aria-label={t('Название роли')}
                  maxLength={60}
                  placeholder={t('Роль…')}
                  onChange={(e) => setNewRole(e.target.value)}
                  onBlur={addRole}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      addRole()
                    }
                    if (e.key === 'Escape') setAdding(false)
                  }}
                />
              ) : (
                <button type="button" className="chip dashed" disabled={d.roles.length >= 10} onClick={() => setAdding(true)}><Plus size={14} /> {t('Добавить роль')}</button>
              )}
              {tried && d.roles.length === 0 && <span className="err">{t('Добавь хотя бы одну роль')}</span>}
            </div>
            <div className="two">
              <Select label={event ? 'Количество мест' : 'Размер команды'} value={d.size} options={SIZES} onChange={(v) => set('size', v)} />
              {!event && <label className="fld"><span>{t('Набор до (необязательно)')}</span><input type="date" value={d.deadline} onInput={(e) => set('deadline', e.currentTarget.value)} onChange={(e) => set('deadline', e.target.value)} /></label>}
            </div>
            <p className="muted small">{t('Условия участия обсуди с будущими участниками')}</p>
            {event && <>
              <hr />
              <h2><CalendarDays size={20} /> {t('Когда и где')}</h2>
              <label className="fld"><span>{t('Дата события')} <i className="req">*</i></span><input type="date" required value={d.date} onInput={(e) => set('date', e.currentTarget.value)} onChange={(e) => set('date', e.target.value)} /></label>
              <div className="two">
                <label className="fld"><span>{t('Начало')} <i className="req">*</i></span><input type="time" required value={d.startTime} onInput={(e) => set('startTime', e.currentTarget.value)} onChange={(e) => set('startTime', e.target.value)} /></label>
                <label className="fld"><span>{t('Окончание')} <i className="req">*</i></span><input type="time" required value={d.endTime} onInput={(e) => set('endTime', e.currentTarget.value)} onChange={(e) => set('endTime', e.target.value)} /></label>
              </div>
              <p className="muted small">{t('Укажи местное время события.')}</p>
              <label className="fld"><span>{t('Название места и адрес')} <i className="req">*</i></span><input required maxLength={200} placeholder={t('Например, коворкинг, ул. Абая, 10')} value={d.place} onChange={(e) => set('place', e.target.value)} /></label>
              <LocationPicker key={d.city} center={CITIES.find((c) => c.name === d.city)!.coords} value={d.coords} onChange={(coords) => set('coords', coords)} />
            </>}
          </section>

          <section className="panel actions">
            {closedAttempt ? <div role="status"><p className="muted small">{t('Эту попытку нельзя повторить. Проверь «Мои проекты» перед новой отправкой: она создаст отдельную публикацию.')}</p><button type="button" className="link-purple" onClick={resetAttempt}>{t('Начать новую отправку')}</button></div> : pendingReplay && <p className="muted small" role="status">{t('Предыдущая отправка могла завершиться. Проверим её результат с защитой от дублирования публикации.')}</p>}
            <div className="two">
              <button type="button" className="btn outline-purple lg" onClick={saveDraft}>{t(savedAt ? 'Черновик сохранён' : 'Сохранить черновик')}</button>
              <button type="submit" className="btn lime lg" disabled={busy || !canSubmit}>{t(busy ? 'Публикуем…' : pendingReplay ? 'Проверить результат отправки' : 'Опубликовать')} <ArrowRight size={18} /></button>
            </div>
            {error ? <p className="err" role="alert">{t(error)}</p> : <p className="muted small"><i className="req">*</i> {t('Обязательные поля')}</p>}
          </section>
        </div>

        <aside className="create-side">
          <section className="panel">
            <h2>{t('Предпросмотр')}</h2>
            <p className="muted">{t('Так будет выглядеть публикация')}</p>
            <div className="preview">
              <div className="preview-cover">
                <KindBadge kind={d.kind} solid />
                <div className="pc-text">
                  <b>{first || t('Название')}<br /><span>{rest.length ? rest.slice(0, -1).join(' ') : ''} <em>{rest.length ? rest[rest.length - 1] : ''}</em></span></b>
                  <small>{t('Больше, чем код.')}<br />{t('Ближе к людям.')}</small>
                </div>
                <img src={COVERS[d.cover]} alt="" />
                <button type="button" className="btn ghost xs" onClick={() => set('cover', (d.cover + 1) % COVERS.length)}><Camera size={14} /> {t('Изменить обложку')}</button>
              </div>
              <div className="preview-body">
                <h3>{d.title || t('Название')}</h3>
                <p className="muted"><MapPin size={15} /> {t(d.city)}{d.online ? ` • ${t('Можно онлайн')}` : ''}</p>
                <p>{d.description.split('.')[0] || t('Описание')}</p>
                {d.kind === 'idea' && <span className="chip purple outline">{t(d.stage)}</span>}
                <div className="chips">{d.roles.map((r) => <span key={r} className="chip">{r.replace(/-?(дизайнер|разработчик)$/i, '').trim() || r}</span>)}</div>
              </div>
            </div>
          </section>
          <section className="panel hint">
            <FileText size={34} />
            <div><b>{t('Перед публикацией')}</b><p>{t('Проверь описание и укажи понятные условия участия.')}</p></div>
          </section>
        </aside>
      </div>
    </form>
  )
}

function Select({ label, value, options, onChange, icon }: { label: string; value: string; options: string[]; onChange: (v: string) => void; icon?: React.ReactNode }) {
  const { t } = useI18n()
  return (
    <label className="fld">
      <span>{t(label)}</span>
      <span className={`select ${icon ? 'with-icon' : ''}`}>
        {icon}
        <select value={value} onChange={(e) => onChange(e.target.value)}>
          {options.map((o) => <option key={o} value={o}>{t(o)}</option>)}
        </select>
        <ChevronDown size={18} />
      </span>
    </label>
  )
}
