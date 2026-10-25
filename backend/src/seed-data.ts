// Демо-данные для первого запуска (npm run seed пересоздаёт базу с ними).
// Тестовые аккаунты: у всех демо-пользователей пароль DEMO_PASSWORD.

export const DEMO_EMAIL = 'zhantore@qadam.kz'
export const DEMO_PASSWORD = 'qadam-demo'

export const CITY_COORDS: Record<string, [number, number]> = {
  Алматы: [43.2385, 76.93],
  Астана: [51.1282, 71.4304],
  Шымкент: [42.3174, 69.5901],
  Караганда: [49.8047, 73.1094],
  Актобе: [50.2839, 57.167],
  Атырау: [47.0945, 51.9238],
  Павлодар: [52.2873, 76.9674],
}

export type SeedUser = {
  key: string
  email: string
  name: string
  role: string
  city: string
  avatar?: string
  cover?: string
  bio?: string
  about?: string
  portfolio?: string
  skills?: string[]
  interests?: string[]
}

export const USERS: SeedUser[] = [
  {
    key: 'zhantore',
    email: DEMO_EMAIL,
    name: 'Жанторе Успанов',
    role: 'UI/UX-дизайнер',
    city: 'Алматы',
    avatar: '/img/av-zhantore.jpg',
    cover: '/img/profile-cover.jpg',
    bio: 'Создаю интерфейсы и ищу людей для совместных проектов.',
    about: 'Интересуюсь цифровыми продуктами, дизайном и анимацией. Хочу делать полезные проекты вместе с командой.',
    portfolio: 'https://www.behance.net',
    skills: ['Figma', 'UI/UX', 'Motion', 'Дизайн-системы'],
    interests: ['Технологии', 'Дизайн', 'Настольные игры', 'Английский'],
  },
  { key: 'aigerim', email: 'aigerim@qadam.kz', name: 'Айгерим Садыкова', role: 'Фаундер NomadCode AI', city: 'Алматы', avatar: '/img/av-aigerim.jpg', bio: 'Делаю AI-инструменты для разработчиков.' },
  { key: 'daniyar', email: 'daniyar@qadam.kz', name: 'Данияр Омаров', role: 'Продакт-менеджер', city: 'Алматы', avatar: '/img/av-daniyar.jpg', bio: 'Собираю команды и запускаю продукты.' },
  { key: 'aiterim', email: 'aiterim@qadam.kz', name: 'Айтерим Нурланова', role: 'Комьюнити-менеджер', city: 'Алматы', avatar: '/img/av-aiterim.jpg' },
]

export type SeedRole = { title: string; text: string; tags: string[]; icon: 'pen' | 'code' | 'mic' | 'chart' }

export type SeedOpportunity = {
  id: string
  kind: 'meetup' | 'job' | 'idea' | 'event'
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
  roles?: SeedRole[]
  conditions?: string
  author?: string
}

