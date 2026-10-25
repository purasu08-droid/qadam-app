import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import Logo from '../components/Logo'
import { useStore } from '../store'

export default function Splash() {
  const nav = useNavigate()
  const { authed } = useStore()
  useEffect(() => {
    const t = setTimeout(() => nav(authed ? '/places' : '/welcome', { replace: true }), 1400)
    return () => clearTimeout(t)
  }, [authed, nav])
  return (
    <div className="splash" onClick={() => nav(authed ? '/places' : '/welcome', { replace: true })}>
      <Logo size={96} />
    </div>
  )
}
