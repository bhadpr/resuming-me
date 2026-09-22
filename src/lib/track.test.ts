import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  _peekQueueForTests,
  _resetTrackStateForTests,
  comebackGapDays,
  sanitizeEventProps,
  smallerChoiceProp,
  track,
} from './track'

function installMemoryStorage() {
  const store = new Map<string, string>()
  const storage = {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, String(value))
    },
    removeItem: (key: string) => {
      store.delete(key)
    },
    clear: () => {
      store.clear()
    },
    get length() {
      return store.size
    },
    key: (index: number) => [...store.keys()][index] ?? null,
  }
  vi.stubGlobal('localStorage', storage)
  vi.stubGlobal('window', {
    localStorage: storage,
    location: { pathname: '/today' },
    addEventListener: () => {},
    setTimeout: globalThis.setTimeout.bind(globalThis),
    clearTimeout: globalThis.clearTimeout.bind(globalThis),
  })
  vi.stubGlobal('document', {
    addEventListener: () => {},
    visibilityState: 'visible',
  })
  vi.stubGlobal('navigator', { onLine: false })
  return storage
}

describe('smallerChoiceProp', () => {
  it('maps minutes to safe enums', () => {
    expect(smallerChoiceProp(2)).toBe('2_min')
    expect(smallerChoiceProp(1)).toBe('1_min')
    expect(smallerChoiceProp(null)).toBe('just_started')
  })
})

describe('comebackGapDays', () => {
  it('returns null under threshold', () => {
    expect(comebackGapDays('2026-09-20', '2026-09-22', 3)).toBeNull()
    expect(comebackGapDays('2026-09-21', '2026-09-22', 3)).toBeNull()
  })

  it('returns gap when 3+ days', () => {
    expect(comebackGapDays('2026-09-19', '2026-09-22', 3)).toBe(3)
    expect(comebackGapDays('2026-09-10', '2026-09-22', 3)).toBe(12)
  })

  it('returns null without a prior win', () => {
    expect(comebackGapDays(null, '2026-09-22')).toBeNull()
  })
})

describe('sanitizeEventProps', () => {
  it('strips personal text keys and keeps safe scalars', () => {
    expect(
      sanitizeEventProps({
        kind: 'session',
        minutes: 2,
        name: 'Meditate',
        notes: 'secret',
        title: 'nope',
      }),
    ).toEqual({ kind: 'session', minutes: 2 })
  })
})

describe('track queue', () => {
  let storage: ReturnType<typeof installMemoryStorage>

  beforeEach(() => {
    storage = installMemoryStorage()
    _resetTrackStateForTests()
  })

  afterEach(() => {
    _resetTrackStateForTests()
    vi.unstubAllGlobals()
  })

  it('queues events offline without names/notes and persists them', () => {
    track('log_created', {
      activity_type: 'daily',
      kind: 'session',
      minutes: 2,
      was_partial: true,
      name: 'Meditate',
      note: 'secret',
    })

    const queued = _peekQueueForTests()
    expect(queued.length).toBeGreaterThanOrEqual(1)
    const log = queued.find((e) => e.name === 'log_created')
    expect(log).toBeTruthy()
    expect(log!.props).toEqual({
      activity_type: 'daily',
      kind: 'session',
      minutes: 2,
      was_partial: true,
    })
    expect(log!.props).not.toHaveProperty('name')
    expect(log!.props).not.toHaveProperty('note')

    const raw = storage.getItem('resuming.offlineEventsQueue')
    expect(raw).toBeTruthy()
    expect(JSON.parse(raw!).some((e: { name: string }) => e.name === 'log_created')).toBe(
      true,
    )
  })

  it('keeps skip_today reason as a chip enum, not free text activity name', () => {
    track('skip_today', { reason: 'too_tired', name: 'Walk' })
    const skip = _peekQueueForTests().find((e) => e.name === 'skip_today')
    expect(skip?.props).toEqual({ reason: 'too_tired' })
  })
})
