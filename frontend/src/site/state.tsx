import { createContext, useCallback, useContext, useEffect, useRef, useState, type Dispatch, type ReactNode, type SetStateAction } from 'react'
import { advanceApiSession, api, isAbortError, subscribeUnauthorized, type MeState, type NewPublication, type Profile } from './api'
import { CITIES, type Opportunity } from './data'
import { createAuthSequencer } from './auth-session'
import type { AuthOptions } from './auth-types'

type SiteState = {
  ready: boolean
  authError: string | null
  authVersion: number
  authBusy: boolean
  authOptions: AuthOptions | null
  authOptionsLoading: boolean
  authOptionsError: string | null
  retryAuthOptions: () => Promise<void>
  retryAuth: () => Promise<void>
  bootstrap: () => Promise<void>
  user: Profile | null
  signIn: (email: string, password: string) => Promise<void>
  signUp: (name: string, email: string, password: string) => Promise<void>
  demoSignIn: () => Promise<void>
  signOut: () => Promise<void>
  setUser: (p: Profile) => void

  city: string
  setCity: (c: string) => void

  opportunities: Opportunity[]
  opportunitiesLoading: boolean
  loadError: string | null
  reloadOpportunities: () => Promise<void>
  find: (id: string | undefined) => Opportunity | undefined
  fetchOne: (id: string) => Promise<Opportunity>
  publish: (p: NewPublication, idempotencyKey?: string) => Promise<Opportunity>

  state: MeState
  stateError: string | null
  refreshState: () => Promise<void>
  toggleSave: (id: string) => Promise<void>
  toggleAttend: (id: string) => Promise<void>
  apply: (id: string, body: { role: string; message: string; portfolio: string }) => Promise<string | null>
}

const EMPTY: MeState = { saved: [], attending: [], applications: [], unread: 0 }
const Ctx = createContext<SiteState | null>(null)

function useLocalCity() {
  const [city, setCity] = useState(() => {
    try {
      const saved = localStorage.getItem('qadam.site.city')
      return CITIES.some((city) => city.name === saved) ? saved! : 'Алматы'
    } catch {
      return 'Алматы'
    }
  })
  useEffect(() => {
    try {
      localStorage.setItem('qadam.site.city', city)
    } catch {
      /* storage unavailable */
    }
  }, [city])
  return [city, setCity] as const
}