export const OPPORTUNITIES: SeedOpportunity[] = [
  {
    id: 'design-meetup',
    kind: 'event',
    title: 'Design Meetup Almaty',
    subtitle: 'Демонстрационный пример',
    meta: '24 октября · Smart.Point',
    city: 'Алматы',
    coords: [43.2468, 76.9452],
    card: 'Встреча дизайнеров, разработчиков и всех, кто любит создавать.',
    about: 'Встреча дизайнеров и разработчиков: разберём проекты, обменяемся опытом и познакомимся с командой.',
    cta: 'Подробнее',
    image: '/img/card-meetup-event.jpg',
    hero: '/img/event-hero.jpg',
    topic: 'Дизайн и технологии',
    date: '24 октября',
    time: '18:30–21:00',
    place: 'Smart.Point',
    program: [['18:30', 'Знакомство'], ['19:00', 'Разбор проектов'], ['20:00', 'Общение']],
    organizer: 'QADAM Community',
    author: 'zhantore',
  },
  {
    id: 'boardgames',
    kind: 'meetup',
    title: 'Настолки после пар',
    subtitle: 'Компания по интересам',
    meta: 'Игры · Общение',
    city: 'Алматы',
    coords: [43.2420, 76.9050],
    card: 'Неформальная встреча для тех, кто любит настольные игры и хорошую компанию.',
    about: 'Собираемся после пар, играем в настолки и знакомимся. Новичкам объясним правила — приходи один или с друзьями.',
    cta: 'Познакомиться',
    image: '/img/card-boardgames.jpg',
    hero: '/img/thumb-boardgames.jpg',
    date: 'Каждую пятницу',
    time: '19:00–22:00',
    place: 'Антикафе «Ход конём»',
    conditions: 'Участие бесплатное. Игры берём с собой — или выбираем на месте.',
    author: 'zhantore',
  },
  {
    id: 'nomadcode',
    kind: 'idea',
    title: 'NomadCode AI',
    subtitle: 'AI-помощник для кода на казахском языке',
    meta: 'Дизайнер · React',
    city: 'Алматы',
    coords: [43.2305, 76.9230],
    card: 'Создаём AI-помощника для разработчиков. Ищем единомышленников в команду.',
    about: 'Создаём AI-помощника для разработчиков с поддержкой казахского языка. Прототип готов — ищем людей для следующей версии.',
    cta: 'Посмотреть проект',
    image: '/img/card-mountains.jpg',
    hero: '/img/idea-hero.jpg',
    stage: 'Прототип',
    online: true,
    roles: [
      { title: 'UI/UX-дизайнер', text: 'Интерфейсы и дизайн-система', tags: ['Figma', 'UI/UX'], icon: 'pen' },
      { title: 'React-разработчик', text: 'Веб-интерфейс продукта', tags: ['React', 'TypeScript'], icon: 'code' },
    ],
    conditions: 'Совместный проект. Задачи и условия обсуждаются с автором.',
    author: 'aigerim',
  },
  {
    id: 'junior-uiux',
    kind: 'job',
    title: 'Junior UI/UX дизайнер',
    subtitle: 'Продуктовая студия в Алматы',
    meta: 'Оплачиваемая работа',
    city: 'Алматы',
    coords: [43.2320, 76.9640],
    card: 'Ищем начинающего UI/UX дизайнера в дружную команду.',
    about: 'Небольшая продуктовая студия ищет начинающего дизайнера. Будешь работать с мобильными и веб-интерфейсами вместе с наставником.',
    cta: 'Подробнее',
    image: '/img/card-laptop.jpg',
    stage: 'Полная занятость',
    online: false,
    roles: [{ title: 'UI/UX-дизайнер', text: 'Мобильные и веб-интерфейсы', tags: ['Figma', 'Прототипы'], icon: 'pen' }],
    conditions: 'Оплачиваемая работа. Гибкий график, офис в центре города.',
    author: 'daniyar',
  },
  {
    id: 'language-club',
    kind: 'meetup',
    title: 'Языковой клуб',
    subtitle: 'Разговорный английский',
    meta: 'Английский · Для новичков',
    city: 'Алматы',
    coords: [43.2525, 76.9180],
    card: 'Говорим по-английски на простые темы. Без оценок и стеснения.',
    about: 'Каждую субботу обсуждаем новую тему на английском. Уровень не важен — главное желание говорить.',
    cta: 'Познакомиться',
    date: 'По субботам',
    time: '12:00–14:00',
    place: 'Библиотека им. Пушкина',
    author: 'aigerim',
  },
  {
    id: 'campus-hackathon',
    kind: 'event',
    title: 'Campus Hackathon',
    subtitle: '48 часов, команды до 4 человек',
    meta: 'Технологии · Кампус',
    city: 'Алматы',
    coords: [43.2235, 76.9310],
    card: 'Студенческий хакатон: придумай и собери прототип за выходные.',
    about: 'Два дня, чтобы собрать команду и сделать прототип. Менторы, еда и призы для лучших проектов.',
    cta: 'Подробнее',
    image: '/img/cover-pixel.jpg',
    hero: '/img/cover-pixel.jpg',
    topic: 'Технологии',
    date: '15 ноября',
    time: '10:00–20:00',
    place: 'Кампус КазНУ',
    program: [['10:00', 'Открытие и сбор команд'], ['12:00', 'Работа над проектами'], ['18:00', 'Питчи и награждение']],
    organizer: 'Студсовет КазНУ',
  },
  {
    id: 'steppeeco',
    kind: 'idea',
    title: 'SteppeEco',
    subtitle: 'Экологические инициативы в городе',
    meta: 'Экология · Flutter',
    city: 'Алматы',
    coords: [43.2600, 76.9550],
    card: 'Приложение для городских эко-инициатив. Собираем команду для первого запуска.',
    about: 'Делаем приложение, которое помогает находить пункты приёма вторсырья и эко-акции рядом. Ищем людей для первого запуска.',
    cta: 'Посмотреть проект',
    image: '/img/thumb-sprout.jpg',
    hero: '/img/cover-steppeeco.jpg',
    stage: 'Идея',
    online: true,
    roles: [
      { title: 'Flutter-разработчик', text: 'Мобильное приложение', tags: ['Flutter', 'Dart'], icon: 'code' },
      { title: 'Комьюнити-менеджер', text: 'Партнёры и волонтёры', tags: ['SMM', 'Ивенты'], icon: 'mic' },
    ],
    conditions: 'Волонтёрский проект. Время и задачи обсуждаем вместе.',
    author: 'daniyar',
  },
  {
    id: 'frontend-dev',
    kind: 'job',
    title: 'Frontend-разработчик',
    subtitle: 'Веб-продукт для образования',
    meta: 'React · Веб-продукт',
    city: 'Алматы',
    coords: [43.2375, 76.8900],
    card: 'Ищем React-разработчика в команду образовательного продукта.',
    about: 'Развиваем платформу для онлайн-курсов. Нужен разработчик, который любит аккуратные интерфейсы.',
    cta: 'Подробнее',
    image: '/img/thumb-floppy.jpg',
    stage: 'Частичная занятость',
    online: true,
    roles: [{ title: 'React-разработчик', text: 'Веб-интерфейс продукта', tags: ['React', 'TypeScript'], icon: 'code' }],
    conditions: 'Оплачиваемая работа, можно удалённо.',
    author: 'aigerim',
  },
  {
    id: 'park-run',
    kind: 'meetup',
    title: 'Пробежка в парке',
    subtitle: 'Утренние пробежки по выходным',
    meta: 'Спорт · Утром',
    city: 'Алматы',
    coords: [43.2190, 76.9480],
    card: 'Бегаем 5 км в своём темпе и пьём кофе после.',
    about: 'Собираемся у входа в парк, бегаем 5 км в своём темпе и знакомимся за кофе.',
    cta: 'Познакомиться',
    date: 'По воскресеньям',
    time: '08:00–09:30',
    place: 'Парк Первого Президента',
    author: 'daniyar',
  },
  {
    id: 'astana-demo',
    kind: 'event',
    title: 'Astana Hub Demo Day',
    subtitle: 'Питчи студенческих стартапов',
    meta: '8 ноября · Astana Hub',
    city: 'Астана',
    coords: [51.0900, 71.4180],
    card: 'Студенческие команды показывают свои проекты инвесторам.',
    about: 'Десять студенческих команд показывают проекты инвесторам и менторам. После — нетворкинг.',
    cta: 'Подробнее',
    image: '/img/thumb-meetup.jpg',
    hero: '/img/thumb-meetup.jpg',
    topic: 'Стартапы',
    date: '8 ноября',
    time: '16:00–19:00',
    place: 'Astana Hub',
    program: [['16:00', 'Питчи'], ['18:00', 'Нетворкинг']],
    organizer: 'Astana Hub',
  },
  {
    id: 'shymkent-breakfast',
    kind: 'meetup',
    title: 'IT-завтрак в Шымкенте',
    subtitle: 'Разработчики юга',
    meta: 'IT · Нетворкинг',
    city: 'Шымкент',
    coords: [42.3200, 69.5960],
    card: 'Утренний нетворкинг для разработчиков и дизайнеров Шымкента.',
    about: 'Раз в месяц собираемся на завтрак: короткие доклады, новости и знакомства.',
    cta: 'Познакомиться',
    date: 'Первая суббота месяца',
    time: '10:00–12:00',
    place: 'Shymkent IT Park',
    author: 'daniyar',
  },
]

