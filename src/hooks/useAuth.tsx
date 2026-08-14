import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { Capacitor } from '@capacitor/core'
import {
  createSupabaseClient,
  getSupabaseConfigError,
  isSupabaseConfigured,
} from '../lib/supabase'
import { fetchIsAdmin } from '../lib/analytics'
import {
  getAuthRedirectTo,
  listenForNativeAuthCallback,
  openNativeOAuthUrl,
} from '../lib/nativeAuth'

interface AuthContextValue {
  session: Session | null
  user: User | null
  loading: boolean
  configured: boolean
  configError: string | null
  authError: string | null
  isAdmin: boolean
  signInWithGoogle: () => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

function clearAuthHashFromUrl(): void {
  if (typeof window === 'undefined') return
  const { hash, pathname, search } = window.location
  if (hash.includes('access_token') || hash.includes('error') || hash.includes('refresh_token')) {
    window.history.replaceState(null, '', `${pathname}${search}`)
  }
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

  useEffect(() => {
    if (!configured) {
      setLoading(false)
      return
    }

    const client = createSupabaseClient()
    let mounted = true

    async function init() {
      try {
        const { data, error } = await client.auth.getSession()
        if (!mounted) return

        if (error) {
          setAuthError(error.message)
        }

        if (data.session) {
          setSession(data.session)
          clearAuthHashFromUrl()
        } else if (urlHasAuthCallback()) {
          // OAuth redirected back, but session was not established (often a bad anon key).
          setAuthError(
            'Google sign-in returned, but the session could not be saved. Check that VITE_SUPABASE_ANON_KEY in .env is the full anon key from Supabase → Settings → API, then restart the dev server.',
          )
        }
      } catch (err) {
        if (!mounted) return
        setAuthError(err instanceof Error ? err.message : 'Auth init failed')
      } finally {
        if (mounted) setLoading(false)
      }
    }

    void init()

    const {
      data: { subscription },
    } = client.auth.onAuthStateChange((_event, nextSession) => {
      if (!mounted) return
      setSession(nextSession)
      if (nextSession) {
        setAuthError(null)
        clearAuthHashFromUrl()
      }
      setLoading(false)
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
      await openNativeOAuthUrl(data.url)
    }
  }, [])

  const signOut = useCallback(async () => {
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
      signInWithGoogle,
      signOut,
    }),
    [session, loading, configured, configError, authError, isAdmin, signInWithGoogle, signOut],
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

async function ensureProfile(userId: string, timezone: string): Promise<void> {
  const client = createSupabaseClient()

  const { data: existing } = await client
    .from('profiles')
    .select('id')
    .eq('id', userId)
    .maybeSingle()

  if (existing) {
    await client.from('profiles').update({ timezone }).eq('id', userId)
    return
  }

  await client.from('profiles').insert({ id: userId, timezone })
}

export function useProfileSync(user: User | null): void {
  useEffect(() => {
    if (!user || !isSupabaseConfigured()) return

    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone
    ensureProfile(user.id, timezone).catch(console.error)
  }, [user])
}
