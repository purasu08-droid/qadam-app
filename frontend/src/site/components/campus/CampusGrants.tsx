import { useI18n } from '../../i18n'
import { useRef, useState, type FormEvent } from 'react'
import { Check, Gift, Search, ShieldCheck } from 'lucide-react'
import { api, ApiError, isAbortError } from '../../api'
import { newPublicationKey, type BillingService } from '../../billing'
import type { CampusGrant, CampusPage, CampusStudent } from '../../campus-types'
import { CAMPUS_SERVICE, campusDate, futureExpiry, grantAttempt, parseGrantAttempt, uncertainCampusWrite, type GrantAttempt, type GrantBody } from '../../campus-helpers'
import { useSite } from '../../state'
import { CampusFeedback, CampusLoad, CampusPager, useCampusMutation, useCampusQuery } from './CampusShared'

export default function CampusGrants({ campusId }: { campusId: string }) {
  const { t } = useI18n()
  const [page, setPage] = useState(1)
  const [revoke, setRevoke] = useState<CampusGrant | null>(null)
  const list = useCampusQuery<CampusPage<CampusGrant>>(`/campus/${encodeURIComponent(campusId)}/grants?page=${page}`)
  const action = useCampusMutation()
  const revokeGrant = async () => {
    if (!revoke) return
    const success = await action.run(async (signal) => { await api.post(`/campus/${encodeURIComponent(campusId)}/grants/${encodeURIComponent(revoke.id)}/revoke`, {}, { signal }) }, 'Пакет отозван. История использования сохранена.')
    if (success) { setRevoke(null); list.reload() }
  }
  if (list.accessDenied) return <CampusLoad loading={list.loading} error={list.error} retry={list.retry} />
  return <section className="campus-section" aria-labelledby="campus-grants-title"><div className="campus-section-head"><div><h2 id="campus-grants-title">{t("Пакеты услуг")}</h2><p>{t("Выдавай покрытие подтверждённым студентам от имени университета")}</p></div></div>
    <div className="campus-grants-layout"><GrantForm campusId={campusId} onGranted={list.reload} /><div className="campus-grants-history"><div className="campus-section-head"><h3>{t("Выданные пакеты")}</h3><button className="link-purple" onClick={list.reload} disabled={list.loading}>{t("Обновить")}</button></div><CampusFeedback error={action.error} success={action.success} />
      {revoke && <div className="panel campus-confirm" role="region" aria-labelledby="campus-revoke-title"><h3 id="campus-revoke-title">{t("Отозвать пакет для {name}?", { name: revoke.user.name })}</h3><p>{t("Неиспользованный остаток станет недоступен. Созданные публикации и история использования сохранятся. Это не удаление.")}</p><div className="campus-actions"><button className="btn outline-purple" disabled={action.busy} onClick={() => { void revokeGrant() }}>{action.busy ? t("Отзываем…") : t("Отозвать пакет")}</button><button className="btn outline" disabled={action.busy} onClick={() => setRevoke(null)}>{t("Отмена")}</button></div></div>}
      <CampusLoad loading={list.loading} error={list.error} retry={list.retry} />
      {list.data && <><div className="campus-grant-list">{list.data.items.map((grant) => <article className="panel campus-grant" key={grant.id}><div className="campus-grant-top"><span className="campus-person-icon" aria-hidden="true"><Gift size={22} /></span><div><h4>{grant.user.name}</h4><p>{grant.user.email}</p></div><span className={`campus-status ${grant.active ? 'verified' : 'revoked'}`}>{grant.revokedAt ? t("Отозван") : grant.active ? t("Активен") : t("Неактивен")}</span></div><strong>{t(CAMPUS_SERVICE[grant.service])}</strong><dl className="campus-member-details"><div><dt>{t("Выдано")}</dt><dd>{grant.quota}</dd></div><div><dt>{t("Использовано")}</dt><dd>{grant.used}</dd></div><div><dt>{t("Остаток")}</dt><dd>{grant.remaining}</dd></div><div><dt>{t("Действует до")}</dt><dd>{campusDate(grant.expiresAt, true)}</dd></div></dl>{!grant.revokedAt && <button className="link-purple" disabled={action.busy} onClick={() => { setRevoke(grant); action.setError(null) }}>{t("Отозвать остаток")}</button>}</article>)}</div>{list.data.items.length === 0 && <p className="campus-empty">{t("Пакетов пока нет. Начни с подтверждения студента и выдачи нужной услуги.")}</p>}<CampusPager page={list.data.page} total={list.data.total} pageSize={list.data.pageSize} loading={list.loading} change={setPage} /></>}
    </div></div>
  </section>
}

