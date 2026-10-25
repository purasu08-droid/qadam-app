import { useNavigate } from 'react-router-dom'
import { CalendarDays, ChevronRight, Layers, LogOut, Star } from 'lucide-react'
import { useStore } from '../store'

const SKILLS = ['Figma', 'UI/UX Design', 'Design Systems', 'Motion Design', 'Prototyping']

export default function Profile() {
  const nav = useNavigate()
  const { signOut, projects, joined } = useStore()
  const upcoming = projects.filter((p) => p.kind === 'event' && (joined.includes(p.id) || ['ca-summit', 'shymkent-founders'].includes(p.id)))

  return (
    <div className="profile">
      <div className="row between px pt">
        <button className="icon-btn" aria-label="Выйти" onClick={() => { signOut(); nav('/welcome', { replace: true }) }}>
          <LogOut size={18} />
        </button>
        <button className="btn-soft sm">Edit Profile</button>
      </div>
      <section className="profile-head px">
        <div className="photo">ZU</div>
        <div>
          <h2>Zhantore Uspanov</h2>
          <span className="verified">Verified</span>
          <div className="role">UI/UX Designer</div>
          <div className="small"><i className="dot-green" /> Astana <span className="muted">· Online</span></div>
        </div>
      </section>
      <section className="stats px">
        <div><b>3</b><span>PROJECTS</span></div>
        <div><b><Star size={18} fill="var(--blue)" color="var(--blue)" /> 4.5</b><span>RATING</span></div>
        <div><b>13</b><span>REVIEWS</span></div>
      </section>
      <section className="px">
        <h5 className="section-label">ABOUT</h5>
        <p className="about">
          Product designer passionate about building tech ventures in Central Asia. Exploring AI interfaces, design
          systems, and mobile UX. Open to early-stage co-founding.
        </p>
        <h5 className="section-label">SKILLS</h5>
        <div className="chips">{SKILLS.map((s) => <span key={s} className="chip">{s}</span>)}</div>
      </section>

      <section className="px block">
        <h3 className="row gap-8"><Layers size={20} color="var(--blue)" /> My Projects &amp; Teams (1)</h3>
        <div className="card mini-card">
          <div>
            <div className="small"><span className="tag">Startup</span> <span className="muted">Development Stage</span></div>
            <b className="ellipsis">NomadCode AI — Kazakh Language Copilot</b>
            <div className="small muted">3 / 5 members · Almaty</div>
          </div>
          <button className="link blue" onClick={() => nav('/add')}>Manage</button>
        </div>

        <h3 className="row gap-8"><CalendarDays size={20} color="#22a06b" /> My Upcoming Events ({upcoming.length})</h3>
        {upcoming.map((e) => (
          <div key={e.id} className="card mini-card">
            <div>
              <span className="rsvp">RSVP Confirmed</span>
              <b className="ellipsis">{e.title}</b>
              <div className="small muted">{e.date} · {e.venue}</div>
            </div>
            <button className="link green">View Pass <ChevronRight size={14} /></button>
          </div>
        ))}
      </section>
    </div>
  )
}
