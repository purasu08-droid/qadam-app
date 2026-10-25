import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, ArrowDown, FileText, Search, SendHorizontal } from 'lucide-react'
import { api, dayLabel, shortWhen, timeOf, type ChatMessage, type ConversationSummary } from '../api'
import { useSite } from '../state'
import { Avatar, Cover, KindBadge, PageHead } from '../components/ui'
import { mergeMessages, mergeRoomSnapshots, readMarkerForViewport, startChatPolling, type ChatRoom } from './chatSync'
import { useI18n } from '../i18n'

const POLL_MS = 4000
type ConversationList = { items: ConversationSummary[] }

function replaceData<T>(_current: T | null, incoming: T) { return incoming }
const isHidden = () => document.visibilityState === 'hidden'

function useChatPolling<T>(path: string, interval: number, merge: (current: T | null, incoming: T) => T = replaceData) {
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState<string | null>(null)
  const mergeRef = useRef(merge)
  mergeRef.current = merge
  const wake = useRef<() => void>(() => {})
  const reload = useCallback(() => wake.current(), [])

  useEffect(() => {
    setData(null)
    setError(null)
    const poll = startChatPolling({
      load: (signal) => api.get<T>(path, { signal }),
      onData: (incoming) => {
        setData((current) => mergeRef.current(current, incoming))
        setError(null)
      },
      onError: (error) => setError((error as Error).message),
      intervalMs: interval,
    })
    wake.current = poll.reload
    return () => {
      poll.stop()
      wake.current = () => {}
    }
  }, [path, interval])

  return { data, error, reload, setData }
}

export default function Chats() {
  const { authVersion } = useSite()
  // A renewed session gets a new tree, including drafts and pending GETs. A late
  // response belonging to the previous account cannot populate another inbox.
  return <ChatSession key={authVersion} />
}

function ChatSession() {
  const { t } = useI18n()
  const { id } = useParams()
  const { refreshState } = useSite()
  const list = useChatPolling<ConversationList>('/conversations', POLL_MS * 2)
  const [q, setQ] = useState('')
  const [unreadOnly, setUnreadOnly] = useState(false)
  const items = useMemo(
    () => (list.data?.items ?? []).filter((c) =>
      (!unreadOnly || c.unread > 0 || c.id === id) &&
      `${c.title} ${c.opportunity?.title ?? ''} ${c.lastMessage?.text ?? ''}`.toLowerCase().includes(q.trim().toLowerCase()),
    ),
    [list.data, q, unreadOnly, id],
  )

  const onRead = useCallback(() => {
    // Another message can arrive between GET and /read. Fetch the actual count
    // instead of setting this conversation's unread count to zero locally.
    list.reload()
    void refreshState()
  }, [list.reload, refreshState])

  return (
    <div className={`page wide chats${id ? ' chat-has-room' : ''}`}>
      <PageHead title={t('Чаты')} sub={t('Общайтесь с людьми и командами.')} />
      <div className="chat-grid">
        <aside className="panel chat-list" aria-label={t('Диалоги')}>
          <label className="input-icon">
            <Search size={20} />
            <input aria-label={t('Поиск диалогов')} placeholder={t('Поиск диалогов')} value={q} onChange={(e) => setQ(e.target.value)} />
          </label>
          <div className="seg full">
            <button className={!unreadOnly ? 'on lime' : ''} aria-pressed={!unreadOnly} onClick={() => setUnreadOnly(false)}>{t('Все')}</button>
            <button className={unreadOnly ? 'on lime' : ''} aria-pressed={unreadOnly} onClick={() => setUnreadOnly(true)}>{t('Непрочитанные')}</button>
          </div>
          <ul>
            {items.map((c) => (
              <li key={c.id}>
                <Link to={`/chats/${c.id}`} className={c.id === id ? 'on' : ''} aria-current={c.id === id ? 'page' : undefined}>
                  <ConvAvatar c={c} size={62} />
                  <span className="grow">
                    <b>{c.title}</b>
                    {c.person && c.opportunity && <small className="purple">{c.opportunity.title}</small>}
                    <span className="ellipsis muted">{c.lastMessage ? c.lastMessage.mine ? t('Ты: {text}', { text: c.lastMessage.text }) : c.lastMessage.text : t('Нет сообщений')}</span>
                  </span>
                  <span className="cl-side">
                    {c.lastMessage && <small>{shortWhen(c.lastMessage.createdAt)}</small>}
                    {c.unread > 0 && <i className="unread" aria-label={t('Непрочитанных: {count}', { count: c.unread })}>{c.unread}</i>}
                  </span>
                </Link>
              </li>
            ))}
            {list.error && <li className="err" role="status">{t(list.error)} <button className="link-purple" onClick={list.reload}>{t('Повторить')}</button></li>}
            {!list.error && !list.data && <li className="empty" role="status">{t('Загрузка диалогов…')}</li>}
            {!list.error && list.data && items.length === 0 && (
              <li className="empty">{t(list.data.items.length ? 'Ничего не найдено' : 'Диалогов пока нет. Откликнись на проект — автор ответит здесь.')}</li>
            )}
          </ul>
        </aside>
        {id ? <Room key={id} id={id} onRead={onRead} onSent={list.reload} /> : <section className="panel chat-room"><p className="empty">{t('Выбери диалог из списка')}</p></section>}
      </div>
    </div>
  )
}

