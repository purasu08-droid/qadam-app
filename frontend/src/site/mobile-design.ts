// API account pages keep their presentation at every width.
export function usesOriginalMobileDesign(pathname: string) {
  return pathname !== '/account' && !pathname.startsWith('/account/')
}
