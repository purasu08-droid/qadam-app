import { useI18n } from '../../i18n'
import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { ArrowUpRight, Eye, EyeOff } from 'lucide-react'
import { api } from '../../api'
import type { CampusPage, CampusPublication } from '../../campus-types'
import { campusDate } from '../../campus-helpers'
import { useSite } from '../../state'
import { KindBadge } from '../ui'
import { CampusFeedback, CampusLoad, CampusPager, CampusSearch, useCampusMutation, useCampusQuery } from './CampusShared'

export default function CampusPublications({ campusId }: { campusId: string }) {
  const { t } = useI18n()
  const { reloadOpportunities } = useSite()
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('all')
  const [page, setPage] = useState(1)
  const [target, setTarget] = useState<CampusPublication | null>(null)
  const [reason, setReason] = useState('')
  const action = useCampusMutation()
  const list = useCampusQuery<CampusPage<CampusPublication>>(`/campus/${encodeURIComponent(campusId)}/publications?${new URLSearchParams({ q: query, status, page: String(page) })}`)
  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!target || reason.trim().length < 3) return action.setError('Укажи причину: минимум 3 символа.')
    const chosen = target
    const success = await action.run(async (signal) => {
      await api.patch(`/campus/${encodeURIComponent(campusId)}/publications/${encodeURIComponent(chosen.id)}`, { hidden: !chosen.campusHidden, reason: reason.trim() }, { signal })
    }, chosen.campusHidden ? 'Публикация восстановлена.' : 'Публикация скрыта. Её можно восстановить.')
    if (success) { setTarget(null); list.reload(); void reloadOpportunities() }
  }
  if (list.accessDenied) return <CampusLoad loading={list.loading} error={list.error} retry={list.retry} />
  return <section className="campus-section" aria-labelledby="campus-publications-title"><div className="campus-section-head"><div><h2 id="campus-publications-title">{t("Публикации кампуса")}</h2><p>{t("Модерация сохраняет публикацию и историю действий")}</p></div></div>
    <div className="campus-tools"><CampusSearch value={query} label={t("Поиск публикаций")} onChange={(q) => { setQuery(q); setPage(1) }} /><label className="campus-select"><span>{t("Видимость")}</span><select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1) }}><option value="all">{t("Все публикации")}</option><option value="visible">{t("Видимые")}</option><option value="hidden">{t("Скрытые")}</option></select></label></div>
    <CampusFeedback error={action.error} success={action.success} />
    {target && <form className="panel campus-confirm" onSubmit={(event) => { void submit(event) }} aria-labelledby="campus-moderation-title"><h3 id="campus-moderation-title">{t(target.campusHidden ? "Восстановить «{title}»?" : "Скрыть «{title}»?", { title: target.title })}</h3><p>{target.campusHidden ? t("Публикация снова появится в доступных пользователям списках.") : t("Публикация исчезнет из общих списков. Действие можно отменить восстановлением.")}</p><label className="fld"><span>{t("Причина действия")}</span><textarea value={reason} maxLength={500} minLength={3} required disabled={action.busy} rows={3} onChange={(e) => setReason(e.target.value)} /></label><div className="campus-actions"><button className="btn lime" type="submit" disabled={action.busy}>{action.busy ? t("Сохраняем…") : target.campusHidden ? t("Восстановить") : t("Скрыть публикацию")}</button><button className="btn outline" type="button" disabled={action.busy} onClick={() => setTarget(null)}>{t("Отмена")}</button></div></form>}
    <CampusLoad loading={list.loading} error={list.error} retry={list.retry} />
    {list.data && <><div className="campus-publication-list">{list.data.items.map((item) => <article key={item.id} className="panel campus-publication"><div className="campus-publication-meta"><KindBadge kind={item.kind} /><span className={`campus-status ${item.campusHidden ? 'revoked' : 'verified'}`}>{item.campusHidden ? t("Скрыта") : t("Видима")}</span><time dateTime={item.createdAt}>{campusDate(item.createdAt)}</time></div><h3><Link to={`/p/${encodeURIComponent(item.id)}`}>{item.title}</Link></h3><p className="campus-fine">{item.author?.name ?? t("Автор не указан")} · {t(item.city)}</p>{item.moderationReason && <p className="campus-moderation-reason">{t("Причина последнего действия:")} {item.moderationReason}</p>}<div className="campus-actions"><Link className="btn outline sm" to={`/p/${encodeURIComponent(item.id)}`}>{t("Открыть")} <ArrowUpRight size={16} /></Link><button className="btn outline-purple sm" disabled={action.busy} onClick={() => { setTarget(item); setReason(''); action.setError(null) }}>{item.campusHidden ? <Eye size={16} /> : <EyeOff size={16} />}{item.campusHidden ? t("Восстановить") : t("Скрыть")}</button></div></article>)}</div>{list.data.items.length === 0 && <p className="campus-empty">{t("Публикаций с такими условиями пока нет.")}</p>}<CampusPager page={list.data.page} total={list.data.total} pageSize={list.data.pageSize} loading={list.loading} change={setPage} /></>}
  </section>
}
