import { syncNativeChrome } from './nativeChrome'

export type ThemeId =
  | 'resuming'
  | 'nocturne'
  | 'slate'
  | 'dawn'
  | 'fresh'
  | 'vault'

export interface ThemeOption {
  id: ThemeId
  name: string
  description: string
  /** meta theme-color / PWA chrome */
  themeColor: string
  colorScheme: 'dark' | 'light'
}

export const DEFAULT_THEME: ThemeId = 'dawn'

export const THEME_STORAGE_KEY = 'resuming-theme'

export const THEMES: ThemeOption[] = [
  {
    id: 'resuming',
    name: 'Resuming',
    description: 'Warm paper, coral play accent — calm, readable, and low-noise.',
    themeColor: '#faf6f0',
    colorScheme: 'light',
  },
  {
    id: 'nocturne',
    name: 'Nocturne',
    description: 'Near-black machine UI — neon yellow signals, mono labels, sharp edges.',
    themeColor: '#07070b',
    colorScheme: 'dark',
  },
  {
    id: 'slate',
    name: 'Slate',
    description: 'Cool dark charcoal with indigo focus — quiet and productive.',
    themeColor: '#0f1218',
    colorScheme: 'dark',
  },
  {
    id: 'dawn',
    name: 'Dawn',
    description: 'Sunrise peach and bright teal — light morning tracking with energy.',
    themeColor: '#fff4e8',
    colorScheme: 'light',
  },
  {
    id: 'fresh',
    name: 'Fresh',
    description: 'Clean calendar blue — clear hierarchy, readable type, soft card elevation.',
    themeColor: '#eef2f9',
    colorScheme: 'light',
  },
  {
    id: 'vault',
    name: 'Vault',
    description: 'Near-black vault UI with lime signals — bold, readable, high-contrast.',
    themeColor: '#0a0a0a',
    colorScheme: 'dark',
  },
]

export function isThemeId(value: string | null | undefined): value is ThemeId {
  return THEMES.some((t) => t.id === value)
}

export function getTheme(id: ThemeId): ThemeOption {
  return THEMES.find((t) => t.id === id) ?? THEMES[0]
}

const RETIRED_THEMES: Record<string, ThemeId> = {
  modernist: 'dawn',
  broadsheet: 'dawn',
  sage: 'dawn',
  pulse: 'dawn',
}

export function readStoredTheme(): ThemeId {
  try {
    const raw = localStorage.getItem(THEME_STORAGE_KEY)
    if (raw === 'pixloo') return 'fresh'
    if (raw && raw in RETIRED_THEMES) return RETIRED_THEMES[raw]
    if (isThemeId(raw)) return raw
  } catch {
    /* ignore */
  }
  return DEFAULT_THEME
}

export function applyTheme(id: ThemeId): void {
  const theme = getTheme(id)
  const root = document.documentElement
  root.setAttribute('data-theme', theme.id)
  root.style.colorScheme = theme.colorScheme

  const meta = document.querySelector('meta[name="theme-color"]')
  if (meta) meta.setAttribute('content', theme.themeColor)

  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme.id)
  } catch {
    /* ignore */
  }

  void syncNativeChrome(theme).catch(() => {})
}
