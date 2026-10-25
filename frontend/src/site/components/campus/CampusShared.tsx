import { useI18n } from '../../i18n'
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { ChevronLeft, ChevronRight, Search } from 'lucide-react'
import { api, ApiError, isAbortError } from '../../api'
import { useSite } from '../../state'

// Preserve data during transient failures, but remove privileged data after a
// definitive loss of access. Every result belongs to one path and auth scope.
export function useCampusQuery<T>(path: string | null) {
  const { authVersion } = useSite()
  const owner = JSON.stringify([authVersion, path])
  const current = useRef(owner)
  current.current = owner
  const [tick, setTick] = useState(0)
  const [result, setResult] = useState<{ owner: string; data: T | null; error: string | null; errorStatus: number | null; loading: boolean }>({ owner, data: null, error: null, errorStatus: null, loading: Boolean(path) })
  const reload = useCallback(() => setTick((value) => value + 1), [])
  useEffect(() => {
    if (!path) return
    const controller = new AbortController()
    setResult((old) => ({ owner, data: old.owner === owner ? old.data : null, error: null, errorStatus: null, loading: true }))
    void api.get<T>(path, { signal: controller.signal }).then((data) => {
      if (!controller.signal.aborted && current.current === owner) setResult({ owner, data, error: null, errorStatus: null, loading: false })
    }).catch((error: unknown) => {
      if (controller.signal.aborted || current.current !== owner || isAbortError(error)) return
      const lostAccess = error instanceof ApiError && [401, 403, 404].includes(error.status)
      setResult((old) => ({ owner, data: !lostAccess && old.owner === owner ? old.data : null, error: (error as Error).message, errorStatus: error instanceof ApiError ? error.status : 0, loading: false }))
    })
    return () => controller.abort()
  }, [owner, path, tick])
  const visible = result.owner === owner && path ? result : { data: null, error: null, errorStatus: null, loading: Boolean(path) }
  return { ...visible, accessDenied: visible.errorStatus === 401 || visible.errorStatus === 403, reload, retry: reload }
}

export function useCampusMutation() {
  const { authVersion } = useSite()
  const scope = useRef(authVersion)
  scope.current = authVersion
  const active = useRef(false)
  const lock = useRef(false)
  const controller = useRef<AbortController | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  useEffect(() => {
    active.current = true
    return () => { active.current = false; controller.current?.abort() }
  }, [])

  const run = async (work: (signal: AbortSignal) => Promise<void>, message?: string) => {
    if (lock.current) return false
    lock.current = true
    const version = authVersion
    controller.current = new AbortController()
    setBusy(true)
    setError(null)
    setSuccess(null)
    try {
      await work(controller.current.signal)
      if (!active.current || scope.current !== version) return false
      if (message) setSuccess(message)
      return true
    } catch (e) {
      if (active.current && scope.current === version && !isAbortError(e)) setError((e as Error).message)
      return false
    } finally {
      lock.current = false
      if (active.current && scope.current === version) setBusy(false)
    }
  }
  return { run, busy, error, success, setError }
}

export function CampusFeedback({ error, success }: { error: string | null; success?: string | null }) {
  const { t } = useI18n()
  return <>{error && <p className="campus-feedback error" role="alert">{t(error)}</p>}{success && <p className="campus-feedback success" role="status">{t(success)}</p>}</>
}

export function CampusLoad({ loading, error, retry, children }: { loading: boolean; error: string | null; retry: () => void; children?: ReactNode }) {
  const { t } = useI18n()
  return <>{error && <div className="campus-feedback error" role="alert"><span>{t(error)}</span><button type="button" className="btn outline sm" onClick={retry} disabled={loading}>{t("Повторить")}</button></div>}{loading && <p className="campus-loading" role="status">{t("Обновляем данные…")}</p>}{children}</>
}

export function CampusSearch({ value, onChange, label = 'Поиск' }: { value: string; onChange: (value: string) => void; label?: string }) {
  const { t } = useI18n()
  return <label className="campus-search"><Search size={18} aria-hidden="true" /><input type="search" maxLength={200} value={value} placeholder={t(label)} aria-label={t(label)} onChange={(e) => onChange(e.target.value)} /></label>
}

export function CampusPager({ page, total, pageSize, loading, change }: { page: number; total: number; pageSize: number; loading: boolean; change: (page: number) => void }) {
  const { t } = useI18n()
  const pages = Math.max(1, Math.ceil(total / pageSize))
  return <nav className="campus-pager" aria-label={t("Страницы результатов")}><span>{t("Всего: {total} · Страница {page} из {pages}", { total, page, pages })}</span><div><button type="button" className="btn outline sm" disabled={loading || page <= 1} onClick={() => change(page - 1)} aria-label={t("Предыдущая страница")}><ChevronLeft size={17} /></button><button type="button" className="btn outline sm" disabled={loading || page >= pages} onClick={() => change(page + 1)} aria-label={t("Следующая страница")}><ChevronRight size={17} /></button></div></nav>
}
