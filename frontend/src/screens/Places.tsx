import { useCallback, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Bell, ChevronRight, MapPin, Search, X } from 'lucide-react'
import Segmented from '../components/Segmented'
import MapView from '../components/MapView'
import ProjectCard from '../components/ProjectCard'
import { CATEGORIES, CATEGORY_COUNTS, CATEGORY_ORDER, type Project } from '../data/mock'
import { useStore } from '../store'

type View = 'categories' | 'map'

export default function Places() {
  const nav = useNavigate()
  const [params, setParams] = useSearchParams()
  const view = (params.get('view') as View) ?? 'categories'
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<Project | null>(null)
  const { projects } = useStore()

  const countFor = (k: (typeof CATEGORY_ORDER)[number]) =>
    CATEGORY_COUNTS[k] + projects.filter((p) => p.category === k && p.id.startsWith('new-')).length

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    return q ? projects.filter((p) => (p.title + p.city + p.skills.join(' ')).toLowerCase().includes(q)) : projects
  }, [projects, query])

  const onSelect = useCallback((p: Project) => setSelected(p), [])

  return (
    <div className={`places ${view === 'map' ? 'is-map' : ''}`}>
      <div className="top-bar">
        <form
          className="search"
          onSubmit={(e) => {
            e.preventDefault()
            if (view === 'categories') nav(`/feed?q=${encodeURIComponent(query)}`)
          }}
        >
          <input placeholder="Search Places" value={query} onChange={(e) => setQuery(e.target.value)} />
          <Search size={16} />
        </form>
        <button className="icon-btn" aria-label="Уведомления"><Bell size={20} /></button>
      </div>
      <div className="px">
        <Segmented
          value={view}
          onChange={(v) => setParams(v === 'map' ? { view: 'map' } : {}, { replace: true })}
          options={[
            { value: 'categories', label: 'Categories' },
            { value: 'map', label: 'Map' },
          ]}
        />
      </div>

      {view === 'categories' ? (
        <div className="category-stack">
          {CATEGORY_ORDER.map((k) => {
            const c = CATEGORIES[k]
            return (
              <button
                key={k}
                className="category-band"
                style={{ background: c.color, color: c.accent }}
                onClick={() => nav(`/feed?category=${k}`)}
              >
                <span className="cat-title">{c.title}</span>
                <span className="cat-count">
                  {countFor(k)}
                  <br />
                  results
                </span>
                <ChevronRight size={30} strokeWidth={2.4} />
              </button>
            )
          })}
        </div>
      ) : (
        <div className="map-wrap">
          <MapView projects={visible} onSelect={onSelect} />
          {selected ? (
            <div className="map-sheet">
              <button className="icon-btn close" onClick={() => setSelected(null)} aria-label="Закрыть"><X size={18} /></button>
              <ProjectCard p={selected} />
            </div>
          ) : (
            <div className="map-hint">
              <MapPin size={14} /> Tap any marker to explore projects &amp; events in Kazakhstan
            </div>
          )}
        </div>
      )}
    </div>
  )
}
