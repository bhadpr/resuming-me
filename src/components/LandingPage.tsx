import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Capacitor } from '@capacitor/core'
import { EmailSignInForm } from './EmailSignInForm'
import { BrandTitle } from './BrandTitle'
import { SiteFooter } from './SiteFooter'
import { trackPageView } from '../lib/analytics'
import { consumeAccountDeletedFlag } from '../lib/clearLocalData'
import {
  DEFAULT_DESCRIPTION,
  DEFAULT_TITLE,
  useDocumentMeta,
} from '../hooks/useDocumentMeta'
import { track } from '../lib/track'

interface LandingPageProps {
  configured: boolean
  configError?: string | null
  authError?: string | null
  onSignIn: () => Promise<void>
}

export function LandingPage({
  configured,
  configError = null,
  authError = null,
  onSignIn,
}: LandingPageProps) {
  const native = Capacitor.isNativePlatform()
  const [error, setError] = useState<string | null>(null)
  const [signingIn, setSigningIn] = useState(false)
  const [accountDeleted] = useState(() => consumeAccountDeletedFlag())

  useDocumentMeta({
    title: DEFAULT_TITLE,
    description: DEFAULT_DESCRIPTION,
    path: '/',
  })

  useEffect(() => {
    trackPageView('/', 'Landing')
    track('landing_viewed', {
      referrer: document.referrer ? document.referrer.slice(0, 200) : null,
    })
  }, [])

  async function handleSignIn() {
    track('signin_clicked')
    setError(null)
    setSigningIn(true)
    try {
      await onSignIn()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign-in failed')
      setSigningIn(false)
    }
  }

  const displayError = configError || authError || error

  if (!configured) {
    return (
      <div className="landing">
        <div className="landing-card">
          <BrandTitle size="lg" className="landing-brand" />
          <p className="tagline">Track what you postpone. Resume what matters.</p>
          <div className="notice notice-warning">
            <p>{configError ?? 'Supabase is not configured.'}</p>
          </div>
          <SiteFooter privacyOnly={native} />
        </div>
      </div>
    )
  }

  return (
    <div className="landing">
      <div className="landing-card">
        <BrandTitle size="lg" className="landing-brand" />
        <p className="tagline">Track what you postpone. Resume what matters.</p>
        <p className="explainer">
          Not a to-do list to empty. These are things that keep coming back.
          Skip them, see the pattern, and pick one small thing up when a few
          days go by.
        </p>

        <figure className="landing-figure">
          <picture>
            <source type="image/webp" srcSet="/landing-resume.webp" />
            <img
              className="landing-image"
              src="/landing-resume.jpg"
              alt="A calm desk scene: pausing, then picking work back up."
              width={960}
              height={640}
              decoding="async"
            />
          </picture>
        </figure>

        <div className="landing-diagram" aria-hidden>
          <div className="landing-diagram-row landing-diagram-skip">
            <span>Meditation</span>
            <span className="landing-diagram-bar" />
            <span>skipped</span>
          </div>
          <div className="landing-diagram-row landing-diagram-skip">
            <span>Reading</span>
            <span className="landing-diagram-bar" />
            <span>skipped</span>
          </div>
          <div className="landing-diagram-row landing-diagram-done">
            <span>Walk</span>
            <span className="landing-diagram-bar" />
            <span>done</span>
          </div>
          <p className="landing-diagram-caption">
            Skips are the point. Insights shows the pattern — not a list to finish.
          </p>
        </div>

        {accountDeleted && (
          <div className="notice" role="status">
            <p>Your account has been deleted.</p>
          </div>
        )}
        {displayError && (
          <div className="notice notice-warning">
            <p>{displayError}</p>
          </div>
        )}
        <Link className="btn btn-primary btn-lg" to="/start">
          Get started
        </Link>
        <EmailSignInForm />
        <button
          type="button"
          className="btn btn-secondary"
          onClick={handleSignIn}
          disabled={signingIn}
        >
          {signingIn ? 'Redirecting…' : 'Continue with Google'}
        </button>
        <button type="button" className="btn btn-ghost" disabled>
          Continue with Apple
        </button>
        <p className="screen-sub">Apple is coming later.</p>

        <SiteFooter privacyOnly={native} />
      </div>
    </div>
  )
}
