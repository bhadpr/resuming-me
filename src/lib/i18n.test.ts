import { afterEach, describe, expect, it, vi } from 'vitest'
import { hasSavedLocale, persistLocale, translate } from './i18n'

function memoryStorage() {
  const store = new Map<string, string>()
  const storage = {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, String(value))
    },
    removeItem: (key: string) => {
      store.delete(key)
    },
    clear: () => store.clear(),
    get length() {
      return store.size
    },
    key: (index: number) => [...store.keys()][index] ?? null,
  }
  vi.stubGlobal('localStorage', storage)
  vi.stubGlobal('window', { localStorage: storage, navigator: { language: 'en-US' } })
  vi.stubGlobal('document', { documentElement: { lang: 'en' } })
  return storage
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('hasSavedLocale', () => {
  it('is false until a language is saved', () => {
    memoryStorage()
    expect(hasSavedLocale()).toBe(false)
    persistLocale('hi')
    expect(hasSavedLocale()).toBe(true)
  })
})

describe('language.choose', () => {
  it('asks once, in English', () => {
    expect(translate('en', 'language.choose')).toBe(
      "As a first step, let's choose your preferred Language.",
    )
    expect(translate('en', 'language.later')).toBe('You can change this later in Settings.')
    expect(translate('en', 'landing.tagline')).toBe('Get back to what you put off.')
  })

  it('names Marathi and Tamil in their own scripts', () => {
    expect(translate('mr', 'language.marathi')).toBe('मराठी')
    expect(translate('ta', 'language.tamil')).toBe('தமிழ்')
  })
})
