import { useEffect, useState } from 'react'
import { BrandTitle } from './BrandTitle'
import { FeedbackPage } from './FeedbackPage'
import { LegalPage } from './LegalPage'
import { SiteFooter } from './SiteFooter'
import { sitePageFromPath, type SitePageId } from '../lib/site'
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
  const [error, setError] = useState<string | null>(null)
  const [signingIn, setSigningIn] = useState(false)
  const [sitePage, setSitePage] = useState<SitePageId | null>(() =>
    sitePageFromPath(window.location.pathname),
  )

  useEffect(() => {
    if (!sitePage) trackPageView('/', 'Landing')
    else trackPageView(`/${sitePage}`, sitePage)
  }, [sitePage])

  useEffect(() => {
    const onPopState = () => setSitePage(sitePageFromPath(window.location.pathname))
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])

  function openSitePage(id: SitePageId | null) {
    setSitePage(id)
    const next = id ? `/${id}` : '/'
    if (window.location.pathname !== next) {
      window.history.pushState(null, '', next)
    }
  }

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

  if (sitePage === 'feedback') {
    return (
      <div className="landing landing-legal">
        <div className="landing-card landing-card-legal">
          <FeedbackPage onBack={() => openSitePage(null)} />
        </div>
      </div>
    )
  }

  if (sitePage) {
    return (
      <div className="landing landing-legal">
        <div className="landing-card landing-card-legal">
          <LegalPage page={sitePage} onBack={() => openSitePage(null)} />
        </div>
      </div>
    )
  }

  if (!configured) {
    return (
      <div className="landing">
        <div className="landing-card">
          <BrandTitle size="lg" className="landing-brand" />
          <p className="tagline">Track what you postpone. Resume what matters.</p>
          <div className="notice notice-warning">
            <p>{configError ?? 'Supabase is not configured.'}</p>
          </div>
          <SiteFooter onOpenPage={openSitePage} />
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
          Habit apps optimize one streak. Resuming shows avoidance across everything
          you&apos;re putting off — so the pattern stops being invisible.
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
            <span>Gym</span>
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
          <p className="landing-diagram-caption">Insights ties those skips together.</p>
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

        <SiteFooter onOpenPage={openSitePage} />
      </div>
    </div>
  )
}
