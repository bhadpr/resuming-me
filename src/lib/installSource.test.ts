import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('./supabase', () => ({
  isSupabaseConfigured: () => false,
  createSupabaseClient: () => ({}),
}))

import { installSourceFromReferrer, trackInstallSource } from './installSource'
import { playStoreUrl } from './marketing'
import { _peekQueueForTests, _resetTrackStateForTests } from './track'

describe('installSourceFromReferrer', () => {
  it('reads our website and web-app buttons', () => {
    expect(installSourceFromReferrer('utm_source=resuming.me&utm_medium=web&utm_content=landing')).toEqual({
      source: 'resuming.me',
      medium: 'web',
      content: 'landing',
    })
  })

  it('reads a partner link: group as source, member as the content', () => {
    expect(installSourceFromReferrer('utm_source=schoolgroup&utm_medium=play&utm_campaign=member7')).toEqual({
      source: 'schoolgroup',
      medium: 'play',
      content: 'member7',
    })
  })

  it('reads a shared event link without keeping its code', () => {
    expect(installSourceFromReferrer('event=ab12cd')).toEqual({ source: 'shared_event', medium: null, content: null })
  })

  it('reads a shared list link without keeping its code', () => {
    expect(installSourceFromReferrer('list=kyrsme')).toEqual({ source: 'shared_list', medium: null, content: null })
  })

  it('calls an install with no tag direct, and Play\'s own organic tag by its name', () => {
    expect(installSourceFromReferrer('')).toEqual({ source: 'direct', medium: null, content: null })
    expect(installSourceFromReferrer(undefined)).toEqual({ source: 'direct', medium: null, content: null })
    expect(installSourceFromReferrer('utm_source=google-play&utm_medium=organic')).toEqual({
      source: 'google-play',
      medium: 'organic',
      content: null,
    })
  })

  it('keeps only short plain words', () => {
    const result = installSourceFromReferrer(`utm_source=${encodeURIComponent('Ana K <script>')}&utm_content=${'x'.repeat(100)}`)
    expect(result.source).toBe('anakscript')
    expect(result.content).toHaveLength(40)
  })

  it('reads what playStoreUrl sends', () => {
    const referrer = new URL(playStoreUrl('alerts-today')).searchParams.get('referrer')
    expect(installSourceFromReferrer(referrer)).toEqual({
      source: 'resuming.me',
      medium: 'web',
      content: 'alerts-today',
    })
  })
})

describe('trackInstallSource', () => {
  beforeEach(() => {
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
      setTimeout: globalThis.setTimeout.bind(globalThis),
      clearTimeout: globalThis.clearTimeout.bind(globalThis),
    })
    vi.stubGlobal('document', { addEventListener: () => {}, visibilityState: 'visible' })
    vi.stubGlobal('navigator', { onLine: false })
    _resetTrackStateForTests()
  })

  const answer = (referrer: string, ok = true) => () => Promise.resolve({ ok, deviceKey: 'k', referrer })

  it('sends install_attributed once', async () => {
    await trackInstallSource(answer('utm_source=resuming.me&utm_medium=web&utm_content=hero'))
    await trackInstallSource(answer('utm_source=other'))
    const sent = _peekQueueForTests().filter((event) => event.name === 'install_attributed')
    expect(sent).toHaveLength(1)
    expect(sent[0].props).toEqual({ source: 'resuming.me', medium: 'web', content: 'hero' })
  })

  it('waits when Play does not answer, and tries again later', async () => {
    await trackInstallSource(answer('', false))
    await trackInstallSource(() => Promise.resolve(null))
    expect(_peekQueueForTests().filter((event) => event.name === 'install_attributed')).toHaveLength(0)
    await trackInstallSource(answer(''))
    const sent = _peekQueueForTests().filter((event) => event.name === 'install_attributed')
    expect(sent).toHaveLength(1)
    expect(sent[0].props.source).toBe('direct')
  })

  it('never throws when reading fails', async () => {
    await expect(trackInstallSource(() => Promise.reject(new Error('no plugin')))).resolves.toBeUndefined()
  })
})
