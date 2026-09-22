import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../hooks/useAuth'
import { isSupabaseConfigured } from '../lib/supabase'
import { loadGuestDraft } from '../lib/guestDraft'
import { MERGE_RETRY_MESSAGE, mergeGuestDraft } from '../lib/mergeGuestDraft'

/** After sign-in, copy the local draft once. Keep it if the save fails. */
export function GuestMergeBanner() {
  const { user } = useAuth()
  const [failed, setFailed] = useState(false)
  const [busy, setBusy] = useState(false)

  const run = useCallback(async () => {
    if (!user || !isSupabaseConfigured()) return
    const draft = loadGuestDraft()
    if (!draft) {
      setFailed(false)
      return
    }
    setBusy(true)
    try {
      await mergeGuestDraft(draft)
      setFailed(false)
    } catch {
      setFailed(true)
    } finally {
      setBusy(false)
    }
  }, [user])

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
