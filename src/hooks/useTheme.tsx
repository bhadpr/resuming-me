import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import {
  applyTheme,
  getTheme,
  readStoredPreference,
  resolveTheme,
  type ThemeId,
  type ThemeOption,
  type ThemePreference,
} from '../lib/themes'

interface ThemeContextValue {
  /** The theme on screen now. */
  themeId: ThemeId
  theme: ThemeOption
  /** What the person picked, including Match phone. */
  preference: ThemePreference
  setPreference: (preference: ThemePreference) => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [preference, setPreferenceState] = useState<ThemePreference>(() => readStoredPreference())
  const [themeId, setThemeId] = useState<ThemeId>(() => resolveTheme(readStoredPreference()))

  useEffect(() => {
    setThemeId(applyTheme(preference))
    if (preference !== 'system' || typeof window === 'undefined' || !window.matchMedia) return
    const query = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => setThemeId(applyTheme('system'))
    query.addEventListener('change', onChange)
    return () => query.removeEventListener('change', onChange)
  }, [preference])

  const value = useMemo(
    () => ({
      themeId,
      theme: getTheme(themeId),
      preference,
      setPreference: setPreferenceState,
    }),
    [themeId, preference],
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider')
  return ctx
}
