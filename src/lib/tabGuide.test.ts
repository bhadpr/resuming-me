import { afterEach, describe, expect, it } from 'vitest'
import {
  TAB_GUIDE_DISMISS_KEY,
  TAB_GUIDE_SHOW_TIMES,
  TAB_GUIDE_VISITS_KEY,
  _resetTabGuideForTests,
  dismissTabGuide,
  recordTabGuideVisit,
  tabGuideDismissed,
} from './tabGuide'

function memoryStore(): Storage {
  const data = new Map<string, string>()
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => {
      data.set(key, String(value))
    },
    removeItem: (key: string) => {
      data.delete(key)
    },
    clear: () => {
      data.clear()
    },
    key: (index: number) => [...data.keys()][index] ?? null,
    get length() {
      return data.size
    },
  }
}

afterEach(() => {
  _resetTabGuideForTests()
})

describe('tab guide visits', () => {
  it('shows until the third visit, then hides', () => {
    const store = memoryStore()
    expect(tabGuideDismissed(store)).toBe(false)
    expect(recordTabGuideVisit(store, 1_000)).toBe(1)
    expect(tabGuideDismissed(store)).toBe(false)
    _resetTabGuideForTests()
    expect(recordTabGuideVisit(store, 10_000)).toBe(2)
    expect(tabGuideDismissed(store)).toBe(false)
    _resetTabGuideForTests()
    expect(recordTabGuideVisit(store, 20_000)).toBe(TAB_GUIDE_SHOW_TIMES)
    expect(store.getItem(TAB_GUIDE_DISMISS_KEY)).toBe('1')
    expect(tabGuideDismissed(store)).toBe(true)
  })

  it('does not count a remount a moment later', () => {
    const store = memoryStore()
    expect(recordTabGuideVisit(store, 1_000)).toBe(1)
    expect(recordTabGuideVisit(store, 1_400)).toBe(1)
    expect(store.getItem(TAB_GUIDE_VISITS_KEY)).toBe('1')
  })

  it('stays hidden after Got it', () => {
    const store = memoryStore()
    dismissTabGuide(store)
    expect(tabGuideDismissed(store)).toBe(true)
    expect(recordTabGuideVisit(store, 1_000)).toBe(0)
    expect(store.getItem(TAB_GUIDE_VISITS_KEY)).toBeNull()
  })
})
