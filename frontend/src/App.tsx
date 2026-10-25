import SiteApp from './site/SiteApp'
import { lazy, Suspense } from 'react'
import { useLocation } from 'react-router-dom'
import { SiteProvider } from './site/state'
import { usesArchiveMobile } from './site/app-surface'
import { useIsDesktop } from './useIsDesktop'

const OriginalMobileApp = lazy(() => import('./original-mobile-extras/OriginalMobileApp'))

export default function App() {
  return <SiteProvider><ResponsiveApp /></SiteProvider>
}

function ResponsiveApp() {
  const { pathname } = useLocation()
  const desktop = useIsDesktop()
  return usesArchiveMobile(pathname, desktop)
    ? <Suspense fallback={<div aria-busy="true" style={{ height: '100dvh', background: '#d4f06e' }} />}><OriginalMobileApp /></Suspense>
    : <SiteApp />
}
