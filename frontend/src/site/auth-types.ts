import type { Profile } from './api'
import type { Campus } from './campus-types'

export type AuthOptions = { demoLogin: boolean; campusDemoLogin: boolean }
export type CampusDemoSession = { user: Profile; campus: Campus & { isDemo: true } }
