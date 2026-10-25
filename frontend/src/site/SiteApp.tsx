import { Fragment, lazy, Suspense, useEffect, type ReactElement } from 'react'
import { Navigate, Route, Routes, useLocation, useParams } from 'react-router-dom'
import Header from './components/Header'
import MobileNav from './components/MobileNav'
import { useSite } from './state'
import { legacyTarget } from './routes'
import '../site.css'
import '../responsive.css'
import '../billing-ui.css'
import '../theme.css'
import { useI18n } from './i18n'
import { usesOriginalMobileDesign } from './mobile-design'
import '../mobile-original.css'
import '../mobile-forms.css'
import '../mobile-community.css'
import { useIsDesktop } from '../useIsDesktop'

const Landing = lazy(() => import('./screens/Landing'))
const SiteAuth = lazy(() => import('./screens/SiteAuth'))
const MapPage = lazy(() => import('./screens/MapPage'))
const Detail = lazy(() => import('./screens/Detail'))
const Create = lazy(() => import('./screens/Create'))
const Chats = lazy(() => import('./screens/Chats'))
const Profile = lazy(() => import('./screens/Profile'))
const MyProjects = lazy(() => import('./screens/MyProjects'))
const Pricing = lazy(() => import('./screens/Pricing'))
const Campus = lazy(() => import('./screens/Campus'))

export default function SiteApp() {
  const { t } = useI18n()
  const desktop = useIsDesktop()
  const { pathname } = useLocation()
  useEffect(() => { window.scrollTo(0, 0) }, [pathname])
  return (
      <div className="site" data-mobile-design={usesOriginalMobileDesign(pathname) ? 'original' : undefined}>
        <a className="skip-link" href="#main-content">{t("К содержимому")}</a>
        <Header />
        <ConnectionNotice />
        <main id="main-content" tabIndex={-1}>
          <Suspense fallback={<div className="page" role="status">{t("Загрузка страницы…")}</div>}>
            <Routes>
              <Route path="/" element={<Landing />} />
              <Route path="/signin" element={<SiteAuth />} />
              <Route path="/map" element={<MapPage />} />
              {desktop && <>
                <Route path="/pricing" element={<Pricing />} />
                <Route path="/campus/signin" element={<SiteAuth />} />
                <Route path="/campus/account" element={<Private><Profile /></Private>} />
                <Route path="/campus" element={<Private><Campus /></Private>} />
                <Route path="/campus/:id" element={<Private><Campus /></Private>} />
              </>}
              <Route path="/account/signin" element={<SiteAuth />} />
              <Route path="/account/profile" element={<Private><Profile /></Private>} />
              <Route path="/p/:id" element={<Detail />} />
              <Route path="/create" element={<Private><Create /></Private>} />
              <Route path="/chats" element={<Private><Chats /></Private>} />
              <Route path="/chats/:id" element={<Private><Chats /></Private>} />
              <Route path="/profile" element={<Private><Profile /></Private>} />
              <Route path="/u/:id" element={<Profile />} />
              <Route path="/projects" element={<Private><MyProjects /></Private>} />
              <Route path="/welcome" element={<LegacyRedirect to="/" />} />
              <Route path="/places" element={<LegacyRedirect to="/map" />} />
              <Route path="/feed" element={<LegacyRedirect to="/map" list />} />
              <Route path="/add" element={<LegacyRedirect to="/create" />} />
              <Route path="/messages" element={<LegacyRedirect to="/chats" />} />
              <Route path="/messages/:id" element={<LegacyRedirect to="/chats" conversation />} />
              <Route path="*" element={<div className="page"><h1>{t("Страница не найдена")}</h1><p className="empty">{t("Проверь адрес или открой «Найти» в меню.")}</p></div>} />
            </Routes>
          </Suspense>
        </main>
        <MobileNav />
      </div>
  )
}

function Private({ children }: { children: ReactElement }) {
  const { t } = useI18n()
  const { ready, user, authError } = useSite()
  const location = useLocation()
  const desktop = useIsDesktop()
  if (!ready) return <div className="page" role="status">{authError ? t("Для продолжения восстанови подключение к аккаунту.") : t("Проверяем вход…")}</div>
  return user ? <Fragment key={user.id}>{children}</Fragment> : <Navigate to={desktop ? '/signin' : '/account/signin'} replace state={{ from: location.pathname + location.search + location.hash }} />
}

function LegacyRedirect({ to, list, conversation }: { to: string; list?: boolean; conversation?: boolean }) {
  const { search, hash } = useLocation()
  const { id } = useParams()
  return <Navigate replace to={legacyTarget(to, { search, hash, id: conversation ? id : undefined, list })} />
}

function ConnectionNotice() {
  const { t } = useI18n()
  const { authError, retryAuth, loadError, reloadOpportunities, stateError, refreshState } = useSite()
  const error = authError ?? loadError ?? stateError
  if (!error) return null
  const retry = authError ? retryAuth : loadError ? reloadOpportunities : refreshState
  return <div className="api-down" role="alert"><span>{t(error)}</span><button className="btn outline sm" onClick={() => { void retry().catch(() => undefined) }}>{t("Повторить")}</button></div>
}
