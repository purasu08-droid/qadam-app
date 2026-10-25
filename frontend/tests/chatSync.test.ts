import assert from 'node:assert/strict'
import test from 'node:test'
import { mergeMessages, mergeRoomSnapshots, readMarkerForViewport, startChatPolling } from '../src/site/screens/chatSync'
import type { ChatMessage, ConversationSummary } from '../src/site/api'

const first: ChatMessage = { id: 'm1', mine: false, text: 'Hello', createdAt: '2026-10-24T10:00:00.000Z' }
const sent: ChatMessage = { id: 'm2', mine: true, text: 'Reply', createdAt: '2026-10-24T10:00:01.000Z' }
const conversation: ConversationSummary = { id: 'c1', title: 'Team', type: 'group', unread: 1 }
const flush = async () => { for (let i = 0; i < 5; i += 1) await Promise.resolve() }

test('an older GET cannot erase a message confirmed by POST', () => {
  const current = [first, sent]
  const incoming = [first]
  assert.deepEqual(mergeMessages(current, incoming), [first, sent])
  assert.deepEqual(current, [first, sent])
  assert.deepEqual(incoming, [first])
})

test('merging de-duplicates a sent message already returned by GET and orders messages', () => {
  assert.deepEqual(mergeMessages([sent], [first, sent]), [first, sent])
  assert.equal(mergeMessages([first], [{ ...first, text: 'Updated' }])[0].text, 'Updated')
})

test('read marker follows the actual GET snapshot rather than an appended sent message', () => {
  const next = mergeRoomSnapshots({ conversation, messages: [first, sent] }, { conversation, messages: [first] })
  assert.deepEqual(next.messages, [first, sent])
  assert.equal(next.loadedThrough, first.id)
  assert.equal(mergeRoomSnapshots(null, { conversation, messages: [] }).loadedThrough, null)
})

test('polling while viewing older history leaves unseen messages unread until reaching the bottom', () => {
  const original = mergeRoomSnapshots(null, { conversation, messages: [first] })
  const incoming = { ...sent, mine: false }
  const updated = mergeRoomSnapshots(original, { conversation, messages: [first, incoming] })
  assert.equal(readMarkerForViewport(updated, { atBottom: false, hidden: false }), null)
  // Both scrolling down and the explicit new-messages action activate this
  // viewport state; the marker must use the latest GET, not the older snapshot.
  assert.equal(readMarkerForViewport(updated, { atBottom: true, hidden: false }), incoming.id)
})

test('a hidden tab cannot acknowledge messages even when positioned at the bottom', () => {
  const room = mergeRoomSnapshots(null, { conversation, messages: [first] })
  assert.equal(readMarkerForViewport(room, { atBottom: true, hidden: true }), null)
  assert.equal(readMarkerForViewport(room, { atBottom: false, hidden: true }), null)
  assert.equal(readMarkerForViewport(room, { atBottom: true, hidden: false }), first.id)
})

test('reaching the bottom acknowledges only downloaded messages and skips an already-read room', () => {
  const downloaded = mergeRoomSnapshots(null, { conversation, messages: [first] })
  const withLocalReply = { ...downloaded, messages: mergeMessages(downloaded.messages, [sent]) }
  assert.equal(readMarkerForViewport(withLocalReply, { atBottom: true, hidden: false }), first.id)
  assert.equal(readMarkerForViewport({ ...withLocalReply, conversation: { ...conversation, unread: 0 } }, { atBottom: true, hidden: false }), null)
})

function pollingFixture(initiallyHidden = false) {
  let hidden = initiallyHidden
  let nextTimer = 0
  let active = 0
  let maxActive = 0
  const timers = new Map<number, { callback: () => void; ms: number }>()
  const listeners = new Set<() => void>()
  const data: string[] = []
  const errors: unknown[] = []
  const requests: { signal: AbortSignal; resolve: (value: string) => void; reject: (error: Error) => void }[] = []
  const poll = startChatPolling({
    intervalMs: 4000,
    visibility: {
      hidden: () => hidden,
      subscribe: (listener) => { listeners.add(listener); return () => { listeners.delete(listener) } },
    },
    clock: {
      setTimeout: (callback, ms) => { const id = ++nextTimer; timers.set(id, { callback, ms }); return id },
      clearTimeout: (handle) => { timers.delete(handle as number) },
    },
    load: (signal) => new Promise<string>((resolve, reject) => {
      active += 1
      maxActive = Math.max(maxActive, active)
      let settled = false
      const finish = (callback: () => void) => { if (!settled) { settled = true; active -= 1; callback() } }
      requests.push({ signal, resolve: (value) => finish(() => resolve(value)), reject: (error) => finish(() => reject(error)) })
      signal.addEventListener('abort', () => finish(() => reject(new DOMException('Aborted', 'AbortError'))), { once: true })
    }),
    onData: (value) => { data.push(value) },
    onError: (error) => { errors.push(error) },
  })
  return {
    ...poll, requests, data, errors, timers, listeners,
    maxActive: () => maxActive,
    visibility: (value: boolean) => { hidden = value; for (const listener of listeners) listener() },
    tick: () => {
      assert.equal(timers.size, 1)
      const [id, timer] = [...timers][0]
      timers.delete(id)
      timer.callback()
    },
  }
}

