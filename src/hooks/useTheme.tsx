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
  DEFAULT_THEME,
  getTheme,
  readStoredTheme,
  THEMES,
  type ThemeId,
  type ThemeOption,
} from '../lib/themes'

interface ThemeContextValue {
  themeId: ThemeId
  theme: ThemeOption
  themes: ThemeOption[]
  setThemeId: (id: ThemeId) => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [themeId, setThemeIdState] = useState<ThemeId>(() => {
    if (typeof document !== 'undefined') {
      const attr = document.documentElement.getAttribute('data-theme')
      if (attr && THEMES.some((t) => t.id === attr)) return attr as ThemeId
    }
    return DEFAULT_THEME
  })

  useEffect(() => {
    const stored = readStoredTheme()
    setThemeIdState(stored)
    applyTheme(stored)
  }, [])

  function setThemeId(id: ThemeId) {
    setThemeIdState(id)
    applyTheme(id)
  }

  const value = useMemo(
    () => ({
      themeId,
      theme: getTheme(themeId),
      themes: THEMES,
      setThemeId,
    }),
    [themeId],
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider')
  return ctx
}
