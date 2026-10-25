import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import vm from 'node:vm'
import ts from 'typescript'

type PreferenceApi = {
  useTheme: () => { theme: string }
  setTheme: (value: string) => void
  useI18n: () => { language: string }
  setLanguage: (value: string) => void
}
const siteDir = fileURLToPath(new URL('../src/site/', import.meta.url))
const compiled = new Map<string, string>()

// Run the real preference modules in an isolated window. The React adapter only
// mounts/unmounts their public hooks' subscriptions; it does not replace stores,
// storage handlers, snapshots, normalization or translation dependencies.
function preferenceWindow() {
  const values = new Map([['qadam.site.theme', 'dark'], ['qadam.site.language', 'ru']])
  const handlers = new Map<string, Set<(event: unknown) => void>>()
  const subscriptions = new Set<() => void>()
  let failWrites = false
  const storage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      if (failWrites) throw new Error('Storage is full')
      values.set(key, value)
    },
  }
  const attributes = new Map([['data-theme', 'dark']])
  const context = vm.createContext({
    document: {
      documentElement: {
        lang: 'ru',
        getAttribute: (name: string) => attributes.get(name) ?? null,
        setAttribute: (name: string, value: string) => attributes.set(name, value),
      },
      querySelector: () => ({ setAttribute: () => {} }),
    },
    localStorage: storage,
    window: {
      addEventListener: (name: string, handler: (event: unknown) => void) => {
        if (!handlers.has(name)) handlers.set(name, new Set())
        handlers.get(name)!.add(handler)
      },
      removeEventListener: (name: string, handler: (event: unknown) => void) => handlers.get(name)?.delete(handler),
    },
  })
  const modules = new Map<string, { exports: Record<string, unknown> }>()
  const react = {
    useSyncExternalStore: (subscribe: (listener: () => void) => () => void, snapshot: () => unknown) => {
      subscriptions.add(subscribe(() => {}))
      return snapshot()
    },
  }
  function load(filename: string): Record<string, unknown> {
    const cached = modules.get(filename)
    if (cached) return cached.exports
    if (!compiled.has(filename)) compiled.set(filename, ts.transpileModule(readFileSync(filename, 'utf8'), {
      compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
      fileName: filename,
    }).outputText)
    const module = { exports: {} }
    modules.set(filename, module)
    const run = vm.runInContext(`(function(require, module, exports) {\n${compiled.get(filename)}\n})`, context, { filename })
    run((specifier: string) => {
      if (specifier === 'react') return react
      assert.ok(specifier.startsWith('.'), `Unexpected dependency: ${specifier}`)
      return load(resolve(dirname(filename), `${specifier}.ts`))
    }, module, module.exports)
    return module.exports
  }
  return {
    load: (filename: string) => load(resolve(siteDir, filename)) as unknown as PreferenceApi,
    leaveServer: () => { for (const unsubscribe of subscriptions) unsubscribe(); subscriptions.clear() },
    externalChoice: (key: string, value: string) => {
      values.set(key, value)
      for (const handler of handlers.get('storage') ?? []) handler({ key, newValue: value, storageArea: storage })
    },
    failWrites: () => { failWrites = true },
    stored: (key: string) => values.get(key),
  }
}

for (const preference of [
  { file: 'theme.ts', key: 'qadam.site.theme', original: 'dark', chosen: 'light',
    read: (api: PreferenceApi) => api.useTheme().theme, choose: (api: PreferenceApi, value: string) => api.setTheme(value) },
  { file: 'i18n.ts', key: 'qadam.site.language', original: 'ru', chosen: 'en',
    read: (api: PreferenceApi) => api.useI18n().language, choose: (api: PreferenceApi, value: string) => api.setLanguage(value) },
]) {
  test(`${preference.file}: another tab's choice survives leaving the server UI for the archive and returning`, () => {
    const page = preferenceWindow()
    const api = page.load(preference.file)
    assert.equal(preference.read(api), preference.original)
    page.leaveServer()
    page.externalChoice(preference.key, preference.chosen)
    assert.equal(preference.read(api), preference.chosen)
    page.leaveServer()
  })

  test(`${preference.file}: failed persistence keeps the in-memory choice across unmount and remount`, () => {
    const page = preferenceWindow()
    const api = page.load(preference.file)
    preference.read(api)
    page.failWrites()
    preference.choose(api, preference.chosen)
    assert.equal(page.stored(preference.key), preference.original)
    page.leaveServer()
    assert.equal(preference.read(api), preference.chosen)
    page.leaveServer()
  })

  test(`${preference.file}: choosing before the first subscriber does not prevent later cross-tab synchronization`, () => {
    const page = preferenceWindow()
    const api = page.load(preference.file)
    preference.choose(api, preference.chosen)
    assert.equal(preference.read(api), preference.chosen)
    page.leaveServer()
    page.externalChoice(preference.key, preference.original)
    assert.equal(preference.read(api), preference.original)
    page.leaveServer()
  })
}
