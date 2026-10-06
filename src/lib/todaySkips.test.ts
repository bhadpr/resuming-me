import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { todayLocalDate } from './dates'
import { isSkippedOn, skipOn, unskipOn } from './todaySkips'

beforeEach(() => {
  const store = new Map<string, string>()
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => store.set(key, String(value)),
    removeItem: (key: string) => store.delete(key),
  })
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('todaySkips', () => {
  it('remembers a skip for that day only', () => {
    const today = todayLocalDate()
    skipOn('vital:a', today)
    expect(isSkippedOn('vital:a', today)).toBe(true)
    expect(isSkippedOn('vital:b', today)).toBe(false)
    expect(isSkippedOn('vital:a', '2000-01-01')).toBe(false)
  })

  it('clears a skip', () => {
    const today = todayLocalDate()
    skipOn('reminder:r1', today)
    unskipOn('reminder:r1', today)
    expect(isSkippedOn('reminder:r1', today)).toBe(false)
  })
})
