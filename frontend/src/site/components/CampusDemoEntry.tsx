import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowRight, FlaskConical } from 'lucide-react'
import { isAbortError } from '../api'
import { useSite } from '../state'
import '../campus-demo.css'
import { useI18n } from '../i18n'
import { useIsDesktop } from '../../useIsDesktop'

type Props = { disabled?: boolean; onDestination?: (destination: string) => void }

export default function CampusDemoEntry(props: Props) {
  const desktop = useIsDesktop()
  return desktop ? <DesktopCampusDemoEntry {...props} /> : null
}

/** The server advertises demo availability; an unknown or disabled capability never enables login. */
function DesktopCampusDemoEntry({ disabled = false, onDestination }: Props) {
  const { t } = useI18n()
  const { user, authBusy, authOptions, authOptionsLoading, authOptionsError, retryAuthOptions, demoCampusSignIn } = useSite()
  const navigate = useNavigate()
  const [error, setError] = useState<string | null>(null)
  const pending = useRef(false)
  const mounted = useRef(true)
  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false }
  }, [])

  const enter = async () => {
    if (pending.current || disabled || authBusy || authOptions?.campusDemoLogin !== true) return
    pending.current = true
    setError(null)
    try {
      await demoCampusSignIn((destination) => {
        if (!mounted.current) return
        // Prepare the destination before identity changes, including SiteAuth's automatic redirect.
        onDestination?.(destination)
        navigate(destination, { replace: true })
      })
    } catch (cause) {
      if (mounted.current && !isAbortError(cause)) setError((cause as Error).message)
    } finally {
      pending.current = false
    }
  }

  if (authOptionsLoading && !authOptions) return <p className="campus-demo-options" role="status">{t("Проверяем доступность демо…")}</p>
  if (authOptionsError) return <div className="campus-demo-options" role="alert"><p>{t("Не удалось проверить доступность демо-входа.")} {t(authOptionsError)}</p><button type="button" className="link-purple" disabled={authOptionsLoading || authBusy || disabled} onClick={() => { void retryAuthOptions() }}>{t("Повторить проверку")}</button></div>
  if (authOptions?.campusDemoLogin !== true) return null

  return <aside className="campus-demo-entry" aria-label={t("Демонстрационный кабинет ЕНУ")}>
    <div className="campus-demo-symbol" aria-hidden="true"><FlaskConical size={22} /></div>
    <div className="campus-demo-copy"><span className="eyebrow">{t("ЕНУ · ДЕМО")}</span><h3>{t("Посмотри, как работает кабинет вуза")}</h3><p>{t("Тестовые студенты, заявки, публикации и пакеты. Действия в кабинете относятся только к демонстрационным данным.")}</p>{user && <p className="campus-demo-switch">{t("При входе текущий сеанс будет переключён на демо-аккаунт.")}</p>}</div>
    <div className="campus-demo-actions"><button type="button" className="btn outline-purple" disabled={disabled || authBusy} onClick={() => { void enter() }}>{pending.current && authBusy ? t("Открываем кабинет…") : t("Демо-кабинет ЕНУ")}<ArrowRight size={17} aria-hidden="true" /></button>{error && <p className="err" role="alert">{t(error)} {t("Нажми кнопку ещё раз, чтобы повторить вход.")}</p>}</div>
  </aside>
}
