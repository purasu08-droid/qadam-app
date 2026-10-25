import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ChevronLeft, Send } from 'lucide-react'
import Avatar from '../components/Avatar'
import { CONVERSATIONS, PEOPLE } from '../data/mock'
import { useStore } from '../store'

type Msg = { from: 'me' | 'them'; text: string; time: string }

const now = () => new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })

export default function Chat() {
  const { id } = useParams()
  const nav = useNavigate()
  const { noteMessage } = useStore()
  const convo = CONVERSATIONS.find((c) => c.id === id)
  const [msgs, setMsgs] = useState<Msg[]>(() =>
    convo ? [{ from: 'them', text: convo.preview, time: convo.time }] : [],
  )
  const [text, setText] = useState('')
  const end = useRef<HTMLDivElement>(null)
  useEffect(() => {
    end.current?.scrollIntoView({ behavior: 'smooth' })
  }, [msgs])

  if (!convo) return <p className="empty">Диалог не найден</p>
  const p = PEOPLE[convo.person]

  const send = (e: FormEvent) => {
    e.preventDefault()
    if (!text.trim()) return
    setMsgs((m) => [...m, { from: 'me', text: text.trim(), time: now() }])
    setText('')
    noteMessage()
  }

  return (
    <div className="chat">
      <header className="chat-head">
        <button className="icon-btn" onClick={() => nav('/messages')} aria-label="Назад"><ChevronLeft size={22} /></button>
        <Avatar id={p.id} size={38} online={convo.online} />
        <div>
          <b>{p.name}</b>
          <div className="tiny muted">{convo.online ? 'online' : p.role}</div>
        </div>
      </header>
      <div className="chat-body">
        {msgs.map((m, i) => (
          <div key={i} className={`bubble ${m.from}`}>
            {m.text}
            <span className="tiny">{m.time}</span>
          </div>
        ))}
        <div ref={end} />
      </div>
      <form className="chat-input" onSubmit={send}>
        <input placeholder="Сообщение…" value={text} onChange={(e) => setText(e.target.value)} />
        <button className="btn-blue icon" aria-label="Отправить"><Send size={18} /></button>
      </form>
    </div>
  )
}
