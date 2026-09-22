import { useEffect, useState } from 'react'
import { Capacitor } from '@capacitor/core'
import { BrandTitle } from './BrandTitle'
import { SiteFooter } from './SiteFooter'
import { trackPageView } from '../lib/analytics'

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

  useEffect(() => {
    trackPageView('/', 'Landing')
  }, [])

  async function handleSignIn() {
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
          <img
            className="landing-image"
            src="/landing-resume.jpg"
            alt="A calm desk scene: pausing, then picking work back up."
            width={960}
            height={640}
            decoding="async"
          />
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

        {displayError && (
          <div className="notice notice-warning">
            <p>{displayError}</p>
          </div>
        )}
        <button
          type="button"
          className="btn btn-primary btn-lg"
          onClick={handleSignIn}
          disabled={signingIn}
        >
          {signingIn ? 'Redirecting…' : 'Continue with Google'}
        </button>

        <SiteFooter privacyOnly={native} />
      </div>
    </div>
  )
}
