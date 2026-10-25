import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Search } from 'lucide-react'
import Segmented from '../components/Segmented'
import Avatar from '../components/Avatar'
import { CONVERSATIONS, PEOPLE } from '../data/mock'

type Tab = 'inbox' | 'mine'

export default function Messages() {
  const [tab, setTab] = useState<Tab>('inbox')
  const [query, setQuery] = useState('')

  const list = useMemo(() => {
    const q = query.trim().toLowerCase()
    return CONVERSATIONS.filter((c) => !!c.mine === (tab === 'mine')).filter(
      (c) => !q || (PEOPLE[c.person].name + c.preview).toLowerCase().includes(q),
    )
  }, [tab, query])

  return (
    <div className="messages">
      {/* по макету: поиск сверху, над переключателем */}
      <div className="px pt">
        <label className="search soft">
          <Search size={16} />
          <input placeholder="Search conversations..." value={query} onChange={(e) => setQuery(e.target.value)} />
        </label>
      </div>
      <div className="px">
        <Segmented
          value={tab}
          onChange={setTab}
          options={[
            { value: 'inbox', label: 'Входящие' },
            { value: 'mine', label: 'Мои объявления' },
          ]}
        />
      </div>
      <div className="convo-list">
        {list.map((c) => {
          const p = PEOPLE[c.person]
          return (
            <Link key={c.id} to={`/messages/${c.id}`} className="convo">
              <Avatar id={c.person} size={52} online={c.online} />
              <div className="convo-body">
                <div className="row gap-6">
                  <b>{p.name}</b>
                  <span className="tiny muted">{c.time}</span>
                </div>
                <div className="small muted">{p.role}</div>
                <div className="small ellipsis">{c.preview}</div>
              </div>
              {c.unread > 0 && <span className="unread">{c.unread}</span>}
            </Link>
          )
        })}
        {list.length === 0 && <p className="empty">Нет сообщений</p>}
      </div>
    </div>
  )
}
