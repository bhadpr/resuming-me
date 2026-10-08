import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../hooks/useAuth'
import { isSupabaseConfigured } from '../lib/supabase'
import { loadGuestDraft, type GuestDraft } from '../lib/guestDraft'
import { MERGE_RETRY_MESSAGE, mergeGuestDraft } from '../lib/mergeGuestDraft'
import { track } from '../lib/track'

/** One merge per guest draft at a time, even if auth events re-run the effect. */
const merging = new Map<string, Promise<void>>()

function mergeOnce(draft: GuestDraft): Promise<void> {
  const running = merging.get(draft.guestId)
  if (running) return running
  const next = mergeGuestDraft(draft).finally(() => merging.delete(draft.guestId))
  merging.set(draft.guestId, next)
  return next
}

/** After sign-in, copy the local draft once. Keep it if the save fails. */
export function GuestMergeBanner() {
  const { user } = useAuth()
  const userId = user?.id ?? null
  const [failed, setFailed] = useState(false)
  const [busy, setBusy] = useState(false)

  const run = useCallback(async () => {
    if (!userId || !isSupabaseConfigured()) return
    const draft = loadGuestDraft()
    if (!draft) {
      setFailed(false)
      return
    }
    const alreadyRunning = merging.has(draft.guestId)
    setBusy(true)
    try {
      await mergeOnce(draft)
      if (alreadyRunning) return
      track('signup_completed', {
        activities: draft.activities.length,
        resumed_in_onboarding: draft.logs.length > 0,
      })
      setFailed(false)
    } catch {
      setFailed(true)
    } finally {
      setBusy(false)
    }
  }, [userId])

  useEffect(() => {
    void run()
  }, [run])

  if (!failed) return null

  return (
    <div className="guest-merge-banner" role="status">
      <button type="button" className="btn btn-primary" onClick={() => void run()} disabled={busy}>
        {busy ? 'Saving…' : MERGE_RETRY_MESSAGE}
      </button>
    </div>
  )
}
