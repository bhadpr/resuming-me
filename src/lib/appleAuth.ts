import type { SupabaseClient } from '@supabase/supabase-js'

const APPLE_BUNDLE_ID = 'com.cheerfulgames.resuming'
const APPLE_REDIRECT = 'https://api.resuming.me/auth/v1/callback'

export function randomNonce(): string {
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  return [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

export async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

/** A failed Apple sign-in when this email already belongs to the Google account. */
export function appleAccountError(error: unknown): Error {
  const message = error instanceof Error ? error.message : 'Sign-in failed'
  if (/already registered|already exists|already been registered|already linked/i.test(message)) {
    return new Error('That email already uses Google. Sign in with Google to open the same account.')
  }
  return error instanceof Error ? error : new Error(message)
}

export function appleSignInCancelled(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error)
  return /cancel/i.test(message) || message.includes('1001')
}

export interface NativeAppleSignIn {
  identityToken: string
  authorizationCode: string
  givenName: string | null
  familyName: string | null
  rawNonce: string
}

/** The iPhone sheet. Web and Android use the browser instead. */
export async function nativeAppleSignIn(): Promise<NativeAppleSignIn> {
  const rawNonce = randomNonce()
  const nonce = await sha256Hex(rawNonce)
  const { SignInWithApple } = await import('@capacitor-community/apple-sign-in')
  const result = await SignInWithApple.authorize({
    clientId: APPLE_BUNDLE_ID,
    redirectURI: APPLE_REDIRECT,
    scopes: 'email name',
    nonce,
  })
  const identityToken = result.response.identityToken
  if (!identityToken) throw new Error('Apple sign-in did not return a token')
  return {
    identityToken,
    authorizationCode: result.response.authorizationCode,
    givenName: result.response.givenName,
    familyName: result.response.familyName,
    rawNonce,
  }
}

/** Keep the Apple refresh token on the server so delete-account can revoke it. */
export async function rememberAppleSignIn(
  client: SupabaseClient,
  body: { authorizationCode?: string; refreshToken?: string },
): Promise<void> {
  const { data, error } = await client.functions.invoke('delete-account', {
    method: 'POST',
    body: { action: 'remember', ...body },
  })
  if (error) throw error
  const result = data as { ok?: boolean; error?: string } | null
  if (result && result.ok === false) throw new Error(result.error || 'Could not save Apple sign-in')
}
