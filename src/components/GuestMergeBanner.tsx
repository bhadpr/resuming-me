import { useCallback, useEffect } from 'react'
import { useAuth } from '../hooks/useAuth'
import { isSupabaseConfigured } from '../lib/supabase'
import { loadGuestDraft, type GuestDraft } from '../lib/guestDraft'
import { accountIsGone } from '../lib/importSharedList'
import { mergeGuestDraft } from '../lib/mergeGuestDraft'
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

/** After sign-in, copy the local draft quietly. The home screen already shows the account. */
export function GuestMergeBanner() {
  const { user } = useAuth()
  const userId = user?.id ?? null

  const run = useCallback(async () => {
    if (!userId || !isSupabaseConfigured()) return
    const draft = loadGuestDraft()
    if (!draft) return
    const alreadyRunning = merging.has(draft.guestId)
    const copy = async () => {
      await mergeOnce(draft)
      if (alreadyRunning) return
      track('signup_completed', {
        activities: draft.activities.length,
        resumed_in_onboarding: draft.logs.length > 0,
      })
    }
    try {
      await copy()
    } catch (err) {
      if (accountIsGone(err)) return
      try {
        await mergeGuestDraft(draft)
        track('signup_completed', {
          activities: draft.activities.length,
          resumed_in_onboarding: draft.logs.length > 0,
        })
      } catch {
        /* the draft stays on the phone; the account is already signed in */
      }
    }
  }, [userId])

  useEffect(() => {
    if (!userId) return
    void run()
  }, [run, userId])

  return null
}
