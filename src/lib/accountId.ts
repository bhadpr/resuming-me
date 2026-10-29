import { createSupabaseClient } from './supabase'

export const SIGN_IN_AGAIN = 'Sign in again, then save.'

/** The saved sign-in points at an account the server does not have. */
export function sessionIsGone(error: { message?: string; code?: string; name?: string } | null | undefined): boolean {
  const text = `${error?.name ?? ''} ${error?.code ?? ''} ${error?.message ?? ''}`
  return /user_not_found|does not exist|refresh_token_not_found|refresh token not found|session_not_found|session missing/i.test(text)
}

const ACCOUNT_ID_TTL_MS = 20_000
let cachedAccountId: { id: string; until: number } | null = null

/** Drop a remembered account id after sign-out, so the next save asks the server again. */
export function clearAccountIdCache(): void {
  cachedAccountId = null
}

/** Forget the sign-in stored on this phone. Does not call the auth server. */
export async function dropLocalSignIn(): Promise<void> {
  clearAccountIdCache()
  try {
    await createSupabaseClient().auth.signOut({ scope: 'local' })
  } catch {
    /* the stored sign-in is already unusable */
  }
}

/** The id to store, or a message when this sign-in cannot write yet. */
export function accountIdOrSignIn(userId: string | undefined, errorMessage?: string): string {
  if (userId) return userId
  if (errorMessage && /fetch|network|load failed/i.test(errorMessage)) throw new Error(errorMessage)
  throw new Error(SIGN_IN_AGAIN)
}

/**
 * The account id on this phone's current sign-in.
 * Read locally. A server round trip here can rotate the sign-in token and
 * sign the person out in the middle of a long list such as a cricket season.
 */
export async function requireAccountId(): Promise<string> {
  if (cachedAccountId && cachedAccountId.until > Date.now()) return cachedAccountId.id
  const client = createSupabaseClient()
  const { data, error } = await client.auth.getSession()
  const id = data.session?.user?.id
  if (id) {
    cachedAccountId = { id, until: Date.now() + ACCOUNT_ID_TTL_MS }
    return id
  }
  clearAccountIdCache()
  return accountIdOrSignIn(undefined, error?.message)
}
