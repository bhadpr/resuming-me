import { useState } from 'react'

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
          <h1>Resuming</h1>
          <p className="tagline">Track what you postpone. Resume what matters.</p>
          <div className="notice notice-warning">
            <p>{configError ?? 'Supabase is not configured.'}</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="landing">
      <div className="landing-card">
        <h1>Resuming</h1>
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
      </div>
    </div>
  )
}
