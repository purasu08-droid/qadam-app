import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft, ArrowRight, Bookmark, BookmarkCheck, CalendarDays, Check, ChevronDown, ChevronRight, Clock, Code2,
  Globe, MapPin, Mic, PenLine, BarChart3, Users,
} from 'lucide-react'
import { api } from '../api'
import { formatEventDate, KINDS, type Opportunity, type Role } from '../data'
import { useApi, useSite } from '../state'
import { Avatar, Cover, KindBadge } from '../components/ui'
import { useI18n } from '../i18n'
import { useIsDesktop } from '../../useIsDesktop'

const ROLE_ICON = { pen: PenLine, code: Code2, mic: Mic, chart: BarChart3 }
const BACK = { meetup: 'Назад к встречам', job: 'Назад к вакансиям', idea: 'Назад к идеям', event: 'Назад к событиям' }
const PROJECT_STAGES = new Set(['Идея', 'Прототип', 'MVP', 'Рост'])
const AUTHOR_OF = { meetup: 'Автор встречи', job: 'Автор вакансии', idea: 'Автор проекта', event: 'Автор события' }

export default function Detail() {
  const { t } = useI18n()
  const { id } = useParams()
  const detail = useApi<{ item: Opportunity }>(id ? `/opportunities/${encodeURIComponent(id)}` : null)
  const o = detail.data?.item
  if (detail.error) return <div className="page"><p className="empty">{t(detail.error)}. <button className="link-purple" onClick={detail.reload}>{t('Повторить')}</button> · <Link to="/map" className="link-purple">{t('К списку возможностей')}</Link></p></div>
  if (!o) return <div className="page"><p className="empty">{t('Загрузка…')}</p></div>
  return o.kind === 'event' ? <EventView key={o.id} o={o} /> : <ProjectView key={o.id} o={o} />
}

function Crumbs({ o, backFirst }: { o: Opportunity; backFirst?: boolean }) {
  const { t } = useI18n()
  const list = `/map?kind=${o.kind}&view=list`
  const back = <Link to={list} className="back"><ArrowLeft size={17} /> {t(BACK[o.kind])}</Link>
  const path = <span className="crumb-path"><Link to={list}>{t(KINDS[o.kind].plural)}</Link> / <span>{o.title}</span></span>
  return <div className="crumbs">{backFirst ? <>{back}<span className="sep">/</span>{path}</> : <>{path}{back}</>}</div>
}

function EventView({ o }: { o: Opportunity }) {
  const desktop = useIsDesktop()
  const { t } = useI18n()
  const { user, state, toggleAttend, toggleSave } = useSite()
  const nav = useNavigate()
  const [error, setError] = useState<string | null>(null)
  const going = state.attending.includes(o.id)
  const isSaved = state.saved.includes(o.id)
  const requireAuth = (fn: (id: string) => Promise<void>) => () =>
    user ? fn(o.id).then(() => setError(null), (e: Error) => setError(e.message)) : nav(desktop ? '/signin' : '/account/signin', { state: { from: `/p/${o.id}` } })

  return (
    <div className="page detail">
      <Crumbs o={o} backFirst />
      <div className="detail-grid">
        <div className="detail-main">
          <section className="banner">
            <div className="banner-text">
              {o.topic && <span className="chip purple">{o.topic}</span>}
              <h1>{o.title}</h1>
              <p>{o.subtitle}</p>
            </div>
            <Cover o={o} hero className="banner-art" />
          </section>

          <section className="dblock">
            <h2>{t('О событии')}</h2>
            <p className="lead">{o.about}</p>
          </section>

          {o.program && (
            <section className="dblock">
              <h2>{t('Программа')}</h2>
              <ul className="timeline">
                {o.program.map(([t, what]) => <li key={t}><b>{t}</b> — <span>{what}</span></li>)}
              </ul>
            </section>
          )}

          <Link to={`/map?focus=${encodeURIComponent(o.id)}&city=${encodeURIComponent(o.city)}`} className="panel row-card">
            <span className="itile plain"><MapPin size={22} /></span>
            <span className="grow"><small>{t('Место')}</small><b>{o.place} · {t(o.city)}</b></span>
            <span className="link-purple">{t('Посмотреть на карте')} <ArrowRight size={17} /></span>
          </Link>
          <div className="row-card divided">
            <span className="itile plain"><Users size={24} /></span>
            <span className="grow"><small>{t('Организатор')}</small><b>{o.organizer}</b>{o.author && <Link to={`/u/${o.author.id}`} className="link-purple">{t('Открыть профиль')}</Link>}</span>
            <ChevronRight size={20} />
          </div>
        </div>

        <aside className="detail-side">
          <div className="panel side-card">
            <h2>{t('Твой следующий шаг')}</h2>
            <ul className="facts">
              <li><CalendarDays size={24} /> {formatEventDate(o.date)}</li>
              <li><Clock size={24} /> {o.time}</li>
              <li><MapPin size={24} /> {t(o.city)}</li>
            </ul>
            <hr />
            <p className="muted small">{o.conditions ?? t('Условия участия уточни у организатора.')}</p>
            <button className={`btn lime dblock lg ${going ? 'done' : ''}`} onClick={requireAuth(toggleAttend)}>
              {going ? <><Check size={18} /> {t('Ты идёшь')}</> : <>{t('Я пойду')} <ArrowRight size={18} /></>}
            </button>
            <button className="btn outline dblock lg" onClick={requireAuth(toggleSave)}>
              {isSaved ? <><BookmarkCheck size={18} /> {t('Сохранено')}</> : <><Bookmark size={18} /> {t('Сохранить событие')}</>}
            </button>
            {error ? <p className="err center">{t(error)}</p> : <p className="muted small center">{t(going ? 'Организатор знает, что ты придёшь' : 'Можно передумать в любой момент')}</p>}
          </div>
        </aside>
      </div>
    </div>
  )
}

