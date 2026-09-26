import { useEffect, useState } from 'react'
import { Navigate, useSearchParams } from 'react-router-dom'
import { StartFlow } from './start/StartFlow'
import { useAuth } from '../hooks/useAuth'
import { clampStep, ensureGuestDraft, setGuestStep, type GuestDraft } from '../lib/guestDraft'

/** Guest onboarding at /start?step=1..8. Signed-in visitors go to Today. */
export function StartPage() {
  const { user, loading, signInWithGoogle } = useAuth()
  const [params, setParams] = useSearchParams()
  const [draft, setDraft] = useState<GuestDraft | null>(null)
  const stepParam = params.get('step')
  const force = params.get('force') === '1'

  useEffect(() => {
    if (loading || (user && !force)) return
    const current = ensureGuestDraft()
    const step = stepParam ? clampStep(Number(stepParam)) : current.step
    const next = step === current.step ? current : setGuestStep(current, step)
    setDraft((prev) =>
      prev &&
      prev.guestId === next.guestId &&
      prev.step === next.step &&
      prev.updatedAt === next.updatedAt
        ? prev
        : next,
    )
    if (String(next.step) !== stepParam) {
      setParams(
        (currentParams) => {
          const nextParams = new URLSearchParams(currentParams)
          nextParams.set('step', String(next.step))
          return nextParams
        },
        { replace: true },
      )
    }
  }, [loading, user, force, stepParam, setParams])

  if (loading) {
    return (
      <div className="loading-screen">
        <p>Loading…</p>
      </div>
    )
  }

  if (user && !force) return <Navigate to="/today" replace />
  if (!draft) return null

  function update(next: GuestDraft) {
    setDraft(next)
    const nextParams = new URLSearchParams(params)
    nextParams.set('step', String(next.step))
    if (nextParams.toString() !== params.toString()) setParams(nextParams)
  }

  return (
    <div className="landing">
      <div className="landing-card start-card">
        <StartFlow
          draft={draft}
          onDraft={update}
          onGoogle={signInWithGoogle}
          adding={params.get('add') === '1'}
        />
      </div>
    </div>
  )
}
