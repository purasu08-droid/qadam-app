import { config } from './config.js'
import { createApp } from './app.js'
import { seed } from './seed.js'

if (config.seedDemoData && seed()) console.log(`База пустая — загрузил демо-данные (${config.dbPath})`)

createApp().listen(config.port, () => {
  console.log(`QADAM API: http://localhost:${config.port}/api/health`)
})
