import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useAuth } from './useAuth'
import {
  bindLocale,
  getLocale,
  isLocale,
  persistLocale,
  readInitialLocale,
  translate,
  type Locale,
} from '../lib/i18n'
import { createSupabaseClient, isSupabaseConfigured } from '../lib/supabase'

type LocaleContextValue = {
  locale: Locale
  setLocale: (locale: Locale) => void
  t: (key: string, vars?: Record<string, string | number>) => string
}

const LocaleContext = createContext<LocaleContextValue | null>(null)

export function LocaleProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [locale, setLocaleState] = useState<Locale>(() => readInitialLocale())
  const pulledFor = useRef<string | null>(null)

  bindLocale(locale)

  useEffect(() => {
    document.documentElement.lang = locale
  }, [locale])

  const userId = user?.id ?? null

  useEffect(() => {
    if (!userId || !isSupabaseConfigured()) {
      pulledFor.current = null
      return
    }
    if (pulledFor.current === userId) return
    pulledFor.current = userId
    let cancelled = false
    const client = createSupabaseClient()
    void client
      .from('profiles')
      .select('locale')
      .eq('id', userId)
      .maybeSingle()
      .then(async ({ data, error }) => {
        if (cancelled || error) return
        const saved = data?.locale
        if (isLocale(saved)) {
          persistLocale(saved)
          setLocaleState(saved)
          return
        }
        await client.from('profiles').update({ locale: getLocale() }).eq('id', userId)
      })
    return () => {
      cancelled = true
    }
  }, [userId])

  const value = useMemo<LocaleContextValue>(
    () => ({
      locale,
      setLocale: (next) => {
        persistLocale(next)
        setLocaleState(next)
        if (!user || !isSupabaseConfigured()) return
        void createSupabaseClient().from('profiles').update({ locale: next }).eq('id', user.id)
      },
      t: (key, vars) => translate(locale, key, vars),
    }),
    [locale, user],
  )

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>
}

export function useLocale(): LocaleContextValue {
  const value = useContext(LocaleContext)
  if (value) return value
  const locale = readInitialLocale()
  bindLocale(locale)
  return {
    locale,
    setLocale: (next) => {
      persistLocale(next)
    },
    t: (key, vars) => translate(locale, key, vars),
  }
}
