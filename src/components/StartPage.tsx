import { useEffect, useState } from 'react'
import { Navigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import {
  clampStep,
  ensureGuestDraft,
  setGuestStep,
  type GuestDraft,
} from '../lib/guestDraft'

/**
 * Guest entry for onboarding. Question screens land in P2-02+.
 * This page creates the local draft and keeps ?step= in sync.
 */
export function StartPage() {
  const { user, loading } = useAuth()
  const [params, setParams] = useSearchParams()
  const [draft, setDraft] = useState<GuestDraft | null>(null)
  const force = params.get('force') === '1'

  useEffect(() => {
    if (loading || (user && !force)) return
    const current = ensureGuestDraft()
    const fromUrl = params.get('step')
    const step = fromUrl ? clampStep(Number(fromUrl)) : current.step
    const next = step === current.step ? current : setGuestStep(current, step)
    setDraft(next)
    if (String(next.step) !== fromUrl) {
      const nextParams = new URLSearchParams(params)
      nextParams.set('step', String(next.step))
      setParams(nextParams, { replace: true })
    }
  }, [loading, user, force, params, setParams])

  if (loading) {
    return (
      <div className="loading-screen">
        <p>Loading…</p>
      </div>
    )
  }

  if (user && !force) return <Navigate to="/today" replace />
  if (!draft) return null

  function go(step: number) {
    if (!draft) return
    const next = setGuestStep(draft, step)
    setDraft(next)
    const nextParams = new URLSearchParams(params)
    nextParams.set('step', String(next.step))
    setParams(nextParams)
  }

  return (
    <div className="landing">
      <div className="landing-card">
        <div className="onboarding-dots" aria-label={`Step ${draft.step} of 8`}>
          {Array.from({ length: 8 }, (_, i) => (
            <span
              key={i}
              className={i + 1 === draft.step ? 'onboarding-dot onboarding-dot-active' : 'onboarding-dot'}
            />
          ))}
        </div>
        <h1>Let’s set this up.</h1>
        <p className="explainer">
          Your answers stay on this device until you save them. Nothing is sent yet.
        </p>
        <p className="screen-sub">Step {draft.step} of 8</p>
        <div className="form-actions">
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => go(draft.step - 1)}
            disabled={draft.step <= 1}
          >
            Back
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => go(draft.step + 1)}
            disabled={draft.step >= 8}
          >
            Continue
          </button>
        </div>
      </div>
    </div>
  )
}
