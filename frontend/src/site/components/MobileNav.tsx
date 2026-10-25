import { FolderKanban, Mail, MapPin, MessageCircle, Plus, User } from 'lucide-react'
import { NavLink, useLocation } from 'react-router-dom'
import { useSite } from '../state'
import { useI18n } from '../i18n'
import { usesOriginalMobileDesign } from '../mobile-design'

export default function MobileNav() {
  const { t } = useI18n()
  const { user, state } = useSite()
  const { pathname } = useLocation()
  const original = usesOriginalMobileDesign(pathname)
  return (
    <nav className="mobile-nav" aria-label={t("Основная навигация")}>
      <NavLink to={original ? '/' : '/map?view=list'} className={({ isActive }) => `mobile-places ${(original ? pathname === '/' || pathname === '/map' : isActive) ? 'active' : ''}`}><MapPin size={22} /><span>{t(original ? 'Точки' : 'Найти')}</span></NavLink>
      <NavLink to="/projects" className="mobile-projects"><FolderKanban size={22} /><span>{t("Проекты")}</span></NavLink>
      <NavLink to="/create" className={({ isActive }) => `mobile-create ${isActive ? 'active' : ''}`}><Plus size={24} /><span>{t(original ? 'Добавить' : 'Создать')}</span></NavLink>
      <NavLink to="/chats" className="mobile-messages" aria-label={user && state.unread ? t('Чаты, непрочитанных: {count}', {count:state.unread}) : t("Чаты")}>{original ? <Mail size={22} /> : <MessageCircle size={22} />}<span>{t(original ? 'Сообщения' : 'Чаты')}</span>{user && state.unread > 0 && <i className="nav-unread" aria-hidden="true">{state.unread > 99 ? '99+' : state.unread}</i>}</NavLink>
      <NavLink to="/account/profile" className="mobile-profile"><User size={22} /><span>{t("Профиль")}</span></NavLink>
    </nav>
  )
}
