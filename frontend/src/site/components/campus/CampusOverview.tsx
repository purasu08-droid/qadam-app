import { useI18n } from '../../i18n'
import { useState, type CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import { Activity, ArrowUpRight, CalendarDays, FileText, Users } from 'lucide-react'
import type { CampusOverview as Overview } from '../../campus-types'
import { campusActivity, campusDate } from '../../campus-helpers'
import { KINDS } from '../../data'
import { CampusLoad, useCampusQuery } from './CampusShared'

export default function CampusOverview({ campusId }: { campusId: string }) {
  const { t } = useI18n()
  const [days, setDays] = useState<7 | 30 | 90>(30)
  const overview = useCampusQuery<Overview>(`/campus/${encodeURIComponent(campusId)}/overview?days=${days}`)
  const data = overview.data
  const maximum = Math.max(1, ...(data?.daily.flatMap((d) => [d.publications, d.applications]) ?? []))
  return <section className="campus-section" aria-labelledby="campus-overview-title">
    <div className="campus-section-head"><div><h2 id="campus-overview-title">{t("Кампус в цифрах")}</h2><p>{t("Реальные публикации и действия участников")}</p></div><label className="campus-select"><span>{t("Период")}</span><select value={days} onChange={(e) => setDays(Number(e.target.value) as 7 | 30 | 90)}><option value={7}>{t("7 дней")}</option><option value={30}>{t("30 дней")}</option><option value={90}>{t("90 дней")}</option></select></label></div>
    <CampusLoad loading={overview.loading} error={overview.error} retry={overview.retry} />
    {data && <>
      <div className="campus-stats">
        <Stat icon={<Users size={21} />} title={t("Студенты")} value={data.counts.studentsTotal} note={t("Подтверждены: {count}", { count: data.counts.verifiedStudents })} />
        <Stat icon={<FileText size={21} />} title={t("Публикации")} value={data.counts.publications} note={t("За выбранный период")} />
        <Stat icon={<ArrowUpRight size={21} />} title={t("Отклики")} value={data.counts.applications} note={t("Заявки на публикации")} />
        <Stat icon={<Activity size={21} />} title={t("Активные студенты")} value={data.counts.activeStudents} note={t("Публиковали или откликались")} />
      </div>
      <div className="campus-summary-line"><span><i className="campus-dot pending" /> {t("Ожидают проверки:")} <b>{data.counts.pendingStudents}</b></span><span>{t("Скрытые за период:")} <b>{data.counts.hiddenPublications}</b></span><span>{t("«Я пойду» за всё время:")} <b>{data.counts.attendancesTotal}</b></span></div>
      <div className="campus-overview-grid">
        <figure className="panel campus-chart-panel"><figcaption><h3>{t("Активность по дням")}</h3><p>{campusDate(data.from)} — {campusDate(data.through)}</p></figcaption><div className="campus-chart-legend"><span><i className="campus-dot" />{t("Публикации")}</span><span><i className="campus-dot purple" />{t("Отклики")}</span></div>
          {data.daily.some((day) => day.publications || day.applications) ? <div className="campus-chart-scroll" tabIndex={0} role="region" aria-label={t("Ежедневная активность, можно прокрутить")}><div className="campus-chart" style={{ minWidth: Math.max(240, data.daily.length * 26) }}>
            {data.daily.map((day) => <div key={day.date} className="campus-chart-day" role="img" aria-label={t("{date}: публикаций {publications}, откликов {applications}", { date: campusDate(day.date), publications: day.publications, applications: day.applications })}><div className="campus-chart-bars"><i style={{ '--bar-height': `${day.publications / maximum * 100}%` } as CSSProperties} /><i className="applications" style={{ '--bar-height': `${day.applications / maximum * 100}%` } as CSSProperties} /></div><span aria-hidden="true">{Number(day.date.slice(8))}</span></div>)}
          </div></div> : <p className="campus-empty">{t("За этот период ещё нет публикаций и откликов.")}</p>}
          <p className="campus-fine">{t("Активные студенты — участники кампуса, которые публиковали или откликались в выбранном периоде. Переписка и просмотры не учитываются.")}</p>
        </figure>
        <section className="panel campus-kind-panel" aria-labelledby="campus-kinds-title"><h3 id="campus-kinds-title">{t("Что создаёт кампус")}</h3>{data.byKind.length && data.byKind.some((entry) => entry.count > 0) ? data.byKind.map((entry) => <div className="campus-kind-row" key={entry.kind}><span>{t(KINDS[entry.kind]?.plural ?? "Публикации")}</span><b>{entry.count}</b><div className="campus-kind-track"><i style={{ width: `${entry.count / Math.max(1, ...data.byKind.map((kind) => kind.count)) * 100}%` }} /></div></div>) : <p className="campus-empty">{t("Публикаций пока нет.")}</p>}</section>
      </div>
      <section className="panel campus-activity"><div className="campus-section-head"><h3>{t("Последние действия")}</h3><CalendarDays size={20} aria-hidden="true" /></div>{data.recentActivity.length ? <ul>{data.recentActivity.map((item) => <li key={item.id}><span className="campus-activity-mark" aria-hidden="true" /><div><b>{t(campusActivity(item.action))}</b><time dateTime={item.createdAt}>{campusDate(item.createdAt, true)}</time></div>{item.action.startsWith('publication_') && item.targetId && <Link to={`/p/${encodeURIComponent(item.targetId)}`} className="link-purple">{t("Публикация")} <ArrowUpRight size={15} aria-hidden="true" /></Link>}</li>)}</ul> : <p className="campus-empty">{t("Здесь появится история действий кампуса.")}</p>}</section>
    </>}
  </section>
}

function Stat({ icon, title, value, note }: { icon: React.ReactNode; title: string; value: number; note: string }) {
  const { locale } = useI18n()
  return <article className="panel campus-stat"><span className="campus-stat-icon" aria-hidden="true">{icon}</span><p>{title}</p><strong>{value.toLocaleString(locale)}</strong><small>{note}</small></article>
}
