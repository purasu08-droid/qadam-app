import { useI18n } from '../i18n'
import { useState, type FormEvent } from 'react'
import { Link, Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { ArrowRight, BarChart3, Check, FileText, FlaskConical, Gift, GraduationCap, MapPin, School, Users } from 'lucide-react'
import { api } from '../api'
import type { Campus as CampusT, CampusMe, CampusMembership } from '../campus-types'
import { CAMPUS_STATUS, campusDate } from '../campus-helpers'
import { useSite } from '../state'
import { useIsDesktop } from '../../useIsDesktop'
import CampusOverview from '../components/campus/CampusOverview'
import CampusStudents from '../components/campus/CampusStudents'
import CampusPublications from '../components/campus/CampusPublications'
import CampusGrants from '../components/campus/CampusGrants'
import CampusDemoEntry from '../components/CampusDemoEntry'
import { CampusFeedback, CampusLoad, useCampusMutation, useCampusQuery } from '../components/campus/CampusShared'
import '../campus.css'

export default function Campus() {
  const { authVersion } = useSite()
  return <CampusSession key={authVersion} />
}

function CampusSession() {
  const { t } = useI18n()
  const { id } = useParams()
  const me = useCampusQuery<CampusMe>('/campus/me')
  if (!me.data) return <div className="page campus-page"><CampusLoad loading={me.loading} error={me.error} retry={me.retry} /></div>
  if (!id && me.data.adminOf.length) return <Navigate replace to={`/campus/${encodeURIComponent(me.data.adminOf[0].id)}`} />
  if (id) {
    const campus = me.data.adminOf.find((item) => item.id === id)
    if (!campus) return <div className="page campus-page"><section className="panel campus-access"><School size={36} aria-hidden="true" /><h1>{t("Кампус недоступен")}</h1><p>{t("Для этого кабинета нужны права администратора университета.")}</p><Link to="/campus" className="btn lime">{t("Мой кампус")} <ArrowRight size={17} /></Link></section></div>
    return <CampusDashboard key={id} campus={campus} adminOf={me.data.adminOf} />
  }
  return <StudentCampus data={me.data} reload={me.reload} loading={me.loading} error={me.error} />
}

const TABS = [{ id: 'overview', label: 'Обзор', icon: BarChart3 }, { id: 'students', label: 'Студенты', icon: Users }, { id: 'publications', label: 'Публикации', icon: FileText }, { id: 'grants', label: 'Пакеты', icon: Gift }] as const

function CampusDashboard({ campus, adminOf }: { campus: CampusT; adminOf: CampusT[] }) {
  const { t } = useI18n()
  const nav = useNavigate()
  const [params, setParams] = useSearchParams()
  const tab = TABS.some((item) => item.id === params.get('tab')) ? params.get('tab')! : 'overview'
  return <div className="page campus-page"><header className="campus-hero"><div className="campus-brand-icon" aria-hidden="true"><School size={36} /></div><div className="campus-hero-copy"><span className="eyebrow">{t("QADAM CAMPUS · КАБИНЕТ ВУЗА")}</span><h1>{campus.name}</h1><p><MapPin size={16} aria-hidden="true" />{t(campus.city)}<span>{t("Доступ администратора")}</span></p></div><label className="campus-select campus-university-select"><span>{t("Университет")}</span><select aria-label={t("Выбрать университет")} value={campus.id} onChange={(e) => nav(`/campus/${encodeURIComponent(e.target.value)}`)}>{adminOf.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select></label></header>
    {campus.isDemo === true && <aside className="campus-demo-banner" role="note"><FlaskConical size={22} aria-hidden="true" /><p><strong>{t("Демонстрационный кабинет.")}</strong> {t("Действия относятся только к тестовым данным: заявкам, студентам, публикациям и пакетам. Это отдельный пример кабинета ЕНУ.")}</p></aside>}
    <nav className="campus-tabs" aria-label={t("Разделы кабинета кампуса")}>{TABS.map((item) => <button type="button" key={item.id} aria-pressed={tab === item.id} className={tab === item.id ? 'on' : ''} onClick={() => { const next = new URLSearchParams(params); next.set('tab', item.id); setParams(next) }}><item.icon size={19} aria-hidden="true" />{t(item.label)}</button>)}</nav>
    {tab === 'overview' && <CampusOverview campusId={campus.id} />}{tab === 'students' && <CampusStudents campusId={campus.id} />}{tab === 'publications' && <CampusPublications campusId={campus.id} />}{tab === 'grants' && <CampusGrants campusId={campus.id} />}
    <p className="campus-bottom-note">{t("Кабинет показывает данные только назначенного тебе кампуса. Подключение вузов и права администраторов оформляет команда QADAM.")}</p>
  </div>
}

function StudentCampus({ data, reload, loading, error }: { data: CampusMe; reload: () => void; loading: boolean; error: string | null }) {
  const desktop = useIsDesktop()
  const { t } = useI18n()
  const membership = data.membership
  const [campusId, setCampusId] = useState(membership?.campus.id ?? data.available[0]?.id ?? '')
  const [faculty, setFaculty] = useState(membership?.faculty ?? '')
  const [studyYear, setStudyYear] = useState(String(membership?.studyYear ?? 1))
  const action = useCampusMutation()
  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!campusId || faculty.trim().length < 2) return action.setError('Выбери университет и укажи факультет.')
    const success = await action.run(async (signal) => { await api.post<{ membership: CampusMembership }>('/campus/enroll', { campusId, faculty: faculty.trim(), studyYear: Number(studyYear) }, { signal }) }, 'Заявка отправлена в университет. Подтверждение появится после проверки.')
    if (success) reload()
  }
  return <div className="page campus-page"><header className="campus-hero student"><div className="campus-brand-icon" aria-hidden="true"><GraduationCap size={36} /></div><div className="campus-hero-copy"><span className="eyebrow">{t("QADAM CAMPUS · ДЛЯ СТУДЕНТОВ")}</span><h1>{t("Твой университет.")}<br />{t("Больше возможностей.")}</h1><p>{t("Подтверди связь с кампусом и используй услуги, которые покрывает вуз.")}</p></div><button type="button" className="btn outline" disabled={loading} onClick={reload}>{t("Обновить статус")}</button></header><CampusLoad loading={loading} error={error} retry={reload} /><CampusFeedback error={action.error} success={action.success} />
    <CampusDemoEntry disabled={action.busy} />
    <div className="campus-student-grid"><section className="panel campus-membership"><span className="eyebrow">{t("МОЙ СТАТУС")}</span><h2>{membership?.campus.name ?? t("Выбери свой кампус")}</h2>{membership ? <><span className={`campus-status ${membership.status}`}>{membership.status === 'verified' && !membership.current ? t("Подтверждение не действует") : t(CAMPUS_STATUS[membership.status])}</span><p>{membership.current ? t("Университет подтвердил твой статус. Покрытые пакетом услуги бесплатны для тебя.") : membership.status === 'pending' ? t("Заявка ожидает ручной проверки университетом. Отправка формы сама по себе не подтверждает студенческий статус.") : t("Для действующего статуса потребуется новая проверка. Можно повторно отправить заявку ниже.")}</p><dl className="campus-member-details"><div><dt>{t("Факультет")}</dt><dd>{membership.faculty}</dd></div><div><dt>{t("Курс")}</dt><dd>{membership.studyYear}</dd></div><div><dt>{t("Заявка отправлена")}</dt><dd>{campusDate(membership.requestedAt)}</dd></div><div><dt>{t("Действует до")}</dt><dd>{membership.expiresAt ? campusDate(membership.expiresAt, true) : membership.current ? t("Без срока") : t("После подтверждения")}</dd></div></dl><Link className="btn outline-purple" to={desktop ? '/profile' : '/account/profile'}>{t("Мой профиль и пакеты")} <ArrowRight size={17} /></Link></> : <p>{t("Выбери университет из списка и отправь заявку. Администратор кампуса проверит данные вручную.")}</p>}<p className="campus-fine">{t("Студенческий статус подтверждает вуз или администратор QADAM. Пакет кампуса не требует повторной оплаты со студента. Запуск продвижения пока недоступен.")}</p></section>
      {!membership?.current && <form className="panel campus-enroll" onSubmit={(event) => { void submit(event) }}><span className="eyebrow">{t("ЗАЯВКА В КАМПУС")}</span><h2>{membership?.status === 'pending' ? t("Обновить заявку") : t("Присоединиться к кампусу")}</h2>{data.available.length ? <><label className="fld"><span>{t("Университет")}</span><select value={campusId} required disabled={action.busy} onChange={(e) => setCampusId(e.target.value)}>{data.available.map((campus) => <option key={campus.id} value={campus.id}>{campus.name} · {t(campus.city)}</option>)}</select></label><label className="fld"><span>{t("Факультет")}</span><input value={faculty} required minLength={2} maxLength={120} disabled={action.busy} placeholder={t("Например, информационных технологий")} onChange={(e) => setFaculty(e.target.value)} /></label><label className="fld"><span>{t("Курс")}</span><select value={studyYear} disabled={action.busy} onChange={(e) => setStudyYear(e.target.value)}>{[1, 2, 3, 4, 5, 6, 7, 8].map((year) => <option key={year} value={year}>{t("{count} курс", { count: year })}</option>)}</select></label><p className="campus-fine">{t("После отправки статус — «На проверке». Университет проверяет заявку вручную; скидка не включается автоматически.")}</p><button className="btn lime dblock" disabled={action.busy || loading} type="submit">{action.busy ? t("Отправляем…") : t("Отправить на проверку")}<Check size={17} aria-hidden="true" /></button></> : <p className="campus-empty">{t("Подключённых университетов пока нет. Список появится после их подключения командой QADAM.")}</p>}</form>}
    </div>
  </div>
}
