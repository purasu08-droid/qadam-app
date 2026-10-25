// API account pages and desktop-only pricing/Campus keep their own presentation.
export function usesOriginalMobileDesign(pathname: string) {
  return !/^\/(?:account|campus|pricing)(?:\/|$)/i.test(pathname)
}
