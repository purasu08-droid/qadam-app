import { useState } from 'react'
import {
  ArrowLeft, ArrowRight, Briefcase, CalendarDays, Check, ChevronDown, Eye, Lightbulb,
  MoreHorizontal, Save, Sparkles, Users, Wand2, X,
} from 'lucide-react'
import Segmented from '../components/Segmented'
import { CATEGORIES, CITIES, STAGES, type CategoryKey, type MyProject } from '../data/mock'
import { useStore } from '../store'

type Tab = 'mine' | 'create'

export default function Add() {
  const [tab, setTab] = useState<Tab>('mine')
  return (
    <div className="add">
      <div className="px pt">
        <Segmented
          value={tab}
          onChange={setTab}
          options={[
            { value: 'mine', label: 'Мои проекты' },
            { value: 'create', label: 'Создать' },
          ]}
        />
      </div>
      {tab === 'mine' ? <MyProjects onCreate={() => setTab('create')} /> : <CreateWizard onDone={() => setTab('mine')} />}
    </div>
  )
}

const ICONS = { users: Users, bulb: Lightbulb, calendar: CalendarDays, briefcase: Briefcase }

function MyProjects({ onCreate }: { onCreate: () => void }) {
  const { myProjects } = useStore()
  const [open, setOpen] = useState<string[]>([])
  const allOpen = open.length === myProjects.length
  const toggle = (id: string) => setOpen((o) => (o.includes(id) ? o.filter((x) => x !== id) : [...o, id]))

  return (
    <div className="my-projects">
      <div className="row between px">
        <span className="small muted">{myProjects.length} проектов</span>
        <button className="link blue small" onClick={() => setOpen(allOpen ? [] : myProjects.map((p) => p.id))}>
          {allOpen ? 'Свернуть все' : 'Развернуть все'}
        </button>
      </div>
      {myProjects.map((p) => (
        <MyProjectCard key={p.id} p={p} expanded={open.includes(p.id)} onToggle={() => toggle(p.id)} />
      ))}
      <button className="btn-dashed" onClick={onCreate}>+ Создать проект</button>
    </div>
  )
}

function MyProjectCard({ p, expanded, onToggle }: { p: MyProject; expanded: boolean; onToggle: () => void }) {
  const Icon = ICONS[p.icon]
  return (
    <div
      className={`mp-card ${expanded ? 'expanded' : ''}`}
      style={{ background: `linear-gradient(135deg, ${p.color}, color-mix(in srgb, ${p.color} 70%, #000))` }}
      onClick={onToggle}
      role="button"
      aria-expanded={expanded}
    >
      <div className="mp-icon"><Icon size={22} /></div>
      {expanded ? (
        <div className="mp-body">
          <div className="row between gap-8">
            <h3>{p.title}</h3>
            <span className="mp-badge" style={{ background: p.badgeColor }}>{p.badge}</span>
          </div>
          <p>{p.description}</p>
          <div className="row between mp-meta">
            <span className="row gap-12">
              <span className="row gap-4"><Eye size={15} /> {p.views}</span>
              {p.members !== undefined && <span className="row gap-4"><Users size={15} /> {p.members}</span>}
            </span>
            <MoreHorizontal size={18} />
          </div>
        </div>
      ) : (
        <div className="mp-collapsed">
          <span>{p.title}</span>
          <ChevronDown size={22} />
        </div>
      )}
    </div>
  )
}

type Draft = {
  category: CategoryKey | null
  name: string
  type: string
  stage: string
  city: string
  remote: boolean
  description: string
  pitch: string
  skills: string
  teamSize: number
  deadline: string
}

const EMPTY: Draft = {
  category: null, name: '', type: 'Startup', stage: 'Planning', city: 'Almaty', remote: false,
  description: '', pitch: '', skills: '', teamSize: 4, deadline: '2026-11-30',
}

const CITY_COORDS: Record<string, [number, number]> = {
  Almaty: [43.238, 76.889], Astana: [51.169, 71.449], Shymkent: [42.341, 69.59], Karaganda: [49.806, 73.085],
  Aktobe: [50.283, 57.167], Atyrau: [47.094, 51.923], Pavlodar: [52.287, 76.967],
}

