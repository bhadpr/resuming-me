import { useState } from 'react'
import { useLocale } from '../hooks/useLocale'
import { track } from '../lib/track'

export function EmailSignIn({
  disabled = false,
  onSend,
}: {
  disabled?: boolean
  onSend: (email: string) => Promise<void>
}) {
  const { t } = useLocale()
  const [open, setOpen] = useState(false)
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (sent) return <p className="onboarding-hint">{t('landing.emailSent')}</p>

  if (!open) {
    return (
      <button
        type="button"
        className="btn btn-secondary"
        disabled={disabled}
        onClick={() => {
          track('signin_method_clicked', { method: 'email' })
          setOpen(true)
        }}
      >
        {t('landing.signInEmail')}
      </button>
    )
  }

  return (
    <form
      className="sign-in-email"
      onSubmit={(event) => {
        event.preventDefault()
        const address = email.trim()
        if (!address) return
        setBusy(true)
        setError(null)
        void onSend(address)
          .then(() => setSent(true))
          .catch((err: unknown) => {
            setError(err instanceof Error ? err.message : 'Could not send the link')
            setBusy(false)
          })
      }}
    >
      <input
        className="field-input"
        type="email"
        required
        autoComplete="email"
        inputMode="email"
        placeholder={t('landing.emailPlaceholder')}
        value={email}
        disabled={disabled || busy}
        onChange={(event) => setEmail(event.target.value)}
      />
      <button type="submit" className="btn btn-secondary" disabled={disabled || busy || !email.trim()}>
        {busy ? t('landing.emailSending') : t('landing.emailSend')}
      </button>
      {error && <p className="error">{error}</p>}
    </form>
  )
}