function ProjectView({ o }: { o: Opportunity }) {
  const desktop = useIsDesktop()
  const { t } = useI18n()
  const { user, state, apply } = useSite()
  const nav = useNavigate()
  const hasAuthorRoles = Boolean(o.roles?.length)
  const roles: Role[] = hasAuthorRoles ? o.roles! : [{ title: 'Участник', text: 'Просто приходи', tags: [KINDS[o.kind].label], icon: 'mic' }]
  const existing = state.applications.find((a) => a.opportunityId === o.id)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [chatId, setChatId] = useState<string | null>(null)
  const mine = !!user && o.author?.id === user.id
  const [role, setRole] = useState(roles[0].title)
  const [message, setMessage] = useState('')
  const [portfolio, setPortfolio] = useState('')
  const author = o.author
  const active = useRef(true)
  const writeRequest = useRef<AbortController | null>(null)
  useEffect(() => { active.current = true; return () => { active.current = false; writeRequest.current?.abort() } }, [])

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (busy) return
    if (!user) return nav(desktop ? '/signin' : '/account/signin', { state: { from: `/p/${o.id}` } })
    setBusy(true)
    try {
      const conversationId = await apply(o.id, { role, message, portfolio })
      if (active.current) { setChatId(conversationId); setError(null) }
    } catch (err) {
      if (active.current) setError((err as Error).message)
    } finally {
      if (active.current) setBusy(false)
    }
  }

  const write = async () => {
    if (!user) return nav(desktop ? '/signin' : '/account/signin', { state: { from: `/p/${o.id}` } })
    if (writeRequest.current) return
    const request = new AbortController()
    writeRequest.current = request
    try {
      const { id } = await api.post<{ id: string }>('/conversations/direct', { userId: author!.id }, { signal: request.signal })
      if (active.current) nav(`/chats/${id}`)
    } catch (err) {
      if (active.current && !request.signal.aborted) setError((err as Error).message)
    } finally { writeRequest.current = null }
  }

  const chipText = o.kind === 'idea' ? 'Идея · Поиск команды' : o.kind === 'job' ? 'Работа · Вакансия' : 'Встреча · По интересам'

  return (
    <div className="page detail">
      <Crumbs o={o} />
      <div className="detail-grid">
        <div className="detail-main">
          <section className="banner">
            <div className="banner-text">
              <KindBadge kind={o.kind}>{t(chipText)}</KindBadge>
              <h1>{o.title}</h1>
              <p className="banner-sub">{o.subtitle}</p>
              <p className="lime-text">{mine ? t('Твоя публикация') : o.stage ? t('Стадия: {stage}', { stage: PROJECT_STAGES.has(o.stage) ? t(o.stage) : o.stage }) : t(KINDS[o.kind].label)}</p>
              <pre className="term">{t('> ideas\n> people\n> better code\n_')}</pre>
            </div>
            <Cover o={o} hero className="banner-art" />
          </section>

          <div className="meta-row">
            <span><MapPin size={18} /> {t(o.city)}</span>
            {o.online && <span><Globe size={18} /> {t('Можно онлайн')}</span>}
            {o.date && <span><CalendarDays size={18} /> {formatEventDate(o.date)}{o.time ? `, ${o.time}` : ''}</span>}
            {o.stage && <span className="chip purple outline">{PROJECT_STAGES.has(o.stage) ? t(o.stage) : o.stage}</span>}
          </div>

          <section className="dblock">
            <h2>{t(o.kind === 'job' ? 'О вакансии' : o.kind === 'meetup' ? 'О встрече' : 'О проекте')}</h2>
            <p className="lead">{o.about}</p>
          </section>

          <section className="dblock">
            <h2>{t('Кого ищем')}</h2>
            <div className="roles">
              {roles.map((r) => {
                const Icon = ROLE_ICON[r.icon]
                return (
                  <div key={r.title} className="panel role-card">
                    <span className="itile plain"><Icon size={22} /></span>
                    <div>
                      <b>{hasAuthorRoles ? r.title : t(r.title)}</b>
                      <p>{hasAuthorRoles ? r.text : t(r.text)}</p>
                      <div className="chips">{r.tags.map((tag) => <span key={tag} className="chip purple">{hasAuthorRoles ? tag : t(tag)}</span>)}</div>
                    </div>
                  </div>
                )
              })}
            </div>
          </section>

          <div className="panel terms">
            <Users size={30} />
            <div><b>{t('Условия участия')}</b><p>{o.conditions ?? t('Условия обсуждаются с автором.')}</p></div>
          </div>
        </div>

        <aside className="detail-side">
          <form className="panel side-card" onSubmit={submit}>
            <div className="row between">
              <h2>{t('Сделай следующий шаг')}</h2>
              <Users size={30} className="purple" />
            </div>
            {mine ? (
              <div className="sent">
                <Check size={28} />
                <b>{t('Это твоя публикация')}</b>
                <p>{t('Заявки придут тебе в чаты.')}</p>
                <Link to="/chats" className="btn outline dblock">{t('Открыть чаты')}</Link>
              </div>
            ) : existing ? (
              <div className="sent">
                <Check size={28} />
                <b>{t('Заявка отправлена')}</b>
                <p>{t('Роль: {role}. Автор ответит в чате.', { role: !hasAuthorRoles && existing.role === 'Участник' ? t('Участник') : existing.role })}</p>
                <Link to={(chatId ?? existing.conversationId) ? `/chats/${chatId ?? existing.conversationId}` : '/chats'} className="btn outline dblock">{t('Перейти в чат')}</Link>
              </div>
            ) : (
              <>
                <p className="muted">{t(o.kind === 'job' ? 'Расскажи, чем хочешь помочь команде.' : 'Расскажи, чем хочешь помочь проекту.')}</p>
                <label className="fld">
                  <span>{t('Твоя роль')}</span>
                  <span className="select">
                    <select value={role} onChange={(e) => setRole(e.target.value)}>
                      {roles.map((r) => <option key={r.title} value={r.title}>{hasAuthorRoles ? r.title : t(r.title)}</option>)}
                    </select>
                    <ChevronDown size={18} />
                  </span>
                </label>
                <label className="fld">
                  <span>{t('Сообщение автору')}</span>
                  <textarea rows={4} maxLength={2000} placeholder={t('Расскажи о своём опыте и чем хочешь помочь')} value={message} onChange={(e) => setMessage(e.target.value)} />
                </label>
                <label className="fld">
                  <span>{t('Портфолио')}</span>
                  <input type="url" placeholder="https://…" maxLength={300} value={portfolio} onChange={(e) => setPortfolio(e.target.value)} />
                </label>
                <button className="btn lime dblock lg" type="submit" disabled={!message.trim() || busy}>
                  {t(o.kind === 'meetup' ? 'Присоединиться' : 'Отправить заявку')} <ArrowRight size={18} />
                </button>
                {error ? <p className="err center">{t(error)}</p> : <p className="muted small center">{t('Заявка уйдёт автору в личные сообщения')}</p>}
              </>
            )}
          </form>
          {author && (
            <div className="panel author">
              <b>{t(AUTHOR_OF[o.kind])}</b>
              <div className="row">
                <Avatar person={author} size={82} />
                <span className="grow"><b className="name">{author.short}</b><span className="muted"><MapPin size={15} /> {t(author.city)}</span></span>
                <span className="col-btns">
                  <Link to={`/u/${author.id}`} className="btn outline sm">{t('Открыть профиль')}</Link>
                  {!mine && <button type="button" className="btn outline sm" onClick={write}>{t('Написать')}</button>}
                </span>
              </div>
            </div>
          )}
        </aside>
      </div>
    </div>
  )
}
