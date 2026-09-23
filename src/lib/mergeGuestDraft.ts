import { createSupabaseClient } from './supabase'
import { clearGuestDraft, guestDraftToPayload, type GuestDraft } from './guestDraft'

export const MERGE_RETRY_MESSAGE = "We couldn't save that just yet — tap to retry."

export { guestDraftToPayload }

/**
 * Copy the local guest draft into the signed-in account in one RPC.
 * On failure the draft stays in localStorage.
 */
export async function mergeGuestDraft(draft: GuestDraft): Promise<void> {
  const client = createSupabaseClient()
  const { error } = await client.rpc('merge_guest_draft', {
    payload: guestDraftToPayload(draft),
  })
  if (error) throw error
  clearGuestDraft()
}
