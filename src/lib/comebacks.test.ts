import { describe, it, expect } from 'vitest'
import { countComebacks } from './comebacks'
import type { Activity } from './activities'
import type { LogEntry } from './logs'

function activity(overrides: Partial<Activity> = {}): Activity {
  return {
    id: 'a1',
    user_id: 'u1',
    name: 'Walk',
    emoji: '🚶',
    type: 'daily',
    tracking_mode: 'checkbox',
    target_value: null,
    target_unit: null,
    target_effective_from: '2026-08-01',
    weekly_target: null,
    deadline: null,
    why_matters: null,
    usually_when: null,
    micro_steps: [],
    archived: false,
    created_at: '2026-08-01T00:00:00Z',
    updated_at: '2026-08-01T00:00:00Z',
    ...overrides,
  }
}

function completed(date: string, id = date): LogEntry {
  return {
    id,
    activity_id: 'a1',
    user_id: 'u1',
    type: 'completed',
    source: null,
    started_at: null,
    duration_seconds: null,
    date,
    note: null,
    created_at: `${date}T12:00:00Z`,
    updated_at: null,
  }
}

function session(date: string, seconds: number): LogEntry {
  return {
    id: `s-${date}-${seconds}`,
    activity_id: 'a1',
    user_id: 'u1',
    type: 'session',
    source: 'timer',
    started_at: null,
    duration_seconds: seconds,
    date,
    note: null,
    created_at: `${date}T12:00:00Z`,
    updated_at: null,
  }
}

describe('countComebacks', () => {
  it('counts show-up after 2+ missed days in the window', () => {
    // Created Aug 8; missed 8–9; done 10 → comeback. Done 11 is continuation.
    const n = countComebacks(
      activity({ created_at: '2026-08-08T00:00:00Z' }),
      [completed('2026-08-10'), completed('2026-08-11')],
      '2026-08-11',
      30,
    )
    expect(n).toBe(1)
  })

  it('does not count after only one missed day', () => {
    const n = countComebacks(
      activity({ created_at: '2026-08-09T00:00:00Z' }),
      [completed('2026-08-09'), completed('2026-08-11')],
      '2026-08-11',
      30,
    )
    // Day 9 first show-up (0 missed before). Day 11 after only one miss → 0.
    expect(n).toBe(0)
  })

  it('counts partial sessions as show-up', () => {
    const timer = activity({
      tracking_mode: 'timer',
      target_value: 10,
      target_unit: 'minutes',
      created_at: '2026-08-08T00:00:00Z',
    })
    const n = countComebacks(
      timer,
      [session('2026-08-10', 120)],
      '2026-08-10',
      30,
    )
    expect(n).toBe(1)
  })

  it('returns 0 for deadline activities', () => {
    expect(
      countComebacks(
        activity({ type: 'deadline', deadline: '2026-09-01' }),
        [completed('2026-08-10')],
        '2026-08-11',
      ),
    ).toBe(0)
  })
})