test('poll requests never overlap and repeated reloads queue one follow-up', async () => {
  const fixture = pollingFixture()
  try {
    assert.equal(fixture.requests.length, 1)
    fixture.reload(); fixture.reload(); fixture.reload()
    assert.equal(fixture.requests.length, 1)
    fixture.requests[0].resolve('first')
    await flush()
    assert.equal([...fixture.timers.values()][0].ms, 0)
    fixture.tick()
    assert.equal(fixture.requests.length, 2)
    assert.equal(fixture.maxActive(), 1)
    fixture.requests[1].resolve('second')
    await flush()
    assert.equal([...fixture.timers.values()][0].ms, 4000)
    assert.deepEqual(fixture.data, ['first', 'second'])
  } finally { fixture.stop() }
})

test('hidden tabs abort and pause requests, then resume immediately on visibility', async () => {
  const fixture = pollingFixture(true)
  try {
    assert.equal(fixture.requests.length, 0)
    fixture.visibility(false)
    assert.equal(fixture.requests.length, 1)
    fixture.visibility(true)
    await flush()
    assert.equal(fixture.requests[0].signal.aborted, true)
    assert.equal(fixture.timers.size, 0)
    assert.deepEqual(fixture.errors, [])
    fixture.reload()
    assert.equal(fixture.requests.length, 1)
    fixture.visibility(false)
    assert.equal(fixture.requests.length, 2)
    assert.equal(fixture.maxActive(), 1)
  } finally { fixture.stop() }
})

test('polling retries after failure without clearing previously delivered data', async () => {
  const fixture = pollingFixture()
  try {
    fixture.requests[0].resolve('history')
    await flush()
    fixture.tick()
    fixture.requests[1].reject(new Error('offline'))
    await flush()
    assert.deepEqual(fixture.data, ['history'])
    assert.equal(fixture.errors.length, 1)
    fixture.reload()
    fixture.requests[2].resolve('reconnected')
    await flush()
    assert.deepEqual(fixture.data, ['history', 'reconnected'])
    assert.equal(fixture.maxActive(), 1)
  } finally { fixture.stop() }
})

test('a quick hide/show waits for the aborted request to settle before resuming', async () => {
  const fixture = pollingFixture()
  try {
    fixture.visibility(true)
    fixture.visibility(false)
    assert.equal(fixture.requests.length, 1)
    await flush()
    assert.equal([...fixture.timers.values()][0].ms, 0)
    fixture.tick()
    assert.equal(fixture.requests.length, 2)
    assert.equal(fixture.maxActive(), 1)
  } finally { fixture.stop() }
})

test('stopping also suppresses a late response from a loader that ignores abort', async () => {
  let finish!: (value: string) => void
  const received: string[] = []
  const poll = startChatPolling({
    intervalMs: 4000,
    visibility: { hidden: () => false, subscribe: () => () => {} },
    load: () => new Promise<string>((resolve) => { finish = resolve }),
    onData: (data) => { received.push(data) },
    onError: () => assert.fail('stopped poll must not report an error'),
  })
  poll.stop()
  finish('previous account')
  await flush()
  assert.deepEqual(received, [])
})

test('stopping cancels requests and timers and ignores late callbacks', async () => {
  const fixture = pollingFixture()
  fixture.stop()
  fixture.stop()
  fixture.requests[0].resolve('late private inbox')
  await flush()
  fixture.reload()
  assert.equal(fixture.requests[0].signal.aborted, true)
  assert.equal(fixture.timers.size, 0)
  assert.equal(fixture.listeners.size, 0)
  assert.deepEqual(fixture.data, [])
  assert.deepEqual(fixture.errors, [])
  assert.equal(fixture.requests.length, 1)
})
