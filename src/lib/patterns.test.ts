import { describe, expect, it } from 'vitest'
import type { Activity } from './activities'
import type { LogEntry } from './logs'
import {
  activityGapPattern,
  findPatterns,
  numberLinkPattern,
  patternTextIsCausal,
  restEffectPattern,
  selectPatterns,
  sizeEffectPattern,
  timeOfDayPattern,
  weekdayPattern,
} from './patterns'

function activity(overrides: Partial<Activity> = {}): Activity {
  return {
    id: 'a1',
    user_id: 'u1',
    name: 'Reading',
    emoji: '📖',
    type: 'daily',
    tracking_mode: 'checkbox',
    target_value: null,
    target_unit: null,
    target_effective_from: '2026-07-01',
    weekly_target: null,
    deadline: null,
    why_matters: null,
    usually_when: null,
    micro_steps: [],
    archived: false,
    created_at: '2026-07-01T00:00:00Z',
    updated_at: '2026-07-01T00:00:00Z',
    ...overrides,
  }
}

function done(date: string): LogEntry {
  return {
    id: date,
    activity_id: 'a1',
    user_id: 'u1',
    type: 'completed',
    source: null,
    started_at: null,
    duration_seconds: null,
    date,
    note: null,
    created_at: `${date}T12:00:00Z`,
  }
}

function eachDate(from: string, to: string): string[] {
  const out: string[] = []
  let cursor = from
  while (cursor <= to) {
    out.push(cursor)
    const next = new Date(`${cursor}T12:00:00Z`)
    next.setUTCDate(next.getUTCDate() + 1)
    cursor = next.toISOString().slice(0, 10)
  }
  return out
}

describe('patterns', () => {
  const today = '2026-09-23'

  it('names Sunday when that day is clearly worse', () => {
    const entries = eachDate('2026-07-30', '2026-09-22')
      .filter((date) => new Date(`${date}T12:00:00Z`).getUTCDay() !== 0)
      .map(done)
    const pattern = weekdayPattern([activity()], entries, today)
    expect(pattern?.earlyGuess).toBe(false)
    expect(pattern?.text).toContain('Sundays')
    expect(patternTextIsCausal(pattern?.text ?? '')).toBe(false)
  })

  it('stays quiet when every day looks the same', () => {
    const entries = eachDate('2026-07-30', '2026-09-22').map(done)
    expect(weekdayPattern([activity()], entries, today)).toBeNull()
  })

  it('asks instead of stating a weekday with too little evidence', () => {
    const reading = activity({ created_at: '2026-09-01T00:00:00Z' })
    const entries = eachDate('2026-09-01', '2026-09-22')
      .filter((date) => new Date(`${date}T12:00:00Z`).getUTCDay() !== 0)
      .map(done)
    const pattern = weekdayPattern([reading], entries, today)
    expect(pattern?.earlyGuess).toBe(true)
    expect(pattern?.text).toContain('Early guess')
  })

  it('needs five sessions before stating a time of day', () => {
    expect(timeOfDayPattern([18, 18, 19]).earlyGuess).toBe(true)
    expect(timeOfDayPattern([18, 18, 18, 19, 19])?.text).toContain('evening')
    expect(timeOfDayPattern([8, 9, 14, 15, 20])).toBeNull()
  })

  it('states a sleep link only with enough days and no causal words', () => {
    const days = [
      ...Array.from({ length: 5 }, () => ({ value: 5, showedUp: false })),
      ...Array.from({ length: 5 }, () => ({ value: 8, showedUp: true })),
    ]
    const pattern = numberLinkPattern(days)
    expect(pattern?.text).toMatch(/half as often|less often/)
    expect(patternTextIsCausal(pattern?.text ?? '')).toBe(false)
    expect(numberLinkPattern(days.slice(0, 4))).toBeNull()
  })

  it('needs two targets before talking about size', () => {
    const same = Array.from({ length: 12 }, () => ({ target: 10, showedUp: true }))
    expect(sizeEffectPattern(same)).toBeNull()
    const mixed = [
      ...Array.from({ length: 6 }, () => ({ target: 2, showedUp: true })),
      ...Array.from({ length: 6 }, () => ({ target: 20, showedUp: false })),
    ]
    expect(sizeEffectPattern(mixed)?.kind).toBe('sizeEffect')
  })

  it('compares the day after rest once there are eight rest days', () => {
    const days = [
      ...Array.from({ length: 8 }, () => ({ afterRest: true, showedUp: true })),
      ...Array.from({ length: 8 }, () => ({ afterRest: false, showedUp: false })),
    ]
    expect(restEffectPattern(days)?.text).toContain('more often')
    expect(restEffectPattern(days.slice(0, 4))).toBeNull()
  })

  it('keeps an activity gap with any evidence and shows at most two', () => {
    expect(activityGapPattern([{ activityId: 'a1', name: 'Reading', quietDays: 9 }])?.text).toBe(
      'Reading has been quiet for 9 days.',
    )
    const patterns = findPatterns({
      activities: [activity()],
      entries: [],
      today,
      slipAnswer: 'Evenings',
    })
    expect(patterns.length).toBeLessThanOrEqual(2)
    expect(patterns.some((pattern) => pattern.kind === 'slip')).toBe(false)
    expect(patterns.every((pattern) => !patternTextIsCausal(pattern.text))).toBe(true)
    expect(selectPatterns([
      { kind: 'slip', text: 'guess', confidence: 1, evidenceCount: 0, earlyGuess: true },
    ])).toHaveLength(1)
  })
})
