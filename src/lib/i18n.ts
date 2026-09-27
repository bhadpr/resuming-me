import { en } from './messages/en'
import { gu } from './messages/gu'
import { hi } from './messages/hi'
import { te } from './messages/te'

export type Locale = 'en' | 'hi' | 'te' | 'gu'

export const LOCALES: readonly Locale[] = ['en', 'hi', 'te', 'gu']

const LOCALE_TAGS: Record<Locale, string> = {
  en: 'en-IN',
  hi: 'hi-IN',
  te: 'te-IN',
  gu: 'gu-IN',
}

const STORAGE_KEY = 'resuming-locale'

/** Library copy reads this. Tests stay on English until the app binds a locale. */
let activeLocale: Locale = 'en'

export function getLocale(): Locale {
  return activeLocale
}

export function bindLocale(locale: Locale): void {
  activeLocale = locale
}

export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (LOCALES as readonly string[]).includes(value)
}

export function readInitialLocale(): Locale {
  if (typeof window === 'undefined') return 'en'
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY)
    if (isLocale(saved)) return saved
    const nav = window.navigator?.language?.toLowerCase() ?? ''
    const match = LOCALES.find((locale) => locale !== 'en' && nav.startsWith(locale))
    if (match) return match
  } catch {
    /* ignore */
  }
  return 'en'
}

export function persistLocale(locale: Locale): void {
  bindLocale(locale)
  if (typeof document !== 'undefined') {
    document.documentElement.lang = locale
  }
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(STORAGE_KEY, locale)
  } catch {
    /* ignore */
  }
}

type Vars = Record<string, string | number>

type Tree = { [key: string]: string | Tree }

function lookup(tree: Tree, key: string): string | null {
  const parts = key.split('.')
  let node: string | Tree = tree
  for (const part of parts) {
    if (typeof node !== 'object' || node == null || !(part in node)) return null
    node = node[part]
  }
  return typeof node === 'string' ? node : null
}

function fill(template: string, vars?: Vars): string {
  if (!vars) return template
  return template.replace(/\{(\w+)\}/g, (_, name: string) =>
    vars[name] == null ? '' : String(vars[name]),
  )
}

const catalogs: Record<Locale, Tree> = { en, hi, te, gu }

export function translate(locale: Locale, key: string, vars?: Vars): string {
  const raw = lookup(catalogs[locale], key) ?? lookup(catalogs.en, key) ?? key
  return fill(raw, vars)
}

/** Current locale. English until LocaleProvider binds another. */
export function t(key: string, vars?: Vars): string {
  return translate(activeLocale, key, vars)
}

export function formatLongDate(locale: Locale, date = new Date()): string {
  return date.toLocaleDateString(localeTag(locale), {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  })
}

export function localeTag(locale: Locale): string {
  return LOCALE_TAGS[locale]
}