function GrantForm({ campusId, onGranted }: { campusId: string; onGranted: () => void }) {
  const { t } = useI18n()
  const { user } = useSite()
  const storageKey = `qadam.campus.grant.${user!.id}.${campusId}`
  const [attempt, setAttempt] = useState<GrantAttempt | null>(() => { try { return parseGrantAttempt(localStorage.getItem(storageKey)) } catch { return null } })
  const restored: GrantBody | null = attempt ? JSON.parse(attempt.payload) : null
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState<CampusStudent | null>(null)
  const [service, setService] = useState<BillingService>(restored?.service ?? 'publication')
  const [quota, setQuota] = useState(String(restored?.quota ?? 1))
  const [expires, setExpires] = useState('')
  const action = useCampusMutation()
  const submitting = useRef(false)
  const verified = useCampusQuery<CampusPage<CampusStudent>>(!attempt ? `/campus/${encodeURIComponent(campusId)}/students?${new URLSearchParams({ status: 'verified', q: query, page: String(page) })}` : null)

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (submitting.current) return
    submitting.current = true
    if (!attempt) {
      try {
        const saved = parseGrantAttempt(localStorage.getItem(storageKey))
        if (saved) { setAttempt(saved); action.setError('Есть сохранённая отправка. Проверь её результат перед новым пакетом.'); submitting.current = false; return }
      } catch { /* the guarded persistence below will report unavailable storage */ }
    }
    let request: GrantAttempt
    try {
      if (attempt) request = attempt
      else {
        if (!selected?.current || selected.status !== 'verified') throw new Error('Выбери студента с действующим подтверждением из списка.')
        const units = Number(quota)
        if (!Number.isSafeInteger(units) || units < 1 || units > 100_000) throw new Error('Укажи целое количество услуг от 1 до 100 000.')
        const body: GrantBody = { userId: selected.user.id, service, quota: units, expiresAt: futureExpiry(expires) }
        request = grantAttempt(body, null, newPublicationKey, selected.user.name)
        try { localStorage.setItem(storageKey, JSON.stringify(request)) } catch { throw new Error('Не удалось подготовить безопасную отправку. Проверь разрешения браузера и повтори.') }
        setAttempt(request)
      }
    } catch (error) { action.setError((error as Error).message); submitting.current = false; return }

    let definitiveFailure = false
    const success = await action.run(async (signal) => {
      try {
        await api.post(`/campus/${encodeURIComponent(campusId)}/grants`, JSON.parse(request.payload), { idempotencyKey: request.key, signal })
      } catch (error) {
        definitiveFailure = error instanceof ApiError && !uncertainCampusWrite(error.status) && !isAbortError(error)
        if (definitiveFailure) { try { localStorage.removeItem(storageKey) } catch { /* retain safe replay if storage is unavailable */ } }
        throw error
      }
    }, 'Результат отправки получен. Текущее состояние пакета — в истории ниже.')
    if (success) {
      try { localStorage.removeItem(storageKey) } catch { /* a replay remains safe */ }
      setAttempt(null); setSelected(null); setExpires(''); onGranted()
    } else if (definitiveFailure) { setAttempt(null); setSelected(null); verified.reload() }
    submitting.current = false
  }

  return <form className="panel campus-grant-form" onSubmit={(event) => { void submit(event) }} aria-labelledby="campus-grant-form-title"><span className="eyebrow">{t("ПОКРЫТИЕ ОТ ВУЗА")}</span><h3 id="campus-grant-form-title">{t("Выдать пакет студенту")}</h3><p className="campus-fine">{t("Пакет предоставляет услуги студенту без доплаты. Выдача пакета не подтверждает оплату университетом. Продвижение пока не активируется.")}</p>
    <CampusFeedback error={action.error} success={action.success} />
    {attempt ? <div className="campus-replay" role="status"><ShieldCheck size={22} aria-hidden="true" /><div><b>{action.busy ? t("Проверяем результат…") : t("Сохранена отправка пакета")}</b><p>{attempt.label} · {t(CAMPUS_SERVICE[restored!.service])} · {restored!.quota} · {t("До {date}", { date: campusDate(restored!.expiresAt, true) })}</p><p>{t("Повтор использует ту же операцию и не создаст второй пакет. Сначала проверь её результат; поля временно заблокированы.")}</p></div></div> : <>
      <label className="campus-search"><Search size={17} aria-hidden="true" /><input type="search" maxLength={200} onKeyDown={(event) => { if (event.key === 'Enter') event.preventDefault() }} value={query} placeholder={t("Найти подтверждённого студента")} aria-label={t("Поиск подтверждённых студентов")} disabled={action.busy} onChange={(e) => { setQuery(e.target.value); setPage(1) }} /></label>
      {selected && <p className="campus-selected-student"><Check size={17} aria-hidden="true" /><span>{t("Получатель:")} <b>{selected.user.name}</b></span><button type="button" className="link-purple" disabled={action.busy} onClick={() => setSelected(null)}>{t("Изменить")}</button></p>}
      <CampusLoad loading={verified.loading} error={verified.error} retry={verified.retry} />
      {verified.data && <><ul className="campus-student-picker" aria-label={t("Студенты с действующим подтверждением")}>{verified.data.items.filter((student) => student.status === 'verified' && student.current).map((student) => <li key={student.user.id}><button type="button" aria-pressed={selected?.user.id === student.user.id} disabled={action.busy} onClick={() => setSelected(student)}><span><b>{student.user.name}</b><small>{student.user.email}</small></span><span className="campus-picker-tick" aria-hidden="true">{selected?.user.id === student.user.id && <Check size={16} />}</span></button></li>)}</ul>{!verified.data.items.some((student) => student.current) && <p className="campus-fine">{t("На этой странице нет действующих подтверждений. Уточни поиск или проверь следующую страницу.")}</p>}<CampusPager page={verified.data.page} total={verified.data.total} pageSize={verified.data.pageSize} loading={verified.loading || action.busy} change={setPage} /></>}
    </>}
    <label className="fld"><span>{t("Услуга")}</span><select value={service} disabled={action.busy || Boolean(attempt)} onChange={(e) => setService(e.target.value as BillingService)}>{Object.entries(CAMPUS_SERVICE).map(([value, label]) => <option key={value} value={value}>{t(label)}</option>)}</select></label>
    <div className="campus-form-two"><label className="fld"><span>{t("Количество")}</span><input type="number" min={1} max={100000} step={1} value={quota} disabled={action.busy || Boolean(attempt)} onChange={(e) => setQuota(e.target.value)} required /></label><label className="fld"><span>{t("Действует до")}</span><input type="datetime-local" value={expires} disabled={action.busy || Boolean(attempt)} required={!attempt} onInput={(e) => setExpires(e.currentTarget.value)} onChange={(e) => setExpires(e.target.value)} /><small className="campus-fine">{t("Время по часовому поясу твоего устройства.")}</small></label></div>
    <button className="btn lime dblock" type="submit" disabled={action.busy || (!attempt && !selected)}>{action.busy ? t("Отправляем…") : attempt ? t("Проверить результат отправки") : t("Выдать пакет")}</button><p className="campus-fine">{t("При сетевой ошибке вернись сюда и повтори проверку. Сохранённая операция привязана к твоему аккаунту и этому кампусу.")}</p>
  </form>
}
