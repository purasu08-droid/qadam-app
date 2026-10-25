import assert from 'node:assert/strict'
import test from 'node:test'
import { hasMapViewport, isMapCoordinate, mapZoom } from '../src/site/map-geometry'

test('a CSS-hidden or collapsed map cannot start rendering, even with a valid city center', () => {
  for (const [width, height] of [[0, 0], [0, 852], [393, 0], [-1, 852], [NaN, 852], [393, Infinity]]) {
    assert.equal(hasMapViewport(width, height), false, `${width} x ${height}`)
  }
  assert.equal(hasMapViewport(393, 852), true)
  assert.equal(hasMapViewport(1280, 480), true)
})

test('map coordinates accept the geographic limits and reject malformed API values', () => {
  for (const value of [[43.2385, 76.93], [51.1282, 71.4304], [0, 0], [-90, -180], [90, 180]]) {
    assert.equal(isMapCoordinate(value), true)
  }
  for (const value of [null, undefined, [], [43], [0, 0, 0], ['43', '76'], [null, null], [NaN, NaN], [Infinity, 0], [0, -Infinity], [90.1, 0], [0, 180.1]]) {
    assert.equal(isMapCoordinate(value), false)
  }
})

test('zoom stays finite and inside the available tile range', () => {
  assert.equal(mapZoom(13), 13)
  assert.equal(mapZoom(-1), 0)
  assert.equal(mapZoom(30), 19)
  assert.equal(mapZoom(NaN), 13)
  assert.equal(mapZoom(Infinity), 13)
})
