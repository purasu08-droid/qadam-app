import { Bookmark, CalendarDays } from 'lucide-react'
import { PEOPLE, type Project } from '../data/mock'
import { XP } from '../data/game'
import { useStore } from '../store'
import Avatar from './Avatar'

export default function ProjectCard({ p }: { p: Project }) {
  const { saved, toggleSaved, joined, join } = useStore()
  const isSaved = saved.includes(p.id)
  const isJoined = joined.includes(p.id)
  const author = PEOPLE[p.author]

  return (
    <article className="card project-card">
      <header>
        <span className="tag">{p.tag}</span>
        <span className="muted small">· {p.kind === 'event' ? p.date : p.stage}</span>
        <button
          className={`icon-btn bookmark ${isSaved ? 'on' : ''}`}
          aria-label="Сохранить"
          onClick={() => toggleSaved(p.id)}
        >
          <Bookmark size={18} fill={isSaved ? 'currentColor' : 'none'} />
        </button>
      </header>
      <h3>{p.title}</h3>
      <p className="muted clamp-2">{p.description}</p>
      {p.venue && (
        <p className="small muted row gap-6">
          <CalendarDays size={14} /> {p.venue}
        </p>
      )}
      {p.skills.length > 0 && (
        <div className="chips">
          {p.skills.map((s) => (
            <span key={s} className="chip sm">{s}</span>
          ))}
        </div>
      )}
      <footer>
        <Avatar id={p.author} size={26} />
        <span className="small">
          <b>{author?.name ?? 'Вы'}</b> <span className="muted">· {p.city}</span>
        </span>
        <button className={`btn-blue sm ${isJoined ? 'done' : ''}`} onClick={() => join(p.id)}>
          {isJoined ? 'Заявка отправлена' : p.kind === 'event' ? 'RSVP' : 'Join Team'}
          {!isJoined && <span className="xp-reward">+{XP.join} XP</span>}
        </button>
      </footer>
    </article>
  )
}
