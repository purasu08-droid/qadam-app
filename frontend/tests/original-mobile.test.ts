import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { usesArchiveMobile } from '../src/site/app-surface'

test('every restored mobile screen, component, style and store matches the supplied archive byte for byte', () => {
  const root = new URL('../src/original-mobile/', import.meta.url)
  const manifest = JSON.parse(readFileSync(new URL('archive-manifest.json', root), 'utf8')) as { files: { path: string; sha256: string }[] }
  assert.equal(manifest.files.length, 20)
  for (const entry of manifest.files) {
    const hash = createHash('sha256').update(readFileSync(new URL(entry.path, root))).digest('hex')
    assert.equal(hash, entry.sha256, entry.path)
  }
})

test('phones use the exact archive routes while desktop keeps the existing site', () => {
  for (const path of ['/', '/welcome', '/signin', '/SIGNIN', '/places', '/feed', '/messages', '/messages/chat_1', '/profile', '/add', '/unknown', '/accounting', '/old-page', '/pricing', '/pricing/', '/campus', '/campus/campus_1', '/campus/signin', '/campus/account']) {
    assert.equal(usesArchiveMobile(path, false), true, path)
    assert.equal(usesArchiveMobile(path, true), false, path)
  }
})

test('real API destinations cannot fall through to local demo authentication', () => {
  for (const path of ['/account', '/account/', '/account/signin', '/account/profile', '/p/real_1', '/u/real_1', '/create', '/projects', '/chats', '/chats/real_1', '/map']) {
    assert.equal(usesArchiveMobile(path, false), false, path)
  }
})
