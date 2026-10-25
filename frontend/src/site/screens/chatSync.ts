import type { ChatMessage, ConversationSummary } from '../api'

export type ChatRoom = { conversation: ConversationSummary; messages: ChatMessage[]; loadedThrough?: string | null }

// A poll started before POST /messages may arrive after its response. Keep every
// confirmed message by id so that this older snapshot cannot erase a sent reply.
export function mergeMessages(current: ChatMessage[], incoming: ChatMessage[]): ChatMessage[] {
  const messages = new Map(current.map((message) => [message.id, message]))
  for (const message of incoming) messages.set(message.id, message)
  return [...messages.values()].sort((a, b) => a.createdAt.localeCompare(b.createdAt))
}

export function mergeRoomSnapshots(current: ChatRoom | null, incoming: ChatRoom): ChatRoom {
  return {
    ...incoming,
    messages: mergeMessages(current?.messages ?? [], incoming.messages),
    // POST responses are merged locally, but only a GET snapshot can advance
    // the read marker beyond messages the client has actually downloaded.
    loadedThrough: incoming.messages[incoming.messages.length - 1]?.id ?? null,
  }
}

export function readMarkerForViewport(room: ChatRoom | null, { atBottom, hidden }: { atBottom: boolean; hidden: boolean }) {
  if (!atBottom || hidden || !room?.conversation.unread) return null
  return room.loadedThrough ?? null
}

type Visibility = { hidden: () => boolean; subscribe: (listener: () => void) => () => void }
type Clock = { setTimeout: (callback: () => void, ms: number) => unknown; clearTimeout: (handle: unknown) => void }
type PollOptions<T> = {
  load: (signal: AbortSignal) => Promise<T>
  onData: (data: T) => void
  onError: (error: unknown) => void
  intervalMs: number
  visibility?: Visibility
  clock?: Clock
}

const pageVisibility: Visibility = {
  hidden: () => document.visibilityState === 'hidden',
  subscribe: (listener) => {
    document.addEventListener('visibilitychange', listener)
    return () => document.removeEventListener('visibilitychange', listener)
  },
}
const realClock: Clock = {
  setTimeout: (callback, ms) => setTimeout(callback, ms),
  clearTimeout: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
}

// The next request starts only after the previous request settles. Explicit
// reloads coalesce, and hidden/unmounted views cancel their current GET.
export function startChatPolling<T>({ load, onData, onError, intervalMs, visibility = pageVisibility, clock = realClock }: PollOptions<T>) {
  let stopped = false
  let running = false
  let queued = false
  let timer: unknown
  let controller: AbortController | null = null

  const reload = async () => {
    clock.clearTimeout(timer)
    if (stopped || visibility.hidden()) return
    if (running) {
      queued = true
      return
    }
    running = true
    queued = false
    const request = new AbortController()
    controller = request
    try {
      const data = await load(request.signal)
      if (!stopped && !request.signal.aborted) onData(data)
    } catch (error) {
      if (!stopped && !request.signal.aborted) onError(error)
    } finally {
      running = false
      if (controller === request) controller = null
      if (!stopped && !visibility.hidden()) timer = clock.setTimeout(() => { void reload() }, queued ? 0 : intervalMs)
    }
  }
  const unsubscribe = visibility.subscribe(() => {
    if (visibility.hidden()) {
      clock.clearTimeout(timer)
      controller?.abort()
    } else void reload()
  })
  void reload()
  return {
    reload: () => { void reload() },
    stop: () => {
      if (stopped) return
      stopped = true
      clock.clearTimeout(timer)
      controller?.abort()
      unsubscribe()
    },
  }
}
