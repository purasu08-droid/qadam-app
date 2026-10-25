import { existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

// корень пакета backend/ (и для src/ через tsx, и для dist/ после сборки)
export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')

const envFile = resolve(ROOT, '.env')
if (existsSync(envFile)) process.loadEnvFile(envFile)
const production = process.env.NODE_ENV === 'production'

export const config = {
  production,
  port: Number(process.env.PORT ?? 3001),
  dbPath: resolve(ROOT, process.env.DB_PATH ?? './data/qadam.db'),
  allowDemoLogin: process.env.ALLOW_DEMO_LOGIN === 'true' || (!production && process.env.ALLOW_DEMO_LOGIN !== 'false'),
  seedDemoData: process.env.SEED_DEMO_DATA === 'true' || (!production && process.env.SEED_DEMO_DATA !== 'false'),
  // Production requires HTTPS unless local HTTP is explicitly requested.
  cookieSecure: process.env.COOKIE_SECURE === 'true' || (production && process.env.COOKIE_SECURE !== 'false'),
  // The pilot displays future prices while every publication remains free.
  billingMode: process.env.BILLING_MODE === 'enforced' ? 'enforced' as const : 'preview' as const,
  frontendDist: resolve(ROOT, '../frontend/dist'),
}
