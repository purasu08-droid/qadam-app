import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, ChevronDown, MessageCircle, Plus, Search } from 'lucide-react'
import type { ProjectItem } from '../api'
import { STATUS, type ProjectStatus } from '../data'
import { useApi } from '../state'
import { AvatarStack, PageHead } from '../components/ui'
import { useI18n } from '../i18n'

const FILTERS = ['Все', 'Мои', 'Участвую', 'Архив'] as const

export default function MyProjects() {
  const { t } = useI18n()
  const { data, error } = useApi<{ items: ProjectItem[] }>('/projects')
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>('Все')
  const [q, setQ] = useState('')
  const [status, setStatus] = useState<ProjectStatus | ''>('')

  const list = (data?.items ?? []).filter(
    (p) =>
      (filter === 'Все' || (filter === 'Мои' ? p.mine : filter === 'Участвую' ? !p.mine : p.status === 'done')) &&
      (!status || p.status === status) &&
      `${p.title} ${p.text}`.toLowerCase().includes(q.trim().toLowerCase()),
  )

  return (
    <div className="page myprojects">
      <PageHead title={t('Мои проекты')} sub={t('Развивайте идеи вместе с командой')}>
        <Link to="/create" className="btn outline lg"><Plus size={20} /> {t('Создать проект')}</Link>
      </PageHead>

      <div className="mp-bar">
        <div className="pills">
          {FILTERS.map((f) => (
            <button key={f} className={filter === f ? 'on' : ''} onClick={() => setFilter(f)}>{t(f)}</button>
          ))}
        </div>
        <span className="grow" />
        <label className="input-icon">
          <Search size={18} />
          <input aria-label={t('Поиск проектов')} placeholder={t('Поиск проектов')} value={q} onChange={(e) => setQ(e.target.value)} />
        </label>
        <span className="select">
          <select aria-label={t('Статус')} value={status} onChange={(e) => setStatus(e.target.value as ProjectStatus | '')}>
            <option value="">{t('Статус')}</option>
            {(Object.keys(STATUS) as ProjectStatus[]).map((s) => <option key={s} value={s}>{t(STATUS[s])}</option>)}
          </select>
          <ChevronDown size={18} />
        </span>
      </div>

      <div className="grid3">
        {list.map((p) => {
          const open = p.opportunityId ? `/p/${p.opportunityId}` : p.conversationId ? `/chats/${p.conversationId}` : null
          return (
            <article key={p.id} className="pj-card">
              <div className="pj-cover">
                <img src={p.cover ?? '/img/cover-nomadcode.jpg'} alt="" />
                <span className={`flag ${p.mine ? 'mine' : ''}`}>{t(p.mine ? 'Мой проект' : 'Участвую')}</span>
              </div>
              <div className="pj-body">
                <h3>{p.title}</h3>
                <p className="muted">{p.text}</p>
                <span className={`status s-${p.status}`}>{t(STATUS[p.status])}</span>
                <AvatarStack people={p.team.slice(0, 5)} size={34} />
                <p className="pj-note">{p.note}</p>
                <div className="pj-actions">
                  {open ? (
                    <Link to={open} className="btn outline grow">
                      {t(p.status === 'done' ? 'Посмотреть результат' : 'Открыть проект')} <ArrowRight size={16} />
                    </Link>
                  ) : (
                    <span className="btn outline grow" aria-disabled>{t('Страница проекта скоро')}</span>
                  )}
                  <Link to={p.conversationId ? `/chats/${p.conversationId}` : '/chats'} className="btn outline icon" aria-label={t('Чат проекта')}><MessageCircle size={18} /></Link>
                </div>
              </div>
            </article>
          )
        })}
      </div>
      {error && <p className="err">{t(error)}</p>}
      {data && list.length === 0 && (
        <p className="empty">{t(data.items.length ? 'Проектов не найдено.' : 'Проектов пока нет. Создай публикацию — она появится здесь.')}</p>
      )}
    </div>
  )
}