export type SeedProject = {
  key: string
  title: string
  text: string
  cover: string
  owner: string
  members: string[]
  status: 'prototype' | 'team' | 'work' | 'done'
  note: string
  opportunity?: string
}

export const PROJECTS: SeedProject[] = [
  { key: 'nomad', title: 'NomadCode AI', text: 'ИИ-помощник для кода на казахском языке', cover: '/img/cover-nomadcode.jpg', owner: 'zhantore', members: ['aigerim', 'daniyar'], status: 'prototype', note: 'Ищем UI/UX-дизайнера и React-разработчика', opportunity: 'nomadcode' },
  { key: 'steppe', title: 'SteppeEco', text: 'Экологические инициативы в городе', cover: '/img/cover-steppeeco.jpg', owner: 'daniyar', members: ['aiterim', 'aigerim', 'zhantore'], status: 'team', note: 'Обсуждаем идеи первого запуска', opportunity: 'steppeeco' },
  { key: 'campus', title: 'Campus Connect', text: 'Сообщество студентов и совместных проектов', cover: '/img/cover-campus.jpg', owner: 'zhantore', members: ['aigerim', 'daniyar'], status: 'work', note: 'Следующий шаг — сценарий знакомства' },
  { key: 'qala', title: 'Qala Guide', text: 'Гид по интересным местам Алматы', cover: '/img/cover-qala.jpg', owner: 'aiterim', members: ['daniyar', 'aigerim', 'zhantore'], status: 'work', note: 'Собираем первые подборки мест' },
  { key: 'study', title: 'Study Together', text: 'Совместная учёба и обмен знаниями', cover: '/img/cover-study.jpg', owner: 'zhantore', members: ['daniyar', 'aigerim'], status: 'team', note: 'Нужны авторы и наставники' },
  { key: 'pixel', title: 'Pixel Weekend', text: 'Небольшая игра, созданная командой', cover: '/img/cover-pixel.jpg', owner: 'daniyar', members: ['aiterim', 'zhantore'], status: 'done', note: 'Прототип готов к просмотру' },
]

