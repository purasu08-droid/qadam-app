import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom'
import { ChevronDown, FolderKanban, LogOut, MapPin, MessageCircle, Moon, Plus, Sun, User } from 'lucide-react'
import { CITIES } from '../data'
import { useSite } from '../state'
import { SiteLogo } from './Pixel'
import { Avatar } from './ui'
import { useTheme } from '../theme'
import { useI18n, type Language } from '../i18n'
import { useIsDesktop } from '../../useIsDesktop'

export default function Header() {
  const desktop = useIsDesktop()
  const { t, language, setLanguage } = useI18n()
  const { user, ready, signOut, city, setCity, state } = useSite()
  const { theme, setTheme } = useTheme()
  const themeAction = t(theme === 'dark' ? 'Включить светлую тему' : 'Включить тёмную тему')
  const location = useLocation()
  const nav = useNavigate()
  const [menu, setMenu] = useState<'city' | 'user' | null>(null)
  const [logoutError, setLogoutError] = useState<string | null>(null)
  const [loggingOut, setLoggingOut] = useState(false)
  const header = useRef<HTMLElement>(null)
  const cityButton = useRef<HTMLButtonElement>(null)
  const userButton = useRef<HTMLButtonElement>(null)
  useEffect(() => { setMenu(null) }, [location.pathname, location.search, location.hash])
  useEffect(() => {
    if (!menu) return
    const outside = (event: PointerEvent) => { if (!header.current?.contains(event.target as Node)) setMenu(null) }
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { setMenu(null); (menu === 'city' ? cityButton : userButton).current?.focus() }
    }
    document.addEventListener('pointerdown', outside)
    document.addEventListener('keydown', escape)
    return () => { document.removeEventListener('pointerdown', outside); document.removeEventListener('keydown', escape) }
  }, [menu])
  const logout = async () => {
    if (loggingOut) return
    setLoggingOut(true); setLogoutError(null)
    try { await signOut(); setMenu(null); nav('/') } catch (error) { setLogoutError((error as Error).message) } finally { setLoggingOut(false) }
  }
  const onLanding = location.pathname === '/'
  const links = [
    { to: '/#categories', label: 'Категории', active: onLanding && location.hash === '#categories' },
    { to: '/map', label: 'Карта', active: location.pathname === '/map' },
    { to: '/#faq', label: 'FAQ', active: onLanding && location.hash === '#faq' },
  ]
  return (
    <header className="topbar" ref={header}>
      <div className="topbar-inner">
        <Link to="/" aria-label={t("QADAM — на главную")}><SiteLogo /></Link>
        <nav className="topnav" aria-label={t("Разделы сайта")}>{links.map((link) => <NavLink key={link.label} to={link.to} className={() => link.active ? 'active' : ''}>{t(link.label)}</NavLink>)}</nav>
        <div className="topbar-right">
          <select className="language-select" aria-label={t('Язык интерфейса')} title={t('Язык интерфейса')} value={language} onChange={(event) => { setLanguage(event.target.value as Language); setMenu(null) }}>
            <option value="ru" lang="ru">RU</option>
            <option value="kk" lang="kk">ҚАЗ</option>
            <option value="en" lang="en">EN</option>
          </select>
          <button className="theme-toggle" type="button" aria-label={themeAction} title={themeAction} onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
            {theme === 'dark' ? <Sun size={20} aria-hidden="true" /> : <Moon size={20} aria-hidden="true" />}
          </button>
          <div className="dd">
            <button ref={cityButton} className="city-btn" aria-label={t('Город: {city}', {city:t(city)})} title={t('Город: {city}', {city:t(city)})} aria-expanded={menu === 'city'} aria-controls="city-options" onClick={() => setMenu(menu === 'city' ? null : 'city')}><MapPin size={16} /><span>{t(city)}</span><ChevronDown size={14} /></button>
            {menu === 'city' && <div id="city-options" className="dd-menu right" aria-label={t("Выбор города")}>{CITIES.map((c) => <button key={c.name} aria-pressed={c.name === city} className={c.name === city ? 'on' : ''} onClick={() => { setCity(c.name); setMenu(null); cityButton.current?.focus() }}>{t(c.name)}</button>)}</div>}
          </div>
          {user ? <>
            <Link to="/create" className="btn lime sm desktop-create"><Plus size={16} /> {t("Создать")}</Link>
            <div className="dd">
              <button ref={userButton} className="me-btn" aria-label={t("Меню профиля")} aria-expanded={menu === 'user'} aria-controls="profile-options" onClick={() => setMenu(menu === 'user' ? null : 'user')}><Avatar src={user.avatar} letter={user.name[0]} size={42} />{state.unread > 0 && <i className="dot" aria-label={t('Непрочитанных: {count}', {count:state.unread})} />}<ChevronDown size={16} /></button>
              {menu === 'user' && <div id="profile-options" className="dd-menu right"><div className="dd-head"><b>{user.name}</b><span>{user.role || user.email}</span></div><Link to={desktop ? '/profile' : '/account/profile'}><User size={16} />{t("Профиль")}</Link><Link to="/projects"><FolderKanban size={16} />{t("Мои проекты")}</Link><Link to="/chats"><MessageCircle size={16} />{t("Чаты")} {state.unread > 0 && <i className="count">{state.unread}</i>}</Link><button disabled={loggingOut} onClick={() => { void logout() }}><LogOut size={16} />{loggingOut ? t("Выходим…") : t("Выйти")}</button>{logoutError && <p className="err logout-error" role="alert">{t("Не удалось выйти.")} {t(logoutError)}</p>}</div>}
            </div>
          </> : ready ? <Link to={desktop ? '/signin' : '/account/signin'} className="btn lime sm" state={{ from: location.pathname + location.search + location.hash }}>{t("Войти")}</Link> : <span className="muted small" role="status">{t("Вход…")}</span>}
        </div>
      </div>
    </header>
  )
}
