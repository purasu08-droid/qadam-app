import { useI18n } from '../../i18n'
import { useState, type FormEvent } from 'react'
import { Check, ShieldCheck, X } from 'lucide-react'
import { api } from '../../api'
import type { CampusPage, CampusStatus, CampusStudent } from '../../campus-types'
import { CAMPUS_STATUS, campusDate, futureExpiry } from '../../campus-helpers'
import { CampusFeedback, CampusLoad, CampusPager, CampusSearch, useCampusMutation, useCampusQuery } from './CampusShared'

export default function CampusStudents({ campusId }: { campusId: string }) {
  const { t } = useI18n()
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState<CampusStatus | 'all'>('all')
  const [page, setPage] = useState(1)
  const [target, setTarget] = useState<{ student: CampusStudent; status: 'verified' | 'rejected' | 'revoked' } | null>(null)
  const [expires, setExpires] = useState('')
  const students = useCampusQuery<CampusPage<CampusStudent>>(`/campus/${encodeURIComponent(campusId)}/students?${new URLSearchParams({ status, q: query, page: String(page) })}`)
  const action = useCampusMutation()
  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!target) return
    const chosen = target
    const success = await action.run(async (signal) => {
      const expiresAt = chosen.status === 'verified' ? futureExpiry(expires) : undefined
      await api.patch(`/campus/${encodeURIComponent(campusId)}/students/${encodeURIComponent(chosen.student.user.id)}`, { status: chosen.status, ...(expiresAt ? { expiresAt } : {}) }, { signal })
    }, chosen.status === 'verified' ? 'Статус студента подтверждён.' : chosen.status === 'rejected' ? 'Заявка отклонена.' : 'Статус студента отозван. История сохранена.')
    if (success) { setTarget(null); students.reload() }
  }
  if (students.accessDenied) return <CampusLoad loading={students.loading} error={students.error} retry={students.retry} />
  return <section className="campus-section" aria-labelledby="campus-students-title">
    <div className="campus-section-head"><div><h2 id="campus-students-title">{t("Студенты кампуса")}</h2><p>{t("Подтверждай заявки и управляй сроком студенческого статуса")}</p></div></div>
    <div className="campus-tools"><CampusSearch value={query} label={t("Имя или email студента")} onChange={(q) => { setQuery(q); setPage(1) }} /><label className="campus-select"><span>{t("Статус")}</span><select value={status} onChange={(e) => { setStatus(e.target.value as typeof status); setPage(1) }}><option value="all">{t("Все статусы")}</option>{Object.entries(CAMPUS_STATUS).map(([value, label]) => <option key={value} value={value}>{t(label)}</option>)}</select></label></div>
    <CampusFeedback error={action.error} success={action.success} />
    {target && <form className="panel campus-confirm" onSubmit={(event) => { void submit(event) }} aria-labelledby="campus-student-action"><h3 id="campus-student-action">{target.status === 'verified' ? t("Подтвердить студента") : target.status === 'rejected' ? t("Отклонить заявку") : t("Отозвать подтверждение")}: {target.student.user.name}</h3>{target.status === 'verified' ? <><p>{t("Укажи срок действия. После его окончания статус потребуется подтвердить заново.")}</p><label className="fld"><span>{t("Подтверждён до")}</span><input type="datetime-local" value={expires} required disabled={action.busy} onInput={(e) => setExpires(e.currentTarget.value)} onChange={(e) => setExpires(e.target.value)} /><small className="campus-fine">{t("Время по часовому поясу твоего устройства.")}</small></label></> : <p>{target.status === 'revoked' ? t("Студенческий статус и неиспользованные пакеты этого кампуса перестанут действовать. Профиль и история участия сохранятся.") : t("Студент увидит результат проверки и сможет подать заявку снова.")}</p>}<div className="campus-actions"><button className="btn lime" disabled={action.busy} type="submit"><Check size={17} aria-hidden="true" />{action.busy ? t("Сохраняем…") : t("Подтвердить действие")}</button><button className="btn outline" disabled={action.busy} type="button" onClick={() => setTarget(null)}>{t("Отмена")}</button></div></form>}
    <CampusLoad loading={students.loading} error={students.error} retry={students.retry} />
    {students.data && <><div className="campus-member-list">{students.data.items.map((student) => <article className="panel campus-member" key={student.user.id}><div className="campus-member-title"><span className={`campus-person-icon ${student.current ? 'verified' : ''}`} aria-hidden="true"><ShieldCheck size={22} /></span><div><h3>{student.user.name}</h3><p>{student.user.email}</p></div><span className={`campus-status ${student.status}`}>{student.status === 'verified' && !student.current ? t("Подтверждение не действует") : t(CAMPUS_STATUS[student.status])}</span></div><dl className="campus-member-details"><div><dt>{t("Факультет")}</dt><dd>{student.faculty || t("Не указан")}</dd></div><div><dt>{t("Курс")}</dt><dd>{student.studyYear}</dd></div><div><dt>{t("Заявка")}</dt><dd>{campusDate(student.requestedAt)}</dd></div><div><dt>{t("Подтверждение до")}</dt><dd>{student.expiresAt ? campusDate(student.expiresAt, true) : t("Без срока")}</dd></div></dl><div className="campus-actions"><button className="btn outline-purple sm" disabled={action.busy} onClick={() => { setTarget({ student, status: 'verified' }); setExpires(''); action.setError(null) }}><Check size={15} />{student.current ? t("Продлить") : t("Подтвердить")}</button>{student.status === 'pending' && <button className="btn outline sm" disabled={action.busy} onClick={() => { setTarget({ student, status: 'rejected' }); action.setError(null) }}><X size={15} />{t("Отклонить")}</button>}{student.status === 'verified' && <button className="btn outline sm" disabled={action.busy} onClick={() => { setTarget({ student, status: 'revoked' }); action.setError(null) }}>{t("Отозвать")}</button>}</div></article>)}</div>{students.data.items.length === 0 && <p className="campus-empty">{t("Студенты с такими условиями не найдены.")}</p>}<CampusPager page={students.data.page} total={students.data.total} pageSize={students.data.pageSize} loading={students.loading} change={setPage} /></>}
  </section>
}
