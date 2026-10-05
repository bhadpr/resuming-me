import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  DEFAULT_STEP_GOAL,
  formatStepCount,
  isDailyStepsMetric,
  loadStepGoal,
  loadTypedSteps,
  parseStepAmount,
  parseStepGoal,
  saveStepGoal,
  saveTypedSteps,
} from './steps'

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
  vi.stubGlobal('window', { localStorage: storage })
  return storage
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('step amounts', () => {
  it('accepts a whole count and rejects anything else', () => {
    expect(parseStepAmount('4,280')).toBe(4280)
    expect(parseStepAmount('0')).toBe(0)
    expect(parseStepAmount('10.5')).toBeNull()
    expect(parseStepAmount('-1')).toBeNull()
    expect(parseStepAmount('')).toBeNull()
  })

  it('formats with the locale', () => {
    expect(formatStepCount(4280, 'en')).toBe('4,280')
  })
})

describe('daily steps vital', () => {
  it('matches the starter and a steps template', () => {
    expect(isDailyStepsMetric({ name: 'Daily Steps' })).toBe(true)
    expect(isDailyStepsMetric({ name: 'Weight', template_id: 'steps' })).toBe(true)
    expect(isDailyStepsMetric({ name: 'Weight' })).toBe(false)
  })
})

describe('step goal and typed count', () => {
  it('starts at 10,000 and keeps a typed count for the day', () => {
    memoryStorage()
    expect(loadStepGoal()).toBe(DEFAULT_STEP_GOAL)
    saveStepGoal(8000)
    expect(loadStepGoal()).toBe(8000)
    expect(loadTypedSteps('2026-10-02')).toBeNull()
    saveTypedSteps('2026-10-02', 4280)
    expect(loadTypedSteps('2026-10-02')).toBe(4280)
  })
})

describe('parseStepGoal', () => {
  it('takes a whole number of steps, with or without commas', () => {
    expect(parseStepGoal('8000')).toBe(8000)
    expect(parseStepGoal(' 12,000 ')).toBe(12000)
  })

  it('refuses zero, decimals, and words', () => {
    expect(parseStepGoal('0')).toBeNull()
    expect(parseStepGoal('7.5')).toBeNull()
    expect(parseStepGoal('lots')).toBeNull()
    expect(parseStepGoal('')).toBeNull()
  })
})
