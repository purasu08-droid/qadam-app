export type CategoryKey = 'meetups' | 'jobs' | 'ideas' | 'events'

export const CATEGORIES: Record<
  CategoryKey,
  { title: string; titleRu: string; color: string; accent: string; description: string }
> = {
  meetups: {
    title: 'Meetups',
    titleRu: 'Митапы',
    color: '#6e7193',
    accent: '#f5e98a',
    description: 'Host a hackathon, product design workshop, or tech conference.',
  },
  jobs: {
    title: 'Jobs',
    titleRu: 'Вакансии',
    color: '#e8871e',
    accent: '#1b1b1f',
    description: 'Recruit teammates, designers, developers, and co-founders.',
  },
  ideas: {
    title: 'Ideas',
    titleRu: 'Идеи',
    color: '#a5191a',
    accent: '#f5e98a',
    description: 'Share startup ideas, initiatives, and gather early feedback.',
  },
  events: {
    title: 'Events',
    titleRu: 'События',
    color: '#141418',
    accent: '#ef5350',
    description: 'Organize community events, networking, or workshops.',
  },
}

export const CATEGORY_ORDER: CategoryKey[] = ['meetups', 'jobs', 'ideas', 'events']

export const CATEGORY_COUNTS: Record<CategoryKey, number> = {
  meetups: 87,
  jobs: 97,
  ideas: 88,
  events: 67,
}

export const CITIES = ['Almaty', 'Astana', 'Shymkent', 'Karaganda', 'Aktobe', 'Atyrau', 'Pavlodar']
export const STAGES = ['Idea', 'Planning', 'Development', 'MVP', 'Growth']
export const SKILLS = [
  'Python',
  'React',
  'Flutter',
  'FastAPI',
  'NLP',
  'Figma',
  'UI/UX Design',
  'Community Management',
  'Partnership Development',
]

export type Person = {
  id: string
  name: string
  role: string
  city: string
  color: string
}

export const PEOPLE: Record<string, Person> = {
  aigerim: { id: 'aigerim', name: 'Aigerim Tulegenova', role: 'AI & Data Science Researcher', city: 'Almaty', color: '#c9814f' },
  timur: { id: 'timur', name: 'Timur Akhmetov', role: 'Startup Founder & PM', city: 'Astana', color: '#7a5c48' },
  dana: { id: 'dana', name: 'Dana Bekova', role: 'Senior Full-Stack Engineer', city: 'Shymkent', color: '#4f7fb0' },
  zhantore: { id: 'zhantore', name: 'Zhantore Uspanov', role: 'UI/UX Designer', city: 'Astana', color: '#2a2d3a' },
}

export type Project = {
  id: string
  kind: 'project' | 'event'
  category: CategoryKey
  tag: string
  stage: string
  title: string
  description: string
  skills: string[]
  author: string
  city: string
  remote: boolean
  coords: [number, number]
  date?: string
  venue?: string
}

