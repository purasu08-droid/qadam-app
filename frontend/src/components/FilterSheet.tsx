import { Filter } from 'lucide-react'
import { CITIES, SKILLS, STAGES } from '../data/mock'

export type Filters = { city: string; stage: string; skill: string; remoteOnly: boolean }
export const EMPTY_FILTERS: Filters = { city: '', stage: '', skill: '', remoteOnly: false }

type Props = { value: Filters; onChange: (f: Filters) => void; onClose: () => void }

export default function FilterSheet({ value, onChange, onClose }: Props) {
  const set = <K extends keyof Filters>(k: K, v: Filters[K]) => onChange({ ...value, [k]: v })
  return (
    <div className="overlay" onClick={onClose}>
      <div className="filter-sheet" onClick={(e) => e.stopPropagation()}>
        <h4 className="row gap-6">
          <Filter size={14} color="var(--blue)" /> FILTER KAZAKHSTAN DIRECTORY
        </h4>
        <label>
          REGION / CITY
          <select value={value.city} onChange={(e) => set('city', e.target.value)}>
            <option value="">All</option>
            {CITIES.map((c) => <option key={c}>{c}</option>)}
          </select>
        </label>
        <label>
          PROJECT STAGE
          <select value={value.stage} onChange={(e) => set('stage', e.target.value)}>
            <option value="">All</option>
            {STAGES.map((c) => <option key={c}>{c}</option>)}
          </select>
        </label>
        <label>
          SKILL / ROLE NEEDED
          <select value={value.skill} onChange={(e) => set('skill', e.target.value)}>
            <option value="">All Skills</option>
            {SKILLS.map((c) => <option key={c}>{c}</option>)}
          </select>
        </label>
        <div className="row between">
          <label className="check">
            <input
              type="checkbox"
              checked={value.remoteOnly}
              onChange={(e) => set('remoteOnly', e.target.checked)}
            />
            Online / Remote Friendly only
          </label>
          <button className="btn-ghost sm" onClick={onClose}>Done</button>
        </div>
      </div>
    </div>
  )
}
