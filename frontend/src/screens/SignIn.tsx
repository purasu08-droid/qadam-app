import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import Logo from '../components/Logo'
import { useStore } from '../store'

export default function SignIn() {
  const nav = useNavigate()
  const { signIn } = useStore()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (!/^\S+@\S+\.\S+$/.test(email)) return setError('Введите корректный email')
    if (password.length < 6) return setError('Пароль — минимум 6 символов')
    signIn()
    nav('/places', { replace: true })
  }
  const apple = () => {
    signIn()
    nav('/places', { replace: true })
  }

  return (
    <form className="auth signin" onSubmit={submit} noValidate>
      <Logo size={88} />
      <p className="lead">Let’s take the first step</p>
      <input className="field" type="email" placeholder="Your Email" value={email} onChange={(e) => setEmail(e.target.value)} />
      <input className="field" type="password" placeholder="Your Password" value={password} onChange={(e) => setPassword(e.target.value)} />
      {error && <p className="error">{error}</p>}
      <button type="button" className="link muted">Forgot password?</button>
      <button type="submit" className="btn-black">Sign in</button>
      <div className="divider"><span>or</span></div>
      <button type="button" className="btn-outline" onClick={apple}>Continue with Apple</button>
      <button type="button" className="link muted">Don’t have an account?</button>
    </form>
  )
}