export function SiteProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false)
  const [user, setUser] = useState<Profile | null>(null)
  const [authError, setAuthError] = useState<string | null>(null)
  const [authVersion, setAuthVersion] = useState(0)
  const [authBusy, setAuthBusy] = useState(false)
  const [authOptions, setAuthOptions] = useState<AuthOptions | null>(null)
  const [authOptionsLoading, setAuthOptionsLoading] = useState(true)
  const [authOptionsError, setAuthOptionsError] = useState<string | null>(null)
  const [city, setCity] = useLocalCity()
  const [opportunities, setOpportunities] = useState<Opportunity[]>([])
  const [opportunitiesLoading, setOpportunitiesLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [state, setState] = useState<MeState>(EMPTY)
  const [stateError, setStateError] = useState<string | null>(null)
  const session = useRef({ user: null as Profile | null, version: 0 })
  const authSequence = useRef(createAuthSequencer())
  const mounted = useRef(true)
  const optionsRequest = useRef(0)
  const stateRequest = useRef(0)
  const opportunitiesRequest = useRef(0)
  const pendingToggles = useRef(new Set<string>())

  const commitUser = useCallback((next: Profile | null, renew = false) => {
    const changed = session.current.user?.id !== next?.id
    if (changed || renew) {
      session.current.version += 1
      advanceApiSession()
      setAuthVersion(session.current.version)
      setState(EMPTY)
      setStateError(null)
      pendingToggles.current.clear()
    }
    session.current.user = next
    setUser(next)
  }, [])

  const loadOpportunities = useCallback(async () => {
    const request = ++opportunitiesRequest.current
    setOpportunitiesLoading(true)
    try {
      const { items } = await api.get<{ items: Opportunity[] }>('/opportunities')
      if (request !== opportunitiesRequest.current) return
      setOpportunities(items)
      setLoadError(null)
    } catch (e) {
      if (request === opportunitiesRequest.current) setLoadError((e as Error).message)
    } finally {
      if (request === opportunitiesRequest.current) setOpportunitiesLoading(false)
    }
  }, [])

  const refreshState = useCallback(async () => {
    const { user: currentUser, version } = session.current
    if (!currentUser) return
    const request = ++stateRequest.current
    try {
      const next = await api.get<MeState>('/users/me/state')
      if (version !== session.current.version || request !== stateRequest.current) return
      setState(next)
      setStateError(null)
    } catch (e) {
      if (version === session.current.version && request === stateRequest.current) setStateError((e as Error).message)
    }
  }, [])

  const bootstrap = useCallback(async () => {
    if (authSequence.current.busy) return
    const request = authSequence.current.read()
    setAuthError(null)
    try {
      const { user: next } = await api.get<{ user: Profile | null }>('/auth/me')
      if (!authSequence.current.isCurrent(request)) return
      commitUser(next)
      setReady(true)
    } catch (e) {
      // A network failure does not establish that the session is anonymous.
      if (authSequence.current.isCurrent(request)) setAuthError((e as Error).message)
    }
  }, [commitUser])

  const loadAuthOptions = useCallback(async () => {
    const request = ++optionsRequest.current
    setAuthOptionsLoading(true)
    setAuthOptionsError(null)
    // Capability checks fail closed: a failed refresh must not leave an enabled demo button.
    setAuthOptions(null)
    try {
      const result = await api.get<AuthOptions>('/auth/options')
      if (request !== optionsRequest.current) return
      setAuthOptions({ demoLogin: result.demoLogin === true })
    } catch (error) {
      if (request === optionsRequest.current) setAuthOptionsError((error as Error).message)
    } finally {
      if (request === optionsRequest.current) setAuthOptionsLoading(false)
    }
  }, [])

  useEffect(() => {
    mounted.current = true
    const unsubscribe = subscribeUnauthorized(() => {
      if (authSequence.current.busy) return
      authSequence.current.invalidate()
      commitUser(null, true)
      setAuthError(null)
      setReady(true)
    })
    void loadOpportunities()
    void bootstrap()
    void loadAuthOptions()
    return () => {
      mounted.current = false
      unsubscribe()
      authSequence.current.invalidate()
      optionsRequest.current += 1
      opportunitiesRequest.current += 1
      stateRequest.current += 1
    }
  }, [bootstrap, commitUser, loadAuthOptions, loadOpportunities])

  useEffect(() => {
    if (user) void refreshState()
  }, [authVersion, user?.id, refreshState])

  // счётчик непрочитанных обновляется раз в 20 секунд
  useEffect(() => {
    if (!user) return
    const t = setInterval(() => { void refreshState() }, 20_000)
    return () => clearInterval(t)
  }, [user?.id, refreshState])

  const transitionAuth = async <T,>(load: () => Promise<T>, nextUser: (result: T) => Profile | null, beforeCommit?: (result: T) => void) => {
    const request = authSequence.current.write()
    setAuthBusy(true)
    advanceApiSession()
    try {
      const result = await load()
      request.complete(() => {
        commitUser(nextUser(result), true)
        setReady(true)
        setAuthError(null)
      }, () => beforeCommit?.(result))
      return result
    } finally {
      request.finish()
      if (mounted.current) setAuthBusy(false)
    }
  }

  const auth = async (path: string, body?: unknown) => {
    await transitionAuth(() => api.post<{ user: Profile }>(path, body), (result) => result.user)
  }

  const toggle = async (key: 'saved' | 'attending', path: string, id: string) => {
    const version = session.current.version
    const lock = `${key}:${id}`
    if (pendingToggles.current.has(lock)) return
    pendingToggles.current.add(lock)
    const on = state[key].includes(id)
    setState((s) => ({ ...s, [key]: on ? s[key].filter((x) => x !== id) : [...s[key], id] }))
    try {
      await (on ? api.del(`/opportunities/${id}/${path}`) : api.put(`/opportunities/${id}/${path}`))
    } catch (e) {
      if (version === session.current.version) {
        setState((s) => ({ ...s, [key]: on ? [...s[key].filter((x) => x !== id), id] : s[key].filter((x) => x !== id) }))
        await refreshState()
      }
      throw e
    } finally {
      if (version === session.current.version) pendingToggles.current.delete(lock)
    }
  }

  const value: SiteState = {
    ready,
    authError,
    authVersion,
    authBusy,
    authOptions,
    authOptionsLoading,
    authOptionsError,
    retryAuthOptions: loadAuthOptions,
    retryAuth: bootstrap,
    bootstrap,
    user,
    signIn: (email, password) => auth('/auth/login', { email, password }),
    signUp: (name, email, password) => auth('/auth/register', { name, email, password, city }),
    demoSignIn: () => auth('/auth/demo'),
    signOut: async () => {
      await transitionAuth(() => api.post('/auth/logout'), () => null)
    },
    setUser: (p) => {
      if (p.id === session.current.user?.id) commitUser(p)
    },
    city,
    setCity,
    opportunities,
    opportunitiesLoading,
    loadError,
    reloadOpportunities: loadOpportunities,
    find: (id) => opportunities.find((o) => o.id === id),
    fetchOne: async (id) => (await api.get<{ item: Opportunity }>(`/opportunities/${id}`)).item,
    publish: async (p, idempotencyKey) => {
      const version = session.current.version
      const { item } = await api.post<{ item: Opportunity }>('/opportunities', p, { idempotencyKey })
      if (version === session.current.version) setOpportunities((s) => [item, ...s.filter((o) => o.id !== item.id)])
      return item
    },
    state,
    stateError,
    refreshState,
    toggleSave: (id) => toggle('saved', 'save', id),
    toggleAttend: (id) => toggle('attending', 'attend', id),
    apply: async (id, body) => {
      const { conversationId } = await api.post<{ conversationId: string | null }>(`/opportunities/${id}/apply`, body)
      await refreshState()
      return conversationId
    },
  }

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useSite() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useSite outside SiteProvider')
  return ctx
}

