import { syncNativeChrome } from './nativeChrome'

export type ThemeId = 'dawn' | 'resuming' | 'slate'

/** What the person picked. `system` follows the phone's light or dark setting. */
export type ThemePreference = ThemeId | 'system'

export interface ThemeOption {
  id: ThemeId
  /** meta theme-color / PWA chrome */
  themeColor: string
  colorScheme: 'dark' | 'light'
}

export const DEFAULT_THEME = 'dawn' as const satisfies ThemeId
export const SYSTEM_LIGHT: ThemeId = 'dawn'
export const SYSTEM_DARK: ThemeId = 'slate'

export const THEME_STORAGE_KEY = 'resuming-theme'

export const THEMES: ThemeOption[] = [
  { id: 'dawn', themeColor: '#fff4e8', colorScheme: 'light' },
  { id: 'resuming', themeColor: '#faf6f0', colorScheme: 'light' },
  { id: 'slate', themeColor: '#0f1218', colorScheme: 'dark' },
]

export const THEME_PREFERENCES: ThemePreference[] = ['system', 'dawn', 'resuming', 'slate']

export function isThemeId(value: string | null | undefined): value is ThemeId {
  return THEMES.some((t) => t.id === value)
}

export function getTheme(id: ThemeId): ThemeOption {
  return THEMES.find((t) => t.id === id) ?? THEMES[0]
}

/** Themes that were removed, mapped to the closest one that stayed. */
const RETIRED_THEMES: Record<string, ThemeId> = {
  modernist: 'dawn',
  broadsheet: 'dawn',
  sage: 'dawn',
  pulse: 'dawn',
  pixloo: 'dawn',
  fresh: 'dawn',
  nocturne: 'slate',
  vault: 'slate',
}

export function normalizePreference(raw: string | null | undefined): ThemePreference {
  if (raw === 'system') return 'system'
  if (raw && raw in RETIRED_THEMES) return RETIRED_THEMES[raw]
  if (isThemeId(raw)) return raw
  return DEFAULT_THEME
}

export function readStoredPreference(): ThemePreference {
  try {
    return normalizePreference(localStorage.getItem(THEME_STORAGE_KEY))
  } catch {
    return DEFAULT_THEME
  }
}

export function phonePrefersDark(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false
  return window.matchMedia('(prefers-color-scheme: dark)').matches
}

export function resolveTheme(preference: ThemePreference, prefersDark = phonePrefersDark()): ThemeId {
  if (preference !== 'system') return preference
  return prefersDark ? SYSTEM_DARK : SYSTEM_LIGHT
}

export function applyTheme(preference: ThemePreference): ThemeId {
  const theme = getTheme(resolveTheme(preference))
  const root = document.documentElement
  root.setAttribute('data-theme', theme.id)
  root.style.colorScheme = theme.colorScheme

  const meta = document.querySelector('meta[name="theme-color"]')
  if (meta) meta.setAttribute('content', theme.themeColor)

  try {
    localStorage.setItem(THEME_STORAGE_KEY, preference)
  } catch {
    /* ignore */
  }

  void syncNativeChrome(theme).catch(() => {})
  return theme.id
}
