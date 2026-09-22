import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  TODAY_CACHE_KEY,
  clearTodayCache,
  readTodayCache,
  writeTodayCache,
  type TodayCachePayload,
} from './todayCache'

function basePayload(
  overrides: Partial<TodayCachePayload> = {},
): TodayCachePayload {
  return {
    userId: 'user-1',
    date: '2026-09-22',
    activities: [],
    metrics: [],
    logEntries: [],
    postponedEntries: [],
    metricEntriesToday: [],
    savedAt: '2026-09-22T10:00:00.000Z',
    ...overrides,
  }
}

describe('todayCache', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('returns null when localStorage is unavailable', () => {
    vi.stubGlobal('window', undefined)
    expect(readTodayCache('user-1', '2026-09-22')).toBeNull()
  })

  it('round-trips a matching payload', () => {
    const store = new Map<string, string>()
    vi.stubGlobal('window', {
      localStorage: {
        getItem: (k: string) => store.get(k) ?? null,
        setItem: (k: string, v: string) => {
          store.set(k, v)
        },
        removeItem: (k: string) => {
          store.delete(k)
        },
      },
    })

    writeTodayCache(basePayload())
    const read = readTodayCache('user-1', '2026-09-22')
    expect(read?.userId).toBe('user-1')
    expect(read?.date).toBe('2026-09-22')
    expect(store.has(TODAY_CACHE_KEY)).toBe(true)
  })

  it('rejects cache for a different user or date', () => {
    const store = new Map<string, string>()
    vi.stubGlobal('window', {
      localStorage: {
        getItem: (k: string) => store.get(k) ?? null,
        setItem: (k: string, v: string) => {
          store.set(k, v)
        },
        removeItem: (k: string) => {
          store.delete(k)
        },
      },
    })

    writeTodayCache(basePayload())
    expect(readTodayCache('other', '2026-09-22')).toBeNull()
    expect(readTodayCache('user-1', '2026-09-21')).toBeNull()
  })

  it('clearTodayCache removes the key', () => {
    const store = new Map<string, string>()
    vi.stubGlobal('window', {
      localStorage: {
        getItem: (k: string) => store.get(k) ?? null,
        setItem: (k: string, v: string) => {
          store.set(k, v)
        },
        removeItem: (k: string) => {
          store.delete(k)
        },
      },
    })

    writeTodayCache(basePayload())
    clearTodayCache()
    expect(store.has(TODAY_CACHE_KEY)).toBe(false)
  })
})
