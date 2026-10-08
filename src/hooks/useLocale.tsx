import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useAuth } from './useAuth'
import {
  bindLocale,
  getLocale,
  hasSavedLocale,
  isLocale,
  persistLocale,
  readInitialLocale,
  translate,
  type Locale,
} from '../lib/i18n'
import { createSupabaseClient, isSupabaseConfigured, sendQuery } from '../lib/supabase'

type LocaleContextValue = {
  locale: Locale
  /** Someone already chose a language on this device, or the account has one. */
  localeChosen: boolean
  /** False only while we are still checking the account for a saved language. */
  localeResolved: boolean
  setLocale: (locale: Locale) => void
  t: (key: string, vars?: Record<string, string | number>) => string
}

const LocaleContext = createContext<LocaleContextValue | null>(null)

export function LocaleProvider({ children }: { children: ReactNode }) {
  const { user, loading: authLoading } = useAuth()
  const [locale, setLocaleState] = useState<Locale>(() => readInitialLocale())
  const [localeChosen, setLocaleChosen] = useState(hasSavedLocale)
  const [localeResolved, setLocaleResolved] = useState(hasSavedLocale)
  const pulledFor = useRef<string | null>(null)
  const pickedThisSession = useRef(false)

  bindLocale(locale)

  useEffect(() => {
    document.documentElement.lang = locale
  }, [locale])

  const userId = user?.id ?? null

  useEffect(() => {
    if (hasSavedLocale()) {
      setLocaleChosen(true)
      setLocaleResolved(true)
    }
    if (authLoading) return
    if (!userId || !isSupabaseConfigured()) {
      pulledFor.current = null
      setLocaleResolved(true)
      return
    }
    if (pulledFor.current === userId) return
    pulledFor.current = userId
    let cancelled = false
    let finished = false
    const client = createSupabaseClient()
    void client
      .from('profiles')
      .select('locale')
      .eq('id', userId)
      .maybeSingle()
      .then(async ({ data, error }) => {
        if (cancelled) return
        if (error) {
          finished = true
          setLocaleResolved(true)
          return
        }
        if (pickedThisSession.current) {
          await client.from('profiles').update({ locale: getLocale() }).eq('id', userId)
          if (!cancelled) {
            finished = true
            setLocaleResolved(true)
          }
          return
        }
        const saved = data?.locale
        if (isLocale(saved)) {
          persistLocale(saved)
          setLocaleState(saved)
          setLocaleChosen(true)
        }
        if (!cancelled) {
          finished = true
          setLocaleResolved(true)
        }
      })
    return () => {
      cancelled = true
      if (!finished) pulledFor.current = null
    }
  }, [authLoading, userId])

  const value = useMemo<LocaleContextValue>(
    () => ({
      locale,
      localeChosen,
      localeResolved,
      setLocale: (next) => {
        pickedThisSession.current = true
        persistLocale(next)
        setLocaleState(next)
        setLocaleChosen(true)
        setLocaleResolved(true)
        if (!user || !isSupabaseConfigured()) return
        sendQuery(createSupabaseClient().from('profiles').update({ locale: next }).eq('id', user.id), 'Save language')
      },
      t: (key, vars) => translate(locale, key, vars),
    }),
    [locale, localeChosen, localeResolved, user],
  )

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>
}

export function useLocale(): LocaleContextValue {
  const value = useContext(LocaleContext)
  if (value) return value
  const locale = readInitialLocale()
  bindLocale(locale)
  const chosen = hasSavedLocale()
  return {
    locale,
    localeChosen: chosen,
    localeResolved: true,
    setLocale: (next) => {
      persistLocale(next)
    },
    t: (key, vars) => translate(locale, key, vars),
  }
}
