import assert from 'node:assert/strict'
import test from 'node:test'
import { usesOriginalMobileDesign } from '../src/site/mobile-design'

test('server account pages retain their existing layout on direct and nested routes', () => {
  for (const pathname of ['/account', '/account/', '/account/signin', '/account/profile']) {
    assert.equal(usesOriginalMobileDesign(pathname), false, pathname)
  }
})

test('regular and legacy application routes share the original mobile presentation', () => {
  for (const pathname of ['/', '/map', '/p/publication_1', '/create', '/chats', '/chats/room_1', '/profile', '/u/user_1', '/projects', '/signin', '/places', '/messages/room_1']) {
    assert.equal(usesOriginalMobileDesign(pathname), true, pathname)
  }
})
