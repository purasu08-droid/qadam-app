import type { CSSProperties, ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Briefcase, CalendarDays, Lightbulb, MapPin, Users, type LucideIcon } from 'lucide-react'
import { KINDS, type Kind, type Opportunity, type Person } from '../data'
import { useI18n } from '../i18n'

export const KIND_ICON: Record<Kind, LucideIcon> = {
  meetup: Users,
  job: Briefcase,
  idea: Lightbulb,
  event: CalendarDays,
}

export const kindStyle = (k: Kind) => ({ ['--k' as string]: KINDS[k].color }) as CSSProperties

export function KindIcon({ kind, size = 18 }: { kind: Kind; size?: number }) {
  const Icon = KIND_ICON[kind]
  return <Icon size={size} strokeWidth={1.8} />
}

export function KindBadge({ kind, solid = false, children }: { kind: Kind; solid?: boolean; children?: ReactNode }) {
  const { t } = useI18n()
  return (
    <span className={`kbadge ${solid ? 'solid' : ''}`} style={kindStyle(kind)} data-kind={kind}>
      {solid && <KindIcon kind={kind} size={13} />}
      {children ?? t(KINDS[kind].label)}
    </span>
  )
}

export function IconTile({ kind, size = 44 }: { kind: Kind; size?: number }) {
  return (
    <span className="itile" style={{ ...kindStyle(kind), width: size, height: size }}>
      <KindIcon kind={kind} size={Math.round(size * 0.48)} />
    </span>
  )
}

export function Avatar({ person, src, letter, kind, size = 44 }: { person?: Person; src?: string; letter?: string; kind?: Kind; size?: number }) {
  const img = src ?? person?.avatar
  const style = { width: size, height: size, fontSize: Math.round(size * 0.4), ...(kind ? kindStyle(kind) : {}) }
  if (img) return <img className="avatar" src={img} alt={person?.name ?? ''} style={style} />
  return (
    <span className={`avatar ${kind ? 'kind' : 'letter'}`} style={style} data-kind={kind}>
      {kind ? <KindIcon kind={kind} size={Math.round(size * 0.46)} /> : letter ?? person?.name[0]}
    </span>
  )
}

export function AvatarStack({ people, size = 32 }: { people: Person[]; size?: number }) {
  return (
    <span className="avstack">
      {people.map((p) => <Avatar key={p.id} person={p} size={size} />)}
    </span>
  )
}

// Картинка публикации; если её нет — обложка в цвете категории.
export function Cover({ o, hero = false, className = '' }: { o: Opportunity; hero?: boolean; className?: string }) {
  const src = hero ? o.hero ?? o.image : o.image
  if (src) return <img className={`cover ${className}`} src={src} alt="" />
  return (
    <span className={`cover gen ${className}`} style={kindStyle(o.kind)}>
      <KindIcon kind={o.kind} size={hero ? 120 : 56} />
      <i /><i /><i />
    </span>
  )
}

export function OppCard({ o }: { o: Opportunity }) {
  const { t } = useI18n()
  const systemCtas = ['Подробнее', 'Познакомиться', 'Посмотреть проект', 'Открыть', 'Открыть событие', 'Открыть проект', 'Присоединиться']
  return (
    <article className="ocard">
      <Link to={`/p/${o.id}`} className="ocard-img">
        <Cover o={o} />
        <KindBadge kind={o.kind} solid />
      </Link>
      <h3><Link to={`/p/${o.id}`}>{o.title}</Link></h3>
      <p className="ocard-meta"><MapPin size={13} /> {o.kind === 'event' ? t(o.city) : o.meta}</p>
      <p className="ocard-text">{o.card}</p>
      <Link to={`/p/${o.id}`} className="btn outline sm dblock">{systemCtas.includes(o.cta) ? t(o.cta) : o.cta} <ArrowRight size={15} /></Link>
    </article>
  )
}

export function PageHead({ title, sub, children }: { title: string; sub?: string; children?: ReactNode }) {
  return (
    <header className="page-head">
      <div>
        <h1>{title}</h1>
        {sub && <p>{sub}</p>}
      </div>
      {children}
    </header>
  )
}
