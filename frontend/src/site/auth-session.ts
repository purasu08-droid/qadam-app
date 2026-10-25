/** One cookie-writing request at a time; invalidated responses cannot change identity or route. */
export function createAuthSequencer() {
  let version = 0
  let writing = false
  return {
    get busy() { return writing },
    read() { return ++version },
    isCurrent(request: number) { return request === version },
    invalidate() { version += 1 },
    write() {
      if (writing) throw new Error('Дождись завершения текущего входа или выхода.')
      writing = true
      const request = ++version
      let finished = false
      const check = () => {
        if (finished || request !== version) throw new DOMException('Вход отменён', 'AbortError')
      }
      return {
        complete(commit: () => void, beforeCommit?: () => void) {
          check()
          beforeCommit?.()
          check()
          commit()
        },
        finish() {
          if (finished) return
          finished = true
          writing = false
        },
      }
    },
  }
}
