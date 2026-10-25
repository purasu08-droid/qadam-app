import { useEffect, useState } from 'react'

const QUERY = '(min-width: 1024px)'

// Сайт-версия (ретро/геймификация) включается на широких экранах, мобильная — по макету.
export function useIsDesktop() {
  const [desktop, setDesktop] = useState(() => window.matchMedia(QUERY).matches)
  useEffect(() => {
    const mq = window.matchMedia(QUERY)
    const on = () => setDesktop(mq.matches)
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [])
  return desktop
}
