import { PEOPLE } from '../data/mock'

export default function Avatar({ id, size = 32, online }: { id: string; size?: number; online?: boolean }) {
  const p = PEOPLE[id]
  const initials = p ? p.name.split(' ').map((w) => w[0]).join('') : '?'
  return (
    <span
      className="avatar"
      style={{ width: size, height: size, background: p?.color ?? '#999', fontSize: size * 0.38 }}
    >
      {initials}
      {online && <i className="online-dot" />}
    </span>
  )
}
