import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { Capacitor } from '@capacitor/core'
import { clearAccountIdCache, sessionIsGone } from '../lib/accountId'
import {
  createSupabaseClient,
  getSupabaseConfigError,
  isSupabaseConfigured,
} from '../lib/supabase'
import { fetchIsAdmin } from '../lib/analytics'
import {
  appleAccountError,
  appleSignInCancelled,
  nativeAppleSignIn,
  rememberAppleSignIn,
} from '../lib/appleAuth'
import {
  completeNativeAuthCallback,
  getAuthRedirectTo,
  listenForNativeAuthCallback,
  openNativeOAuthUrl,
  parseAuthCallbackUrl,
} from '../lib/nativeAuth'
import { scrubErrorMessage } from '../lib/errorReporting'
import { track } from '../lib/track'

interface AuthContextValue {
  session: Session | null
  user: User | null
  loading: boolean
  configured: boolean
  configError: string | null
  authError: string | null
  isAdmin: boolean
  signInWithApple: () => Promise<void>
  signInWithGoogle: () => Promise<void>
  signInWithEmail: (email: string) => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

function clearAuthCallbackFromUrl(): void {
  if (typeof window === 'undefined') return
  const url = new URL(window.location.href)
  const hash = url.hash
  const hasHashAuth =
    hash.includes('access_token') || hash.includes('error') || hash.includes('refresh_token')
  const hasQueryAuth =
    url.searchParams.has('code') ||
    url.searchParams.has('error') ||
    url.searchParams.has('error_description')
  if (!hasHashAuth && !hasQueryAuth) return
  if (hasHashAuth) url.hash = ''
  url.searchParams.delete('code')
  url.searchParams.delete('error')
  url.searchParams.delete('error_description')
  url.searchParams.delete('error_code')
  window.history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`)
}

function urlHasAuthCallback(): boolean {
  if (typeof window === 'undefined') return false
  const { hash, search } = window.location
  return (
    hash.includes('access_token') ||
    hash.includes('error_description') ||
    search.includes('code=')
  )
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const configError = getSupabaseConfigError()
  const configured = configError === null
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(configured)
  const [authError, setAuthError] = useState<string | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  // The Apple sheet backgrounds the page. A stale session cleared on return must not erase the sign-in that just succeeded.
  const suppressSignOut = useRef(false)

  useEffect(() => {
    if (!configured) {
      setLoading(false)
      return
    }

    const client = createSupabaseClient()
    let mounted = true
    // The stored token can name an account the server no longer has. Ignore it until that check finishes.
    let acceptSession = false
    let rejectedUserId: string | null = null

    async function init() {
      try {
        const { data, error } = await client.auth.getSession()
        if (!mounted) return

        if (error) {
          setAuthError(error.message)
        }

        if (data.session) {
          const { data: userData, error: userError } = await client.auth.getUser()
          if (!mounted) return
          // getUser drops a dead token from storage. Publish only the session that is still there.
          const { data: after } = await client.auth.getSession()
          if (sessionIsGone(userError) || !after.session || (!userError && !userData.user)) {
            rejectedUserId = data.session.user.id
            clearAccountIdCache()
            if (after.session) await client.auth.signOut({ scope: 'local' })
            if (mounted) setSession(null)
          } else {
            setSession(after.session)
            clearAuthCallbackFromUrl()
          }
        } else if (urlHasAuthCallback()) {
          const callback = parseAuthCallbackUrl(window.location.href)
          try {
            if (!callback.error) await completeNativeAuthCallback(client, window.location.href)
            const { data: next, error: nextError } = await client.auth.getSession()
            if (next.session) setSession(next.session)
            else setAuthError(callback.error || nextError?.message || 'Sign-in could not be finished. Try again.')
          } catch (err) {
            setAuthError(err instanceof Error ? err.message : 'Sign-in could not be finished. Try again.')
          }
          clearAuthCallbackFromUrl()
        }
      } catch (err) {
        if (!mounted) return
        setAuthError(err instanceof Error ? err.message : 'Auth init failed')
      } finally {
        acceptSession = true
        if (mounted) setLoading(false)
      }
    }

    void init()

    const {
      data: { subscription },
    } = client.auth.onAuthStateChange((event, nextSession) => {
      if (!mounted) return
      if (event === 'SIGNED_OUT') {
        if (!suppressSignOut.current) {
          clearAccountIdCache()
          setSession(null)
        }
        setLoading(false)
        return
      }
      if (!acceptSession || (nextSession?.user.id && nextSession.user.id === rejectedUserId)) return
      // Apple sign-in publishes the session itself, after the new token has settled.
      if (!suppressSignOut.current && nextSession) {
        setSession(nextSession)
        setAuthError(null)
        clearAuthCallbackFromUrl()
      }
      setLoading(false)
      const refreshToken = nextSession?.provider_refresh_token
      const apple = nextSession?.user.identities?.some((identity) => identity.provider === 'apple')
      if (event === 'SIGNED_IN' && refreshToken && apple) {
        window.setTimeout(() => {
          void rememberAppleSignIn(client, { refreshToken }).catch(() => {})
        }, 0)
      }
    })

    let removeNativeListener: (() => void) | undefined
    if (Capacitor.isNativePlatform()) {
      void listenForNativeAuthCallback(client, (message) => {
        if (mounted) setAuthError(message)
      }).then((remove) => {
        if (!mounted) {
          remove()
          return
        }
        removeNativeListener = remove
      })
    }

    return () => {
      mounted = false
      removeNativeListener?.()
      subscription.unsubscribe()
    }
  }, [configured])

  useEffect(() => {
    if (!configured) {
      setIsAdmin(false)
      return
    }
    const userId = session?.user?.id
    if (!userId) {
      setIsAdmin(false)
      return
    }
    let mounted = true
    fetchIsAdmin(userId)
      .then((admin) => {
        if (mounted) setIsAdmin(admin)
      })
      .catch(() => {
        if (mounted) setIsAdmin(false)
      })
    return () => {
      mounted = false
    }
  }, [configured, session?.user?.id])

  const signInWithApple = useCallback(async () => {
    const client = createSupabaseClient()
    if (Capacitor.getPlatform() === 'ios') {
      suppressSignOut.current = true
      let signedIn = false
      try {
        await client.auth.signOut({ scope: 'local' })
        let apple
        try {
          apple = await nativeAppleSignIn()
        } catch (err) {
          if (appleSignInCancelled(err)) return
          throw err
        }
        const { data, error } = await client.auth.signInWithIdToken({
          provider: 'apple',
          token: apple.identityToken,
          nonce: apple.rawNonce,
        })
        if (error || !data.session) throw appleAccountError(error ?? new Error('Apple sign-in did not return a session'))
        const { data: userData, error: userError } = await client.auth.getUser()
        if (sessionIsGone(userError) || (!userError && !userData.user)) {
          await client.auth.signOut({ scope: 'local' })
          throw new Error('Apple sign-in did not create an account. Try again.')
        }
        if (userError) throw userError
        signedIn = true
        setSession(data.session)
        const fullName = [apple.givenName, apple.familyName].filter(Boolean).join(' ')
        if (fullName) {
          await client.auth
            .updateUser({
              data: {
                full_name: fullName,
                given_name: apple.givenName,
                family_name: apple.familyName,
              },
            })
            .catch(() => {})
        }
        if (apple.authorizationCode) {
          window.setTimeout(() => {
            void rememberAppleSignIn(client, { authorizationCode: apple.authorizationCode }).catch(() => {})
          }, 0)
        }
      } catch (err) {
        if (!appleSignInCancelled(err)) {
          track('app_error', {
            kind: 'error',
            message: scrubErrorMessage(err) || 'Apple sign-in failed',
            file: 'apple-sign-in',
            line: null,
            col: null,
          })
        }
        throw err
      } finally {
        if (!signedIn) {
          suppressSignOut.current = false
          setSession(null)
        } else {
          window.setTimeout(() => {
            suppressSignOut.current = false
          }, 800)
        }
      }
      return
    }

    const native = Capacitor.isNativePlatform()
    const { data, error } = await client.auth.signInWithOAuth({
      provider: 'apple',
      options: {
        redirectTo: getAuthRedirectTo(),
        skipBrowserRedirect: native,
      },
    })
    if (error) throw error
    if (native) {
      if (!data.url) throw new Error('Apple sign-in did not return a URL')
      const callback = await openNativeOAuthUrl(data.url)
      if (callback) await completeNativeAuthCallback(client, callback)
    }
  }, [])

  const signInWithGoogle = useCallback(async () => {
    const client = createSupabaseClient()
    const native = Capacitor.isNativePlatform()
    const { data, error } = await client.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: getAuthRedirectTo(),
        skipBrowserRedirect: native,
      },
    })
    if (error) throw error
    if (native) {
      if (!data.url) throw new Error('Google sign-in did not return a URL')
      const callback = await openNativeOAuthUrl(data.url)
      if (callback) await completeNativeAuthCallback(client, callback)
    }
  }, [])

  const signInWithEmail = useCallback(async (email: string) => {
    const client = createSupabaseClient()
    const { error } = await client.auth.signInWithOtp({
      email: email.trim(),
      options: {
        emailRedirectTo: getAuthRedirectTo(),
        shouldCreateUser: true,
      },
    })
    if (error) throw error
  }, [])

  const signOut = useCallback(async () => {
    clearAccountIdCache()
    const client = createSupabaseClient()
    const { error } = await client.auth.signOut()
    if (error) throw error
  }, [])

  const value = useMemo(
    () => ({
      session,
      user: session?.user ?? null,
      loading,
      configured,
      configError,
      authError,
      isAdmin,
      signInWithApple,
      signInWithGoogle,
      signInWithEmail,
      signOut,
    }),
    [
      session,
      loading,
      configured,
      configError,
      authError,
      isAdmin,
      signInWithApple,
      signInWithGoogle,
      signInWithEmail,
      signOut,
    ],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return ctx
}

async function ensureProfile(
  userId: string,
  timezone: string,
): Promise<'created' | 'updated'> {
  const client = createSupabaseClient()

  const { data: existing } = await client
    .from('profiles')
    .select('id')
    .eq('id', userId)
    .maybeSingle()

  if (existing) {
    await client.from('profiles').update({ timezone }).eq('id', userId)
    return 'updated'
  }

  await client.from('profiles').insert({ id: userId, timezone })
  return 'created'
}

export function useProfileSync(user: User | null): void {
  useEffect(() => {
    if (!user || !isSupabaseConfigured()) return

    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone
    ensureProfile(user.id, timezone)
      .then((result) => {
        if (result === 'created') track('signup_completed')
      })
      .catch(console.error)
  }, [user])
}