const CREATE_ICONS: Record<CategoryKey, typeof Users> = { meetups: Users, jobs: Briefcase, ideas: Lightbulb, events: CalendarDays }

function loadDraft(): Draft {
  try {
    const raw = localStorage.getItem('qadam.draft')
    return raw ? { ...EMPTY, ...JSON.parse(raw) } : EMPTY
  } catch {
    return EMPTY
  }
}

function CreateWizard({ onDone }: { onDone: () => void }) {
  const { publish } = useStore()
  const [step, setStep] = useState(1)
  const [d, setD] = useState<Draft>(loadDraft)
  const [error, setError] = useState('')
  const [savedNote, setSavedNote] = useState(false)
  const [refining, setRefining] = useState(false)
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((x) => ({ ...x, [k]: v }))

  const saveDraft = () => {
    try { localStorage.setItem('qadam.draft', JSON.stringify(d)) } catch { /* ignore */ }
    setSavedNote(true)
    setTimeout(() => setSavedNote(false), 1500)
  }
  const reset = () => {
    try { localStorage.removeItem('qadam.draft') } catch { /* ignore */ }
    setD(EMPTY)
    setStep(1)
    setError('')
  }

  const next = () => {
    if (step === 1 && !d.category) return setError('Выберите тип инициативы')
    if (step === 2 && !d.name.trim()) return setError('Укажите название проекта')
    setError('')
    setStep((s) => s + 1)
  }

  // Заглушка AI: собирает питч и роли из описания. Замените на вызов бэкенда.
  const refine = () => {
    setRefining(true)
    setTimeout(() => {
      const desc = d.description.trim() || 'a product for the Kazakhstan tech community'
      const firstSentence = desc.split(/[.!?]/)[0]
      set('pitch', `${d.name || 'Our project'} — ${firstSentence.charAt(0).toLowerCase()}${firstSentence.slice(1)}. We are a ${d.stage.toLowerCase()}-stage ${d.type.toLowerCase()} in ${d.city} looking for a team to make it real.`)
      if (!d.skills.trim()) set('skills', d.category === 'events' ? 'Event Management, Marketing, Design' : 'UI/UX Design, React, Python')
      setRefining(false)
    }, 900)
  }

  const submit = () => {
    if (!d.category) return
    const id = `new-${Date.now()}`
    const cat = CATEGORIES[d.category]
    const skills = d.skills.split(',').map((s) => s.trim()).filter(Boolean)
    publish(
      {
        id, kind: d.category === 'events' ? 'event' : 'project', category: d.category, tag: d.type, stage: d.stage,
        title: d.name, description: d.pitch || d.description, skills, author: 'zhantore', city: d.city,
        remote: d.remote, coords: CITY_COORDS[d.city],
        ...(d.category === 'events' ? { date: new Date(d.deadline).toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' }), venue: d.city } : {}),
      },
      {
        id, title: d.name, badge: 'Идет набор', badgeColor: '#e3197b', description: d.pitch || d.description,
        views: 0, members: 1, color: cat.color === '#141418' ? '#2a2a33' : cat.color,
        icon: d.category === 'events' ? 'calendar' : d.category === 'jobs' ? 'briefcase' : d.category === 'ideas' ? 'bulb' : 'users',
      },
    )
    reset()
    onDone()
  }

  const titles = ['What would you like to create?', 'Essential Details', 'Requirements & AI Polish']

  return (
    <div className="wizard card">
      <header className="wizard-head">
        <div>
          <div className="small"><b className="blue">STEP {step} OF 3</b> · Create Project</div>
          <h3>{titles[step - 1]}</h3>
        </div>
        <button className="icon-btn" onClick={saveDraft} aria-label="Сохранить черновик">{savedNote ? <Check size={18} /> : <Save size={18} />}</button>
        <button className="icon-btn" onClick={reset} aria-label="Сбросить"><X size={18} /></button>
      </header>

      <div className="wizard-body">
        {step === 1 && (
          <>
            <p className="muted">Choose the type of initiative you want to bring to the QADAM community in Kazakhstan:</p>
            <div className="type-grid">
              {(Object.keys(CATEGORIES) as CategoryKey[]).map((k) => {
                const c = CATEGORIES[k]
                const Icon = CREATE_ICONS[k]
                return (
                  <button
                    key={k}
                    className={`type-tile ${d.category === k ? 'selected' : ''}`}
                    style={{ background: k === 'events' ? '#1d2733' : k === 'jobs' ? '#e3a614' : c.color }}
                    onClick={() => set('category', k)}
                  >
                    <Icon size={30} strokeWidth={1.6} />
                    <b>{c.title}</b>
                    <span>{c.description}</span>
                  </button>
                )
              })}
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <label className="fld">Project Name *
              <input value={d.name} onChange={(e) => set('name', e.target.value)} placeholder="e.g. NomadCode AI, SteppeEco, Dala UI" />
            </label>
            <div className="grid-2">
              <label className="fld">Category
                <select value={d.type} onChange={(e) => set('type', e.target.value)}>
                  {['Startup', 'Social impact', 'Open source', 'Research', 'Community'].map((x) => <option key={x}>{x}</option>)}
                </select>
              </label>
              <label className="fld">Current Stage
                <select value={d.stage} onChange={(e) => set('stage', e.target.value)}>
                  {STAGES.map((x) => <option key={x}>{x}</option>)}
                </select>
              </label>
            </div>
            <div className="grid-2 align-end">
              <label className="fld">Location / City
                <select value={d.city} onChange={(e) => set('city', e.target.value)}>
                  {CITIES.map((x) => <option key={x}>{x}</option>)}
                </select>
              </label>
              <label className="check">
                <input type="checkbox" checked={d.remote} onChange={(e) => set('remote', e.target.checked)} /> Remote / Online Team
              </label>
            </div>
            <label className="fld">Project Description
              <textarea rows={4} value={d.description} onChange={(e) => set('description', e.target.value)} placeholder="Explain the problem you're solving, target audience, and current progress..." />
            </label>
          </>
        )}

        {step === 3 && (
          <>
            <div className="ai-box">
              <div className="row between gap-8">
                <b className="row gap-6 blue"><Wand2 size={16} /> AI Project Assistant</b>
                <button className="btn-blue sm" onClick={refine} disabled={refining}>
                  <Sparkles size={15} /> {refining ? 'Thinking…' : 'Refine with AI'}
                </button>
              </div>
              <p className="small blue-muted">Generate a compelling 2-sentence elevator pitch and recommended team roles.</p>
              <label className="fld">Elevator Pitch / Tagline
                <textarea rows={2} value={d.pitch} onChange={(e) => set('pitch', e.target.value)} placeholder="Concise mission statement for investor/talent" />
              </label>
            </div>
            <label className="fld">Required Skills &amp; Roles (comma separated)
              <input value={d.skills} onChange={(e) => set('skills', e.target.value)} placeholder="UI/UX Design, React, Python" />
              <span className="tiny muted">Candidates will be matched by these skills.</span>
            </label>
            <div className="grid-2">
              <label className="fld">Target Team Size
                <input type="number" min={1} max={50} value={d.teamSize} onChange={(e) => set('teamSize', Number(e.target.value))} />
              </label>
              <label className="fld">Application Deadline
                <input type="date" value={d.deadline} onChange={(e) => set('deadline', e.target.value)} />
              </label>
            </div>
          </>
        )}
        {error && <p className="error">{error}</p>}
      </div>

      <footer className="wizard-foot">
        {step > 1 ? (
          <button className="btn-ghost" onClick={() => setStep((s) => s - 1)}><ArrowLeft size={16} /> Back</button>
        ) : <span />}
        {step < 3 ? (
          <button className="btn-blue" onClick={next}>Continue <ArrowRight size={16} /></button>
        ) : (
          <button className="btn-blue" onClick={submit}><Check size={16} /> Publish project</button>
        )}
      </footer>
    </div>
  )
}