// day: 0 — сегодня, 1 — вчера и т.д.; at — время «ЧЧ:ММ»
export type SeedMessage = { from: string; text: string; day: number; at: string; file?: { name: string; size: string } }

export type SeedConversation = {
  key: string
  type: 'direct' | 'group'
  members: string[]
  title?: string
  kind?: string
  letter?: string
  opportunity?: string
  project?: string
  unreadFor?: Record<string, number>
  messages: SeedMessage[]
}

export const CONVERSATIONS: SeedConversation[] = [
  {
    key: 'c1', type: 'direct', members: ['zhantore', 'aigerim'], opportunity: 'nomadcode', project: 'nomad',
    messages: [
      { from: 'aigerim', day: 0, at: '14:20', text: 'Привет! Посмотрела твоё портфолио. Понравился подход к интерфейсам.' },
      { from: 'zhantore', day: 0, at: '14:23', text: 'Привет! Спасибо. Хочу присоединиться к NomadCode AI как UI/UX-дизайнер.' },
      { from: 'aigerim', day: 0, at: '14:25', text: 'Отлично! Для начала нужно продумать главный экран и сценарий работы с кодом.' },
      { from: 'zhantore', day: 0, at: '14:28', text: 'Предлагаю начать с короткого созвона и собрать первый прототип в Figma.' },
      { from: 'aigerim', day: 0, at: '14:32', text: 'Давай начнём с главного экрана. Прикрепляю краткое описание проекта.', file: { name: 'Бриф NomadCode AI.pdf', size: 'PDF · 1.2 МБ' } },
    ],
  },
  {
    key: 'c2', type: 'group', title: 'Настолки после пар', kind: 'meetup', members: ['zhantore', 'daniyar', 'aiterim'], opportunity: 'boardgames', project: 'study',
    messages: [
      { from: 'daniyar', day: 0, at: '13:30', text: 'В пятницу собираемся в 19:00, как обычно.' },
      { from: 'zhantore', day: 0, at: '13:40', text: 'Буду! Принесу «Каркассон».' },
      { from: 'aiterim', day: 0, at: '13:45', text: 'Возьмём ещё одну игру?' },
    ],
  },
  {
    key: 'c3', type: 'group', title: 'Design Meetup Almaty', letter: 'A', members: ['zhantore', 'aiterim'], opportunity: 'design-meetup', project: 'campus',
    messages: [
      { from: 'aiterim', day: 0, at: '12:05', text: 'Спасибо за регистрацию! Начинаем в 18:30.' },
      { from: 'aiterim', day: 0, at: '12:10', text: 'Встречаемся у входа в Smart.Point.' },
    ],
  },
  {
    key: 'c4', type: 'direct', members: ['zhantore', 'daniyar'], opportunity: 'junior-uiux', unreadFor: { zhantore: 2 },
    messages: [
      { from: 'zhantore', day: 1, at: '17:02', text: 'Добрый день! Отправил отклик на вакансию Junior UI/UX дизайнера.' },
      { from: 'daniyar', day: 1, at: '18:15', text: 'Привет! Получил, спасибо.' },
      { from: 'daniyar', day: 1, at: '18:16', text: 'Спасибо, посмотрю портфолио.' },
    ],
  },
  {
    key: 'c5', type: 'group', title: 'SteppeEco', kind: 'idea', members: ['zhantore', 'daniyar', 'aiterim', 'aigerim'], opportunity: 'steppeeco', project: 'steppe',
    messages: [{ from: 'daniyar', day: 1, at: '16:40', text: 'Собираем идеи для первого запуска.' }],
  },
  {
    key: 'c6', type: 'group', title: 'Языковой клуб', kind: 'meetup', members: ['zhantore', 'aigerim'], opportunity: 'language-club', project: 'qala',
    messages: [{ from: 'aigerim', day: 1, at: '20:11', text: 'В субботу обсудим новую тему.' }],
  },
  {
    key: 'c7', type: 'group', title: 'Frontend-разработчик', kind: 'job', members: ['zhantore', 'aigerim', 'daniyar'], opportunity: 'frontend-dev', project: 'pixel',
    messages: [{ from: 'aigerim', day: 3, at: '11:00', text: 'Пришлите примеры ваших работ.' }],
  },
]

// что уже отмечено у демо-пользователя
export const DEMO_STATE = {
  attending: ['design-meetup'],
  saved: ['campus-hackathon', 'nomadcode'],
  applications: [{ opportunity: 'junior-uiux', role: 'UI/UX-дизайнер', message: 'Добрый день! Хочу откликнуться на вакансию.' }],
}