function ChatBack() {
  const { t } = useI18n()
  return <Link to="/chats" className="mobile-chat-back btn outline sm"><ArrowLeft size={18} /> {t('Все чаты')}</Link>
}

function Room({ id, onRead, onSent }: { id: string; onRead: () => void; onSent: () => void }) {
  const { t } = useI18n()
  const room = useChatPolling<ChatRoom>(`/conversations/${id}`, POLL_MS, mergeRoomSnapshots)
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [newMessages, setNewMessages] = useState(false)
  const [atBottom, setAtBottom] = useState(false)
  const sendPending = useRef(false)
  const viewport = useRef<HTMLDivElement>(null)
  const nearBottom = useRef(true)
  const initialScroll = useRef(false)
  const scrollAfterSend = useRef(false)
  const mounted = useRef(false)
  const readPending = useRef(false)
  const readThrough = useRef<string | null>(null)
  const onReadRef = useRef(onRead)
  onReadRef.current = onRead
  const count = room.data?.messages.length ?? 0
  const lastMessageId = room.data?.messages[count - 1]?.id

  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false }
  }, [])

  const scrollToBottom = () => {
    const node = viewport.current
    if (!node) return
    node.scrollTop = node.scrollHeight
    nearBottom.current = true
    setAtBottom(true)
    setNewMessages(false)
  }

  useLayoutEffect(() => {
    if (!viewport.current) return
    if (!initialScroll.current || nearBottom.current || scrollAfterSend.current) {
      scrollToBottom()
      initialScroll.current = true
      scrollAfterSend.current = false
    } else setNewMessages(true)
  }, [lastMessageId, count])

  useEffect(() => {
    const node = viewport.current
    const messageId = readMarkerForViewport(room.data, {
      // Recheck the DOM as well as React state: a scroll or viewport resize can
      // happen before its state update commits. Polling history must not mark
      // a new message below the user's viewport as read.
      atBottom: atBottom && nearBottom.current && !!node && node.scrollHeight - node.scrollTop - node.clientHeight <= 8,
      hidden: isHidden(),
    })
    if (!messageId || readPending.current || readThrough.current === messageId) return
    readPending.current = true
    api.post(`/conversations/${id}/read`, { messageId }).then(() => {
      readThrough.current = messageId
      if (mounted.current) {
        onReadRef.current()
        room.reload()
      }
    }, () => {
      // The next successful poll retries this marker. A read failure must not
      // discard the conversation or falsely clear the unread badge.
    }).finally(() => { readPending.current = false })
  }, [id, room.data, room.reload, atBottom])

  if (!room.data) return (
    <section className="panel chat-room">
      <ChatBack />
      {room.error ? <p className="empty" role="status">{t(room.error)} <button className="link-purple" onClick={room.reload}>{t('Повторить')}</button></p> : <p className="empty" role="status">{t('Загрузка…')}</p>}
    </section>
  )

  const { conversation: c, messages } = room.data
  const project = c.opportunity

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const value = text.trim()
    if (!value || sendPending.current) return
    sendPending.current = true
    setSending(true)
    try {
      const { message } = await api.post<{ message: ChatMessage }>(`/conversations/${id}/messages`, { text: value })
      if (!mounted.current) return
      scrollAfterSend.current = true
      room.setData((d) => d && { ...d, messages: mergeMessages(d.messages, [message]) })
      // Preserve a new draft typed while the previous message was being sent.
      setText((current) => current.trim() === value ? '' : current)
      setError(null)
      onSent()
      room.reload()
    } catch (err) {
      if (mounted.current) setError((err as Error).message)
    } finally {
      sendPending.current = false
      if (mounted.current) setSending(false)
    }
  }

  return (
    <section className="panel chat-room" aria-label={t('Диалог: {title}', { title: c.title })}>
      <header className="cr-head">
        <ChatBack />
        <ConvAvatar c={c} size={66} />
        <span className="grow">
          <b>{c.person ? <Link to={`/u/${c.person.id}`}>{c.title}</Link> : c.title}</b>
          {project && <span className="muted">{t('По проекту {title}', { title: project.title })}</span>}
        </span>
      </header>
      {project && (
        <div className="cr-project">
          <Cover o={project} className="cr-thumb" />
          <span className="grow">
            <KindBadge kind={project.kind} />
            <b>{project.title}</b>
            <span className="muted">{project.subtitle}</span>
          </span>
          <Link to={`/p/${project.id}`} className="btn outline-purple">{t(project.kind === 'event' ? 'Открыть событие' : 'Открыть проект')}</Link>
        </div>
      )}
      {room.error && <p className="err center" role="status">{t(room.error)} <button className="link-purple" onClick={room.reload}>{t('Повторить')}</button></p>}
      <div className="cr-msgs" ref={viewport} role="log" aria-label={t('Сообщения')} aria-live="polite" aria-relevant="additions text" onScroll={() => {
        const node = viewport.current
        if (!node) return
        const distance = node.scrollHeight - node.scrollTop - node.clientHeight
        nearBottom.current = distance < 80
        setAtBottom(distance <= 8)
        if (distance <= 8) setNewMessages(false)
      }}>
        {messages.map((m, i) => {
          const day = dayLabel(m.createdAt)
          const showDay = i === 0 || dayLabel(messages[i - 1].createdAt) !== day
          return (
            <div key={m.id} className="msg-wrap">
              {showDay && <div className="day"><span>{day}</span></div>}
              <div className={`msg ${m.mine ? 'me' : 'them'}`}>
                {!m.mine && <Avatar person={m.sender} size={46} />}
                <div className="bbl">
                  {!m.mine && c.type === 'group' && m.sender && <small className="purple">{m.sender.short}</small>}
                  <p>{m.text}</p>
                  {m.file && (
                    <div className="file">
                      <FileText size={30} className="pdf" />
                      <span className="grow"><b>{m.file.name}</b><small>{m.file.size} · {t('Скачивание недоступно')}</small></span>
                    </div>
                  )}
                  {m.mine && <span className="time">{timeOf(m.createdAt)}</span>}
                </div>
                {!m.mine && <span className="time out">{timeOf(m.createdAt)}</span>}
              </div>
            </div>
          )
        })}
        {messages.length === 0 && <p className="empty">{t('Сообщений пока нет — начни разговор.')}</p>}
      </div>
      {newMessages && <button className="btn outline sm new-messages" onClick={scrollToBottom}>{t('Новые сообщения')} <ArrowDown size={16} /></button>}
      <form className="cr-input" onSubmit={submit}>
        <label className="grow">
          <input aria-label={t('Сообщение')} placeholder={t('Написать сообщение…')} value={text} onChange={(e) => setText(e.target.value)} maxLength={4000} readOnly={sending} />
        </label>
        <button className="send" type="submit" aria-label={t(sending ? 'Отправка сообщения' : 'Отправить')} disabled={!text.trim() || sending}><SendHorizontal size={24} /></button>
      </form>
      {error && <p className="err center" role="alert">{t(error)} {t('Сообщение осталось в поле — попробуй отправить снова.')}</p>}
    </section>
  )
}

function ConvAvatar({ c, size }: { c: ConversationSummary; size: number }) {
  return <Avatar person={c.person} kind={c.person ? undefined : c.kind} letter={c.letter ?? c.title[0]} size={size} />
}
