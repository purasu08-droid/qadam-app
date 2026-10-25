import { Link, useNavigate } from 'react-router-dom'
import { Pin } from '../components/Logo'
import { useStore } from '../store'

export default function Welcome() {
  const nav = useNavigate()
  const { signIn } = useStore()
  const apple = () => {
    signIn()
    nav('/places', { replace: true })
  }
  return (
    <div className="auth welcome">
      <div className="welcome-pin"><Pin size={92} /></div>
      <h1>Welcome</h1>
      <p className="muted">Your first step begins here</p>
      <div className="stack">
        <Link to="/signin" className="btn-outline">Continue with Phone</Link>
        <button className="btn-black" onClick={apple}>Continue with Apple</button>
      </div>
      <p className="legal">
        By pressing on “Continue with” you agree to our <b>Terms of Service</b> and <b>Privacy Policy</b>
      </p>
    </div>
  )
}
