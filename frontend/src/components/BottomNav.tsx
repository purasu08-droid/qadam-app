import { NavLink, useLocation } from 'react-router-dom'
import { Mail, MapPin, Plus, User } from 'lucide-react'

const ITEMS = [
  { to: '/add', label: 'Добавить', Icon: Plus },
  { to: '/places', label: 'Точки', Icon: MapPin, also: ['/feed'] },
  { to: '/messages', label: 'Сообщения', Icon: Mail },
  { to: '/profile', label: 'Профиль', Icon: User },
]

export default function BottomNav() {
  const { pathname } = useLocation()
  return (
    <nav className="bottom-nav">
      {ITEMS.map(({ to, label, Icon, also }) => (
        <NavLink
          key={to}
          to={to}
          className={({ isActive }) =>
            isActive || also?.some((p) => pathname.startsWith(p)) ? 'active' : ''
          }
        >
          <Icon size={22} strokeWidth={1.6} />
          <span>{label}</span>
        </NavLink>
      ))}
    </nav>
  )
}
