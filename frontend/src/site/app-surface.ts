/** The archive owns its original routes on phones; server features retain their own routes. */
export function usesArchiveMobile(pathname: string, desktop: boolean) {
  if (desktop) return false
  return !/^\/(?:account|map|create|chats|projects|p|u)(?:\/|$)/i.test(pathname)
}
