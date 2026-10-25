import type { Project } from './mock'

// Геймификация: опыт начисляется за действия в приложении.
export const XP = { base: 1340, save: 10, join: 50, publish: 250, message: 5 }
export const LEVEL_STEP = 500
export const LEVEL_TITLES = ['Новичок', 'Искатель', 'Стартапер', 'Тимлид', 'Фаундер', 'Визионер', 'Легенда степи']

export function levelOf(xp: number) {
  const level = Math.floor(xp / LEVEL_STEP) + 1
  const into = xp % LEVEL_STEP
  return {
    level,
    title: LEVEL_TITLES[Math.min(level - 1, LEVEL_TITLES.length - 1)],
    into,
    need: LEVEL_STEP,
    pct: Math.round((into / LEVEL_STEP) * 100),
  }
}

export type GameState = {
  saved: string[]
  joined: string[]
  created: number
  messagesSent: number
  projects: Project[]
}

export type Quest = { id: string; title: string; hint: string; progress: number; goal: number; reward: number }

export function questsFor(s: GameState): Quest[] {
  const events = s.projects.filter((p) => p.kind === 'event' && s.joined.includes(p.id)).length
  return [
    { id: 'join', title: 'Собери пати', hint: 'Подай заявку в команду проекта', progress: s.joined.length, goal: 1, reward: XP.join },
    { id: 'save', title: 'Коллекционер', hint: 'Сохрани 3 проекта в закладки', progress: s.saved.length, goal: 3, reward: 30 },
    { id: 'publish', title: 'Создатель миров', hint: 'Опубликуй свой первый проект', progress: s.created, goal: 1, reward: XP.publish },
    { id: 'chat', title: 'На связи', hint: 'Отправь 3 сообщения', progress: s.messagesSent, goal: 3, reward: 15 },
    { id: 'events', title: 'Ивент-хантер', hint: 'Запишись на 2 события', progress: events, goal: 2, reward: 100 },
  ].map((q) => ({ ...q, progress: Math.min(q.progress, q.goal) }))
}

export type Badge = { id: string; icon: string; title: string; unlocked: boolean }

export function badgesFor(s: GameState): Badge[] {
  return [
    { id: 'verified', icon: '✓', title: 'Verified', unlocked: true },
    { id: 'early', icon: '★', title: 'Early adopter', unlocked: true },
    { id: 'party', icon: '⚔', title: 'Первая пати', unlocked: s.joined.length > 0 },
    { id: 'collector', icon: '◆', title: 'Коллекционер', unlocked: s.saved.length >= 3 },
    { id: 'founder', icon: '♛', title: 'Фаундер', unlocked: s.created > 0 },
    { id: 'social', icon: '✉', title: 'Душа компании', unlocked: s.messagesSent >= 3 },
    { id: 'nomad', icon: '⌂', title: 'Кочевник', unlocked: false },
    { id: 'legend', icon: '♜', title: 'Легенда', unlocked: false },
  ]
}

export const LEADERBOARD = [
  { id: 'aigerim', name: 'Aigerim Tulegenova', city: 'Almaty', xp: 4820 },
  { id: 'timur', name: 'Timur Akhmetov', city: 'Astana', xp: 3975 },
  { id: 'dana', name: 'Dana Bekova', city: 'Shymkent', xp: 2610 },
  { id: 'arman', name: 'Arman Seitkali', city: 'Karaganda', xp: 1720 },
  { id: 'madina', name: 'Madina Omarova', city: 'Aktobe', xp: 1190 },
  { id: 'nurlan', name: 'Nurlan Zhaksybek', city: 'Pavlodar', xp: 860 },
]

export function leaderboardWith(me: { name: string; city: string; xp: number }) {
  return [...LEADERBOARD.map((r) => ({ ...r, me: false })), { id: 'me', ...me, me: true }].sort((a, b) => b.xp - a.xp)
}
