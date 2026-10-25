// Справочники и типы сайт-версии. Сами данные приходят с бэкенда (backend/, см. ./api.ts).
import { formatDate } from './i18n'

export type Kind = 'meetup' | 'job' | 'idea' | 'event'

// Preserve seed labels while formatting the ISO dates from real publications.
export function formatEventDate(date?: string) {
  if (!date) return ''
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return date
  return formatDate(new Date(`${date}T12:00:00`), { day: 'numeric', month: 'long', year: 'numeric' })
}

export const KIND_ORDER: Kind[] = ['meetup', 'job', 'idea', 'event']

export const KINDS: Record<Kind, { label: string; plural: string; hint: string; tile: string; color: string; publish: string }> = {
  meetup: { label: 'Встреча', plural: 'Встречи', hint: 'Знакомься и находи своих.', tile: 'По интересам', color: '#9d6bff', publish: 'Опубликовать встречу' },
  job: { label: 'Работа', plural: 'Работа', hint: 'Найди команду для нового шага.', tile: 'Вакансия', color: '#f5a524', publish: 'Опубликовать вакансию' },
  idea: { label: 'Идея', plural: 'Идеи', hint: 'Делись задумками. Создавай вместе.', tile: 'Команда для проекта', color: '#ff4d5e', publish: 'Опубликовать идею' },
  event: { label: 'Событие', plural: 'События', hint: 'Узнай, что происходит рядом.', tile: 'Мероприятие', color: '#c6f432', publish: 'Опубликовать событие' },
}

export const CITIES: { name: string; coords: [number, number] }[] = [
  { name: 'Алматы', coords: [43.2385, 76.9300] },
  { name: 'Астана', coords: [51.1282, 71.4304] },
  { name: 'Шымкент', coords: [42.3174, 69.5901] },
  { name: 'Караганда', coords: [49.8047, 73.1094] },
  { name: 'Актобе', coords: [50.2839, 57.167] },
  { name: 'Атырау', coords: [47.0945, 51.9238] },
  { name: 'Павлодар', coords: [52.2873, 76.9674] },
]
export const OTHER_CITIES: string[] = []

export type Role = { title: string; text: string; tags: string[]; icon: 'pen' | 'code' | 'mic' | 'chart' }

export type Opportunity = {
  campus?: { id: string; name: string; city: string; isDemo?: boolean }
  campusHidden?: boolean
  moderationReason?: string | null
  id: string
  kind: Kind
  title: string
  subtitle: string
  meta: string
  city: string
  coords: [number, number]
  card: string
  about: string
  cta: string
  image?: string
  hero?: string
  topic?: string
  date?: string
  time?: string
  place?: string
  program?: [string, string][]
  organizer?: string
  stage?: string
  online?: boolean
  roles?: Role[]
  conditions?: string
  author?: Person
  createdAt?: string
}

export type Person = { id: string; name: string; short: string; city: string; avatar?: string; role?: string }

export type ProjectStatus = 'prototype' | 'team' | 'work' | 'done'
export const STATUS: Record<ProjectStatus, string> = {
  prototype: 'Прототип',
  team: 'Собираем команду',
  work: 'В работе',
  done: 'Завершён',
}

export const FAQ = [
  { q: 'Что такое QADAM?', a: 'Платформа, где студенты, разработчики, дизайнеры и фаундеры Казахстана находят команды, проекты и события рядом с собой.' },
  { q: 'Что доступно бесплатно?', a: 'Профиль, поиск, отклики и переписка бесплатны. Условия публикаций и добровольного продвижения — на странице «Тарифы».' },
  { q: 'Нужен опыт, чтобы участвовать?', a: 'Нет. Многие проекты ищут новичков — главное желание сделать первый шаг.' },
  { q: 'Как опубликовать свою идею или событие?', a: 'Нажми «Создать», выбери тип публикации, заполни описание и укажи, кого ищешь. Предпросмотр покажет, как её увидят другие.' },
  { q: 'В каких городах работает QADAM?', a: 'Сейчас — {cities}. Плюс онлайн-команды.' },
]
