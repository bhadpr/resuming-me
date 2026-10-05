import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const upsert = vi.fn()
vi.mock('./supabase', () => ({
  isSupabaseConfigured: () => true,
  createSupabaseClient: () => ({
    auth: {
      getSession: async () => ({ data: { session: { user: { id: 'user-1' } } } }),
    },
    from: () => ({ upsert }),
  }),
}))

import {
  _peekQueueForTests,
  _resetTrackStateForTests,
  comebackGapDays,
  flushEvents,
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

describe('flushEvents', () => {
  beforeEach(() => {
    installMemoryStorage()
    vi.stubGlobal('navigator', { onLine: true })
    _resetTrackStateForTests()
    upsert.mockReset()
  })

  afterEach(() => {
    _resetTrackStateForTests()
    vi.unstubAllGlobals()
  })

  it('skips ids the server already has and clears the queue', async () => {
    upsert.mockResolvedValue({ error: null })
    track('log_created')
    await flushEvents()
    expect(upsert).toHaveBeenCalledWith(expect.any(Array), {
      onConflict: 'id',
      ignoreDuplicates: true,
    })
    expect(_peekQueueForTests()).toEqual([])
  })

  it('keeps the queue on network or server errors', async () => {
    upsert.mockResolvedValue({ error: { code: 'PGRST301', message: 'jwt expired' } })
    track('log_created')
    await flushEvents()
    expect(_peekQueueForTests().some((e) => e.name === 'log_created')).toBe(true)
  })

  it('drops a batch the database rejects so it cannot block later events', async () => {
    upsert.mockResolvedValue({ error: { code: '23514', message: 'check violation' } })
    track('log_created')
    await flushEvents()
    expect(_peekQueueForTests()).toEqual([])
  })

  it('resends without the user when the account no longer exists', async () => {
    upsert
      .mockResolvedValueOnce({ error: { code: '23503', message: 'fk violation' } })
      .mockResolvedValueOnce({ error: null })
    track('log_created')
    await flushEvents()
    expect(upsert.mock.calls[0][0][0].user_id).toBe('user-1')
    expect(upsert.mock.calls[1][0][0].user_id).toBeNull()
    expect(_peekQueueForTests()).toEqual([])
  })

  it('keeps events tracked while a flush is in flight', async () => {
    let finish: (v: { error: null }) => void = () => {}
    upsert.mockReturnValue(new Promise((resolve) => (finish = resolve)))
    track('log_created')
    const flushing = flushEvents()
    await Promise.resolve()
    track('skip_today')
    finish({ error: null })
    await flushing
    expect(_peekQueueForTests().map((e) => e.name)).toEqual(['skip_today'])
  })
})
