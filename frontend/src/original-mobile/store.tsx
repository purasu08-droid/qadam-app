import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { MY_PROJECTS, PROJECTS, type MyProject, type Project } from './data/mock'
import { XP } from './data/game'

export type XpToast = { id: number; amount: number; label: string }

type Store = {
  authed: boolean
  signIn: () => void
  signOut: () => void
  projects: Project[]
  myProjects: MyProject[]
  saved: string[]
  joined: string[]
  toggleSaved: (id: string) => void
  join: (id: string) => void
  publish: (p: Project, mine: MyProject) => void
  created: number
  messagesSent: number
  noteMessage: () => void
  xp: number
  toast: XpToast | null
}

const Ctx = createContext<Store | null>(null)

function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

function persist(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* storage unavailable */
  }
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [authed, setAuthed] = useState(() => load('qadam.authed', false))
  const [created, setCreated] = useState<Project[]>(() => load('qadam.created', []))
  const [createdMine, setCreatedMine] = useState<MyProject[]>(() => load('qadam.createdMine', []))
  const [saved, setSaved] = useState<string[]>(() => load('qadam.saved', []))
  const [joined, setJoined] = useState<string[]>(() => load('qadam.joined', []))
  const [messagesSent, setMessagesSent] = useState<number>(() => load('qadam.messagesSent', 0))
  const [toast, setToast] = useState<XpToast | null>(null)

  useEffect(() => persist('qadam.authed', authed), [authed])
  useEffect(() => persist('qadam.created', created), [created])
  useEffect(() => persist('qadam.createdMine', createdMine), [createdMine])
  useEffect(() => persist('qadam.saved', saved), [saved])
  useEffect(() => persist('qadam.joined', joined), [joined])
  useEffect(() => persist('qadam.messagesSent', messagesSent), [messagesSent])
  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 2400)
    return () => clearTimeout(t)
  }, [toast])

  const award = (amount: number, label: string) => setToast({ id: Date.now(), amount, label })
  const xp =
    XP.base + saved.length * XP.save + joined.length * XP.join + created.length * XP.publish + messagesSent * XP.message

  const value: Store = {
    authed,
    signIn: () => setAuthed(true),
    signOut: () => setAuthed(false),
    projects: [...created, ...PROJECTS],
    myProjects: [...createdMine, ...MY_PROJECTS],
    saved,
    joined,
    toggleSaved: (id) => {
      if (!saved.includes(id)) award(XP.save, 'Проект в закладках')
      setSaved((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]))
    },
    join: (id) => {
      if (!joined.includes(id)) award(XP.join, 'Заявка отправлена')
      setJoined((s) => (s.includes(id) ? s : [...s, id]))
    },
    publish: (p, mine) => {
      award(XP.publish, 'Проект опубликован')
      setCreated((s) => [p, ...s])
      setCreatedMine((s) => [mine, ...s])
    },
    created: created.length,
    messagesSent,
    noteMessage: () => {
      award(XP.message, 'Сообщение отправлено')
      setMessagesSent((n) => n + 1)
    },
    xp,
    toast,
  }

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useStore() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useStore outside StoreProvider')
  return ctx
}
