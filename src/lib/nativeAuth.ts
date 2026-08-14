import { Capacitor } from '@capacitor/core'
import type { SupabaseClient } from '@supabase/supabase-js'

/** Must match Android intent-filter + Supabase Additional Redirect URLs. */
export const NATIVE_AUTH_REDIRECT = 'com.cheerfulgames.resuming://auth/callback'

export function getAuthRedirectTo(): string {
  if (Capacitor.isNativePlatform()) return NATIVE_AUTH_REDIRECT
  return `${window.location.origin}/`
}

export function parseAuthCallbackUrl(url: string): {
  code: string | null
  accessToken: string | null
  refreshToken: string | null
  error: string | null
} {
  const parsed = new URL(url)
  const hash = parsed.hash.startsWith('#') ? parsed.hash.slice(1) : parsed.hash
  const hashParams = new URLSearchParams(hash)

  return {
    code: parsed.searchParams.get('code'),
    accessToken: hashParams.get('access_token'),
    refreshToken: hashParams.get('refresh_token'),
    error:
      parsed.searchParams.get('error_description') ??
      parsed.searchParams.get('error') ??
      hashParams.get('error_description') ??
      hashParams.get('error'),
  }
}

export async function completeNativeAuthCallback(
  client: SupabaseClient,
  url: string,
): Promise<void> {
  const { code, accessToken, refreshToken, error } = parseAuthCallbackUrl(url)
  if (error) throw new Error(error)

  if (code) {
    const { error: exchangeError } = await client.auth.exchangeCodeForSession(code)
    if (exchangeError) throw exchangeError
    return
  }

  if (accessToken && refreshToken) {
    const { error: sessionError } = await client.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    })
    if (sessionError) throw sessionError
  }
}

export async function openNativeOAuthUrl(url: string): Promise<void> {
  const { Browser } = await import('@capacitor/browser')
  await Browser.open({ url })
}

export async function listenForNativeAuthCallback(
  client: SupabaseClient,
  onError: (message: string) => void,
): Promise<() => void> {
  if (!Capacitor.isNativePlatform()) return () => {}

  const { App } = await import('@capacitor/app')
  const { Browser } = await import('@capacitor/browser')

  const handle = await App.addListener('appUrlOpen', async ({ url }) => {
    if (!url.startsWith('com.cheerfulgames.resuming://')) return
    try {
      await completeNativeAuthCallback(client, url)
      await Browser.close().catch(() => {})
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Google sign-in failed')
    }
  })

  return () => {
    void handle.remove()
  }
}
