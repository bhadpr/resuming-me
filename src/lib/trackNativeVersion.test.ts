import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const insert = vi.fn()
vi.mock('./supabase', () => ({
  isSupabaseConfigured: () => true,
  createSupabaseClient: () => ({
    auth: { getSession: async () => ({ data: { session: null } }) },
    from: () => ({ insert }),
  }),
}))
vi.mock('@capacitor/core', () => ({
  Capacitor: { isNativePlatform: () => true, getPlatform: () => 'android' },
}))
vi.mock('@capacitor/app', () => ({
  App: { getInfo: async () => ({ version: '1.0.4', build: '7' }) },
}))

import { _resetTrackStateForTests, flushEvents, track } from './track'

function installMemoryStorage() {
  const store = new Map<string, string>()
  const storage = {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => void store.set(key, String(value)),
    removeItem: (key: string) => void store.delete(key),
  }
  vi.stubGlobal('localStorage', storage)
  vi.stubGlobal('window', {
    localStorage: storage,
    location: { pathname: '/today' },
    addEventListener: () => {},
  })
  vi.stubGlobal('document', { addEventListener: () => {}, visibilityState: 'visible' })
  vi.stubGlobal('navigator', { onLine: true })
}

describe('android app version', () => {
  beforeEach(() => {
    installMemoryStorage()
    _resetTrackStateForTests()
    insert.mockReset()
    insert.mockResolvedValue({ error: null })
  })

  afterEach(() => {
    _resetTrackStateForTests()
    vi.unstubAllGlobals()
  })

  it('sends the store version, even for events tracked before it was read', async () => {
    track('log_created')
    await flushEvents()
    const rows = insert.mock.calls.flatMap((call) => call[0] as { app_version: string; platform: string }[])
    expect(rows.length).toBeGreaterThan(0)
    expect(rows.every((row) => row.app_version === '1.0.4+7')).toBe(true)
    expect(rows.every((row) => row.platform === 'android')).toBe(true)
  })
})
