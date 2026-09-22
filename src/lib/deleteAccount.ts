import { createSupabaseClient } from './supabase'
import { clearLocalAppData, markAccountDeleted } from './clearLocalData'

/**
 * Call the delete-account Edge Function (service role stays on the server),
 * then clear local state and sign out.
 */
export async function deleteCurrentAccount(): Promise<void> {
  const client = createSupabaseClient()
  const {
    data: { session },
  } = await client.auth.getSession()
  if (!session?.access_token) {
    throw new Error('You need to be signed in to delete your account.')
  }

  const { data, error } = await client.functions.invoke('delete-account', {
    method: 'POST',
  })

  if (error) {
    throw new Error(error.message || 'Could not delete account.')
  }

  const body = data as { ok?: boolean; error?: string } | null
  if (body && body.ok === false) {
    throw new Error(body.error || 'Could not delete account.')
  }

  markAccountDeleted()
  clearLocalAppData()
  // Session may already be invalid after auth user deletion.
  try {
    await client.auth.signOut({ scope: 'local' })
  } catch {
    // ignore — local clear already happened
  }
}
