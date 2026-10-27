import { Capacitor } from '@capacitor/core'
import type { SupabaseClient } from '@supabase/supabase-js'

/** Must match Android intent-filter + Supabase Additional Redirect URLs. */
export const NATIVE_AUTH_REDIRECT = 'com.cheerfulgames.resuming://auth/callback'

export function getAuthRedirectTo(): string {
  if (Capacitor.isNativePlatform()) return NATIVE_AUTH_REDIRECT
  const next = new URLSearchParams(window.location.search).get('next')
  if (next && next.startsWith('/') && !next.startsWith('//') && !next.includes('://')) {
    return `${window.location.origin}/?next=${encodeURIComponent(next)}`
  }
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

const exchangedCodes = new Set<string>()

export function oauthSessionCancelled(error: unknown): boolean {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === 'object' && error && 'message' in error
        ? String(error.message)
        : String(error)
  return /cancel/i.test(message)
}

export async function completeNativeAuthCallback(
  client: SupabaseClient,
  url: string,
): Promise<void> {
  const { code, accessToken, refreshToken, error } = parseAuthCallbackUrl(url)
  if (error) throw new Error(error)

  if (code) {
    if (exchangedCodes.has(code)) return
    exchangedCodes.add(code)
    const { error: exchangeError } = await client.auth.exchangeCodeForSession(code)
    if (exchangeError) {
      exchangedCodes.delete(code)
      throw exchangeError
    }
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

/** Opens sign-in. On iPhone, resolves with the return link. On Android, the app receives it later. */
export async function openNativeOAuthUrl(url: string): Promise<string | null> {
  if (Capacitor.getPlatform() === 'ios') {
    const { OAuthSession } = await import('./oauthSession')
    try {
      const result = await OAuthSession.start({
        url,
        callbackScheme: 'com.cheerfulgames.resuming',
      })
      return result.url
    } catch (err) {
      if (oauthSessionCancelled(err)) return null
      throw err
    }
  }

  const { Browser } = await import('@capacitor/browser')
  await Browser.open({ url })
  return null
}

export async function listenForNativeAuthCallback(
  client: SupabaseClient,
  onError: (message: string) => void,
): Promise<() => void> {
  if (!Capacitor.isNativePlatform()) return () => {}

  const { App } = await import('@capacitor/app')
  const { Browser } = await import('@capacitor/browser')

  const seen = new Set<string>()
  async function openUrl(url: string | undefined) {
    if (!url?.startsWith('com.cheerfulgames.resuming://')) return
    if (seen.has(url)) return
    seen.add(url)
    try {
      await completeNativeAuthCallback(client, url)
      await Browser.close().catch(() => {})
    } catch (err) {
      seen.delete(url)
      onError(err instanceof Error ? err.message : 'Sign-in failed')
    }
  }

  const handle = await App.addListener('appUrlOpen', ({ url }) => {
    void openUrl(url)
  })
  const launched = await App.getLaunchUrl()
  void openUrl(launched?.url)

  return () => {
    void handle.remove()
  }
}
