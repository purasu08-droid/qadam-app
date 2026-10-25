import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { useSite } from '../state'
import { PixelPin } from '../components/Pixel'
import { siteAuthReturnPath } from '../auth-utils'
import { isAbortError } from '../api'
import CampusDemoEntry from '../components/CampusDemoEntry'
import { useI18n } from '../i18n'
import { useIsDesktop } from '../../useIsDesktop'

export default function SiteAuth() {
  const desktop = useIsDesktop()
  const { t } = useI18n()
  const { state, pathname } = useLocation()
  const from: unknown = state && typeof state === 'object' && 'from' in state ? state.from : undefined
  const requestedReturn = siteAuthReturnPath(from, pathname)
  const returnTo = !desktop && /^\/(?:campus|pricing)(?:[/?#]|$)/i.test(requestedReturn) ? '/account/profile' : requestedReturn
  const { user, ready, authError, authBusy, authOptions, retryAuth, signIn, signUp, demoSignIn } = useSite()
  const [demoDestination, setDemoDestination] = useState<string | null>(null)
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [localBusy, setBusy] = useState(false)
  const busy = localBusy || authBusy
  const inFlight = useRef(false)
  const mounted = useRef(true)
  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false }
  }, [])

  const run = async (fn: () => Promise<void>) => {
    if (inFlight.current || authBusy) return
    inFlight.current = true
    setDemoDestination(null)
    setError('')
    setBusy(true)
    try {
      await fn()
    } catch (e) {
      if (mounted.current && !isAbortError(e)) setError((e as Error).message)
    } finally {
      inFlight.current = false
      if (mounted.current) setBusy(false)
    }
  }

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (inFlight.current || authBusy) return
    if (mode === 'register' && name.trim().length < 2) return setError('Имя — минимум 2 символа')
    const cleanEmail = email.trim()
    if (!/^\S+@\S+\.\S+$/.test(cleanEmail)) return setError('Введи корректный email')
    if (password.length < 6) return setError('Пароль — минимум 6 символов')
    void run(() => (mode === 'login' ? signIn(cleanEmail, password) : signUp(name.trim(), cleanEmail, password)))
  }

  const switchMode = () => {
    if (inFlight.current || authBusy) return
    setMode(mode === 'login' ? 'register' : 'login')
    setError('')
  }

  if (user) return <Navigate to={desktop ? demoDestination ?? returnTo : returnTo} replace />
  if (!ready && !authError) return <div className="page" role="status">{t('Проверяем вход…')}</div>

  return (
    <div className="page auth-page">
      <div className="panel auth-card">
        <div className="auth-art">
          <span className="gb">
            <img src="/img/hero-gameboy.jpg" alt="" />
            <span className="hero-screen"><PixelPin size={62} color="#1b2410" face /></span>
          </span>
        </div>
        <form className="auth-form" onSubmit={submit} noValidate>
          <span className="eyebrow">{t(mode === 'login' ? 'ВХОД' : 'РЕГИСТРАЦИЯ')}</span>
          <h1>{t('Сделай первый шаг')}</h1>
          <p className="muted">
            {t(mode === 'login'
              ? 'Войди, чтобы откликаться на проекты, сохранять события и общаться с командами.'
              : 'Создай аккаунт — это бесплатно.')}
          </p>
          {authError && (
            <div role="alert">
              <p className="err">{t('Не удалось проверить текущий вход.')} {t(authError)}</p>
              <button type="button" className="btn outline" disabled={busy} onClick={() => { void run(retryAuth) }}>{t('Повторить проверку')}</button>
            </div>
          )}
          {mode === 'register' && (
            <label className="fld">
              <span>{t('Имя и фамилия')}</span>
              <input autoComplete="name" placeholder={t('Айгерим Садыкова')} value={name} disabled={busy} onChange={(e) => setName(e.target.value)} />
            </label>
          )}
          <label className="fld">
            <span>{t('Email')}</span>
            <input type="email" autoComplete="email" placeholder="you@example.com" value={email} disabled={busy} onChange={(e) => setEmail(e.target.value)} />
          </label>
          <label className="fld">
            <span>{t('Пароль')}</span>
            <input
              type="password"
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              placeholder={t('Минимум 6 символов')}
              value={password}
              disabled={busy}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
          {error && <p className="err" role="alert">{t(error)}</p>}
          <button className="btn lime dblock lg" type="submit" disabled={busy}>
            {t(mode === 'login' ? 'Войти' : 'Создать аккаунт')} <ArrowRight size={18} />
          </button>
          <button type="button" className="link-purple center-link" disabled={busy} onClick={switchMode}>
            {t(mode === 'login' ? 'Нет аккаунта? Зарегистрироваться' : 'Уже есть аккаунт? Войти')}
          </button>
          {authOptions?.demoLogin && <><div className="divider"><span>{t('или')}</span></div>
          <button type="button" className="btn outline dblock lg" disabled={busy} onClick={() => { void run(demoSignIn) }}>
            {t('Войти в демо-аккаунт')}
          </button></>}
          {desktop && <CampusDemoEntry disabled={localBusy} onDestination={setDemoDestination} />}
        </form>
      </div>
    </div>
  )
}
