import assert from 'node:assert/strict'
import test from 'node:test'
import { campusDemoPath, safeReturnPath, siteAuthReturnPath } from '../src/site/auth-utils'

test('auth return keeps an internal route, query and fragment', () => {
  assert.equal(safeReturnPath('/chats/c_123?filter=unread#latest'), '/chats/c_123?filter=unread#latest')
  assert.equal(safeReturnPath('/map?q=%D0%B8%D0%B4%D0%B5%D1%8F&view=list'), '/map?q=%D0%B8%D0%B4%D0%B5%D1%8F&view=list')
})

test('auth return rejects external, ambiguous and non-string destinations', () => {
  for (const value of ['https://evil.example', '//evil.example/a', '/\\evil.example/a', '/\nevil.example', 'javascript:alert(1)', '', null, { from: '/' }]) {
    assert.equal(safeReturnPath(value), '/', String(value))
  }
})

test('auth return prevents a sign-in redirect loop and normalizes dot segments', () => {
  for (const value of ['/signin', '/SIGNIN', '/%73ignin', '/signin/?from=/profile', '/profile/../signin#again']) assert.equal(safeReturnPath(value), '/')
  assert.equal(safeReturnPath('/profile/../projects?tab=team#list'), '/projects?tab=team#list')
  assert.equal(safeReturnPath('//evil.example', '/profile?tab=saved'), '/profile?tab=saved')
  assert.equal(safeReturnPath('//evil.example', 'https://also-evil.example'), '/')
})

test('both sign-in namespaces reject return loops, including case, encoded paths and trailing slashes', () => {
  for (const value of [
    '/account/signin', '/ACCOUNT/SIGNIN/', '/account/signin///?from=/account#again',
    '/account/%73ignin', '/%61ccount/signin', '/account%2Fsignin/', '/account/signin%2F',
    '/profile/../account/signin#again', '/account/%2e/signin', '/account/signin/../signin',
  ]) {
    assert.equal(safeReturnPath(value), '/', value)
    assert.equal(safeReturnPath(value, '/account/profile'), '/account/profile', value)
  }
  assert.equal(safeReturnPath(null, '/account/signin'), '/')
  assert.equal(safeReturnPath('/account/signin', '/signin'), '/')
})

test('the server sign-in defaults to the API profile while the existing desktop sign-in still defaults home', () => {
  for (const pathname of ['/account/signin', '/account/signin/', '/ACCOUNT/SIGNIN', '/account/%73ignin', '/%61ccount/signin/']) {
    assert.equal(siteAuthReturnPath(undefined, pathname), '/account/profile', pathname)
    assert.equal(siteAuthReturnPath('//external.example', pathname), '/account/profile', pathname)
    assert.equal(siteAuthReturnPath('/signin', pathname), '/account/profile', pathname)
    assert.equal(siteAuthReturnPath('/account/signin', pathname), '/account/profile', pathname)
  }
  assert.equal(siteAuthReturnPath(undefined, '/signin'), '/')
  assert.equal(siteAuthReturnPath('/account/signin', '/signin'), '/')
  assert.equal(siteAuthReturnPath(undefined, '/account/signin-other'), '/')
})

test('server sign-in preserves valid profile and API return destinations with query and fragment', () => {
  for (const destination of [
    '/account/profile?tab=saved#items', '/account/profile?tab=saved#packages',
    '/p/publication_123?from=profile#apply', '/create?draft=existing#roles', '/chats/c_123#latest',
  ]) {
    assert.equal(siteAuthReturnPath(destination, '/account/signin'), destination)
    assert.equal(siteAuthReturnPath(destination, '/signin'), destination)
  }
  for (const destination of ['https://external.example', '/\\external.example', '/%E0%A4%A', null, { from: '/account' }]) {
    assert.equal(siteAuthReturnPath(destination, '/account/signin'), '/account/profile')
  }
})

test('web Campus sign-in has a safe university return destination without allowing sign-in loops', () => {
  for (const destination of ['/campus/signin', '/CAMPUS/SIGNIN/', '/campus/%73ignin', '/%63ampus/signin', '/campus%2Fsignin/', '/campus/signin%2F', '/profile/../campus/signin#again']) {
    assert.equal(safeReturnPath(destination), '/', destination)
    assert.equal(siteAuthReturnPath(destination, '/campus/signin'), '/campus', destination)
  }
  assert.equal(siteAuthReturnPath(null, '/campus/signin'), '/campus')
  assert.equal(siteAuthReturnPath('/campus/campus_1?tab=students#pending', '/campus/signin'), '/campus/campus_1?tab=students#pending')
  assert.equal(siteAuthReturnPath('/account/signin', '/campus/signin'), '/campus')
  assert.equal(siteAuthReturnPath('/campus/signin', '/account/signin'), '/account/profile')
})

test('web demo tenant ids cannot insert another route, query, fragment or parent segment', () => {
  assert.equal(campusDemoPath('demo/id?tab=grants#old'), '/campus/demo%2Fid%3Ftab%3Dgrants%23old')
  for (const value of ['', ' ', '.', '..', 'a\nb']) assert.throws(() => campusDemoPath(value))
})