// Небольшой хук для GET-запросов страниц: данные, ошибка, перезагрузка.
export function useApi<T>(path: string | null) {
  const { authVersion } = useSite()
  const key = JSON.stringify([path, authVersion])
  type Result = { key: string; data: T | null; error: string | null; loading: boolean }
  const [result, setResult] = useState<Result>({ key, data: null, error: null, loading: Boolean(path) })
  const [tick, setTick] = useState(0)
  const currentKey = useRef(key)
  currentKey.current = key
  const reload = useCallback(() => setTick((t) => t + 1), [])
  const setData: Dispatch<SetStateAction<T | null>> = useCallback((next) => {
    if (currentKey.current !== key) return
    setResult((previous) => {
      if (currentKey.current !== key) return previous
      const data = previous.key === key ? previous.data : null
      return { key, data: typeof next === 'function' ? (next as (value: T | null) => T | null)(data) : next, error: null, loading: previous.key === key && previous.loading }
    })
  }, [key])
  useEffect(() => {
    if (!path) return
    const controller = new AbortController()
    setResult((previous) => ({ key, data: previous.key === key ? previous.data : null, error: null, loading: true }))
    void api.get<T>(path, { signal: controller.signal })
      .then((data) => {
        if (!controller.signal.aborted && currentKey.current === key) setResult({ key, data, error: null, loading: false })
      })
      .catch((e: Error) => {
        if (!controller.signal.aborted && !isAbortError(e) && currentKey.current === key) {
          setResult((previous) => ({ key, data: previous.key === key ? previous.data : null, error: e.message, loading: false }))
        }
      })
    return () => controller.abort()
  }, [key, path, tick])
  // Mask old data during render, before effect cleanup when path/account changes.
  const visible = result.key === key && path ? result : { data: null, error: null, loading: Boolean(path) }
  return { ...visible, reload, retry: reload, setData }
}
