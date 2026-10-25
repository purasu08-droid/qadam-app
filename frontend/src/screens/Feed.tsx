import { useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { CalendarDays, ChevronLeft, Layers, Search, SlidersHorizontal, Users } from 'lucide-react'
import ProjectCard from '../components/ProjectCard'
import FilterSheet, { EMPTY_FILTERS, type Filters } from '../components/FilterSheet'
import { CATEGORIES, PEOPLE, type CategoryKey } from '../data/mock'
import { useStore } from '../store'
import Avatar from '../components/Avatar'

type Tab = 'all' | 'projects' | 'events' | 'people'

export default function Feed() {
  const nav = useNavigate()
  const [params] = useSearchParams()
  const category = params.get('category') as CategoryKey | null
  const { projects } = useStore()
  const [query, setQuery] = useState(params.get('q') ?? '')
  const [tab, setTab] = useState<Tab>('all')
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS)
  const [showFilter, setShowFilter] = useState(false)
  const activeFilters = Object.values(filters).filter(Boolean).length

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return projects.filter(
      (p) =>
        (!category || p.category === category) &&
        (!filters.city || p.city === filters.city) &&
        (!filters.stage || p.stage === filters.stage) &&
        (!filters.skill || p.skills.includes(filters.skill)) &&
        (!filters.remoteOnly || p.remote) &&
        (!q || (p.title + p.description + p.skills.join(' ')).toLowerCase().includes(q)),
    )
  }, [projects, category, filters, query])

  const people = useMemo(() => {
    const q = query.trim().toLowerCase()
    return Object.values(PEOPLE).filter(
      (p) => (!filters.city || p.city === filters.city) && (!q || (p.name + p.role).toLowerCase().includes(q)),
    )
  }, [filters.city, query])

  const projectsOnly = filtered.filter((p) => p.kind === 'project')
  const eventsOnly = filtered.filter((p) => p.kind === 'event')
  const list = tab === 'projects' ? projectsOnly : tab === 'events' ? eventsOnly : tab === 'all' ? filtered : []
  const total = tab === 'people' ? people.length : list.length + (tab === 'all' ? people.length : 0)

  const tabs: { key: Tab; label: string; count?: number; Icon?: typeof Layers }[] = [
    { key: 'all', label: 'All' },
    { key: 'projects', label: 'Projects', count: projectsOnly.length, Icon: Layers },
    { key: 'events', label: 'Events', count: eventsOnly.length, Icon: CalendarDays },
    { key: 'people', label: 'People', count: people.length, Icon: Users },
  ]

  return (
    <div className="feed">
      <div className="top-bar">
        <button className="icon-btn" onClick={() => nav('/places')} aria-label="Назад"><ChevronLeft size={22} /></button>
        <button className={`icon-btn ${activeFilters ? 'badge' : ''}`} onClick={() => setShowFilter(true)} aria-label="Фильтр">
          <SlidersHorizontal size={20} />
        </button>
        <form className="search" onSubmit={(e) => e.preventDefault()}>
          <input placeholder="Noktalar ara" value={query} onChange={(e) => setQuery(e.target.value)} />
          <Search size={16} />
        </form>
      </div>
      {category && <div className="px feed-title" style={{ color: CATEGORIES[category].color === '#141418' ? '#111' : CATEGORIES[category].color }}>{CATEGORIES[category].title}</div>}
      <div className="tab-strip">
        {tabs.map(({ key, label, count, Icon }) => (
          <button key={key} className={tab === key ? 'active' : ''} onClick={() => setTab(key)}>
            {Icon && <Icon size={15} />} {label} {count !== undefined && <span className="muted">({count})</span>}
          </button>
        ))}
      </div>
      <div className="results muted small">{total} результатов</div>
      <div className="list">
        {list.map((p) => <ProjectCard key={p.id} p={p} />)}
        {(tab === 'people' || tab === 'all') &&
          people.map((p) => (
            <article key={p.id} className="card person-card">
              <Avatar id={p.id} size={44} />
              <div>
                <b>{p.name}</b>
                <div className="small muted">{p.role} · {p.city}</div>
              </div>
              <button className="btn-ghost sm" onClick={() => nav('/messages')}>Написать</button>
            </article>
          ))}
        {total === 0 && <p className="empty">Ничего не найдено. Попробуйте изменить фильтры.</p>}
      </div>
      {showFilter && <FilterSheet value={filters} onChange={setFilters} onClose={() => setShowFilter(false)} />}
    </div>
  )
}