export const PROJECTS: Project[] = [
  {
    id: 'nomadcode',
    kind: 'project',
    category: 'ideas',
    tag: 'Startup',
    stage: 'Development',
    title: 'NomadCode AI — Kazakh Language Copilot',
    description:
      'Empowering regional software teams to ship 3x faster with context-aware code suggestions in local languages and documentation.',
    skills: ['Python', 'NLP', 'React', 'FastAPI', 'Figma'],
    author: 'aigerim',
    city: 'Almaty',
    remote: true,
    coords: [43.238, 76.889],
  },
  {
    id: 'steppeeco',
    kind: 'project',
    category: 'ideas',
    tag: 'Social impact',
    stage: 'Planning',
    title: 'SteppeEco — Urban Circular Recycling App',
    description:
      'Turning city recycling into an engaging social habit through verified drop-off points and instant partner rewards.',
    skills: ['UI/UX Design', 'Flutter', 'Community Management', 'Partnership Development'],
    author: 'timur',
    city: 'Astana',
    remote: false,
    coords: [51.169, 71.449],
  },
  {
    id: 'dala-ui',
    kind: 'project',
    category: 'jobs',
    tag: 'Hiring',
    stage: 'MVP',
    title: 'Dala UI — Design System for Kazakh Fintech',
    description: 'Looking for a React engineer and a motion designer to finish an open-source component library.',
    skills: ['React', 'Figma', 'UI/UX Design'],
    author: 'dana',
    city: 'Shymkent',
    remote: true,
    coords: [42.341, 69.59],
  },
  {
    id: 'karaganda-ml',
    kind: 'project',
    category: 'meetups',
    tag: 'Meetup',
    stage: 'Planning',
    title: 'Karaganda ML Breakfast',
    description: 'Monthly morning meetup for ML practitioners: paper reviews, lightning talks and coffee.',
    skills: ['Python', 'NLP'],
    author: 'aigerim',
    city: 'Karaganda',
    remote: false,
    coords: [49.806, 73.085],
  },
  {
    id: 'ca-summit',
    kind: 'event',
    category: 'events',
    tag: 'Conference',
    stage: 'Planning',
    title: 'Central Asia Tech Summit & Demo Day',
    description: 'Two days of talks, investor office hours and a demo day for 30 regional startups.',
    skills: [],
    author: 'timur',
    city: 'Almaty',
    remote: false,
    coords: [43.256, 76.928],
    date: 'Oct 14, 2026',
    venue: 'SmArt.Point, Timiryazev St 28B',
  },
  {
    id: 'shymkent-founders',
    kind: 'event',
    category: 'events',
    tag: 'Networking',
    stage: 'Planning',
    title: 'Shymkent Tech Founders & Developers Meetup',
    description: 'Evening networking for founders and engineers in the south of Kazakhstan.',
    skills: [],
    author: 'dana',
    city: 'Shymkent',
    remote: false,
    coords: [42.315, 69.586],
    date: 'Nov 02, 2026',
    venue: 'Shymkent IT Park, Tauke Khan 15',
  },
  {
    id: 'aktobe-hack',
    kind: 'event',
    category: 'meetups',
    tag: 'Hackathon',
    stage: 'Planning',
    title: 'Aktobe Weekend Hackathon',
    description: '48 hours, teams of 4, prizes for the best govtech prototypes.',
    skills: ['Python', 'React'],
    author: 'timur',
    city: 'Aktobe',
    remote: false,
    coords: [50.283, 57.167],
    date: 'Dec 05, 2026',
    venue: 'Aktobe Hub',
  },
]

export type Conversation = {
  id: string
  person: string
  time: string
  preview: string
  unread: number
  online: boolean
  mine?: boolean
}

export const CONVERSATIONS: Conversation[] = [
  {
    id: 'c1',
    person: 'aigerim',
    time: '12:45',
    preview: 'The new model weights for Kazakh code completion are ready to test.',
    unread: 1,
    online: true,
  },
  {
    id: 'c2',
    person: 'timur',
    time: 'Yesterday',
    preview: 'We scheduled our pitch practice for the Astana Hub demo on Friday.',
    unread: 0,
    online: false,
  },
  {
    id: 'c3',
    person: 'dana',
    time: '3 days ago',
    preview: 'Awesome, see you at the Central Asia Tech Summit!',
    unread: 0,
    online: true,
  },
  {
    id: 'c4',
    person: 'timur',
    time: 'Mon',
    preview: 'Отклик на «QADAM Community»: готов помочь с фронтендом.',
    unread: 2,
    online: false,
    mine: true,
  },
]

export type MyProject = {
  id: string
  title: string
  badge: string
  badgeColor: string
  description: string
  views: number
  members?: number
  color: string
  icon: 'users' | 'bulb' | 'calendar' | 'briefcase'
}

export const MY_PROJECTS: MyProject[] = [
  {
    id: 'm1',
    title: 'QADAM Community',
    badge: 'Идет набор',
    badgeColor: '#e3197b',
    description: 'Поиск дизайнеров и разработчиков для хакатона',
    views: 133,
    members: 56,
    color: '#4b3f8f',
    icon: 'users',
  },
  {
    id: 'm2',
    title: 'AI Startup',
    badge: 'Идея',
    badgeColor: 'rgba(255,255,255,.18)',
    description: 'Сбор обратной связи и поиск инвесторов',
    views: 154,
    color: '#6e7193',
    icon: 'bulb',
  },
  {
    id: 'm3',
    title: 'Jobs Board',
    badge: 'Вакансия',
    badgeColor: '#1b1b1f',
    description: 'Ищем Flutter-разработчика в команду SteppeEco',
    views: 72,
    members: 4,
    color: '#d5873a',
    icon: 'briefcase',
  },
  {
    id: 'm4',
    title: 'Design Sprint',
    badge: 'Митап',
    badgeColor: 'rgba(255,255,255,.18)',
    description: 'Двухдневный спринт по UX для локальных стартапов',
    views: 41,
    members: 9,
    color: '#6e7193',
    icon: 'users',
  },
  {
    id: 'm5',
    title: 'Молодежный Хакатон',
    badge: 'Событие',
    badgeColor: '#e8871e',
    description: 'Короткие проекты и поиск разработчиков для команды',
    views: 89,
    members: 12,
    color: '#8c2323',
    icon: 'calendar',
  },
]
