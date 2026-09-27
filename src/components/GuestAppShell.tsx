import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useLocale } from '../hooks/useLocale'
import { parseAppPath, stashAuthNext, tabFromView, type AppTab } from '../lib/navigation'
import { track } from '../lib/track'
import { useDocumentMeta } from '../hooks/useDocumentMeta'
import { BrandTitle } from './BrandTitle'
import { LanguagePicker } from './LanguagePicker'
import { BottomNav } from './BottomNav'
import { EmailSignInForm } from './EmailSignInForm'
import { GuestTodayPage } from './GuestTodayPage'

function guestTabFromPath(pathname: string): AppTab {
  return tabFromView(parseAppPath(pathname))
}

/** Guest shell: same bottom nav as signed-in; gated tabs show sign-in in-place. */
export function GuestAppShell() {
  const location = useLocation()
  const { t } = useLocale()
  const tab = guestTabFromPath(location.pathname)
  const label =
    tab === 'activities'
      ? t('nav.abhyas')
      : tab === 'metrics'
        ? t('nav.vitals')
        : tab === 'insights'
          ? t('nav.insights')
          : t('nav.today')
  useDocumentMeta({ title: `${label} · Resuming`, noindex: true })

  useEffect(() => {
    if (tab === 'today') return
    stashAuthNext(`${location.pathname}${location.search}`)
  }, [tab, location.pathname, location.search])

  return (
    <div className="app">
      <header className="app-header">
        <BrandTitle className="app-title" />
        <LanguagePicker />
      </header>
      <main className="app-main">
        {tab === 'today' ? <GuestTodayPage /> : <GuestSignInPanel tab={tab} />}
      </main>
      <BottomNav tab={tab} />
    </div>
  )
}

function GuestSignInPanel({ tab }: { tab: AppTab }) {
  const { signInWithGoogle, authError } = useAuth()
  const { t } = useLocale()
  const [signingIn, setSigningIn] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const label =
    tab === 'activities'
      ? t('nav.abhyas')
      : tab === 'metrics'
        ? t('nav.vitals')
        : tab === 'insights'
          ? t('nav.insights')
          : t('nav.today')
  const displayError = authError || error

  async function handleGoogle() {
    track('signin_method_clicked', { method: 'google' })
    setError(null)
    setSigningIn(true)
    try {
      await signInWithGoogle()
    } catch (err) {
      setError(err instanceof Error ? err.message : t('guest.signInFailed'))
      setSigningIn(false)
    }
  }

  return (
    <div className="guest-auth-stage">
      <div className="guest-auth-panel">
        <div className="guest-auth-panel-header">
          <h2>{label}</h2>
          <p className="screen-sub">{t('guest.signInToUse', { label })}</p>
        </div>
        {displayError && (
          <div className="notice notice-warning">
            <p>{displayError}</p>
          </div>
        )}
        <div className="landing-signin guest-auth-signin">
          <EmailSignInForm onClick={() => track('signin_method_clicked', { method: 'email' })} />
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => void handleGoogle()}
            disabled={signingIn}
          >
            {signingIn ? t('guest.openingGoogle') : t('landing.google')}
          </button>
        </div>
      </div>
    </div>
  )
}

export function isGuestAppPath(pathname: string): boolean {
  if (pathname === '/today' || pathname === '/insights') return true
  if (pathname === '/activities' || pathname.startsWith('/activities/')) return true
  if (pathname === '/numbers' || pathname.startsWith('/numbers/')) return true
  return false
}
