import { useState, type FormEvent } from 'react'
import { useAuth } from '../hooks/useAuth'

export function EmailSignInForm({ onClick }: { onClick?: () => void }) {
  const { signInWithEmail } = useAuth()
  const [email, setEmail] = useState('')
  const [sending, setSending] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function submit(event: FormEvent) {
    event.preventDefault()
    const value = email.trim()
    if (!value) return
    onClick?.()
    setSending(true)
    setError(null)
    setNotice(null)
    try {
      await signInWithEmail(value)
      setNotice('Check your email for a sign-in link.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send the link.')
    } finally {
      setSending(false)
    }
  }

  return (
    <form className="email-sign-in" onSubmit={(event) => void submit(event)}>
      <label className="field">
        <span className="field-label">Email</span>
        <input
          className="field-input"
          type="email"
          autoComplete="email"
          inputMode="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="you@example.com"
          required
        />
      </label>
      <button type="submit" className="btn btn-secondary" disabled={sending}>
        {sending ? 'Sending…' : 'Email me a link'}
      </button>
      {notice && (
        <p className="screen-sub" role="status">
          {notice}
        </p>
      )}
      {error && <p className="error">{error}</p>}
    </form>
  )
}
