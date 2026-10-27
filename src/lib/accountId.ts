import { createSupabaseClient } from './supabase'

export const SIGN_IN_AGAIN = 'Sign in again, then save.'

/** The id to store, or a message when this sign-in cannot write yet. */
export function accountIdOrSignIn(userId: string | undefined, errorMessage?: string): string {
  if (userId) return userId
  if (errorMessage && /fetch|network|load failed/i.test(errorMessage)) throw new Error(errorMessage)
  throw new Error(SIGN_IN_AGAIN)
}

/**
 * The signed-in account as the auth server sees it.
 * The saved session id can be stale, and the database rejects that id.
 */
export async function requireAccountId(): Promise<string> {
  const client = createSupabaseClient()
  const first = await client.auth.getUser()
  if (first.data.user?.id) return first.data.user.id

  const refreshed = await client.auth.refreshSession()
  if (refreshed.data.session) {
    const again = await client.auth.getUser()
    if (again.data.user?.id) return again.data.user.id
    return forgetSignIn(again.error?.message)
  }

  return forgetSignIn(first.error?.message)
}

async function forgetSignIn(errorMessage?: string): Promise<string> {
  if (errorMessage && /fetch|network|load failed/i.test(errorMessage)) {
    throw new Error(errorMessage)
  }
  const client = createSupabaseClient()
  await client.auth.signOut({ scope: 'local' })
  return accountIdOrSignIn(undefined, errorMessage)
}
