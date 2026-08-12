import { describe, it, expect } from 'vitest'
import {
  computeElapsedSeconds,
  formatDuration,
  isTimerTargetMet,
  sumSessionSeconds,
} from './timer'
import type { Activity } from './activities'
import type { LogEntry } from './logs'
import { buildTodayProgress } from './today'

function activity(overrides: Partial<Activity> = {}): Activity {
  return {
    id: 'read',
    user_id: 'u1',
    name: 'Read',
    emoji: '📚',
    type: 'daily',
    tracking_mode: 'timer',
    target_value: 10,
    target_unit: 'minutes',
    target_effective_from: '2026-08-01',
    weekly_target: null,
    deadline: null,
    micro_steps: [],
    archived: false,
    created_at: '2026-08-01T00:00:00Z',
    updated_at: '2026-08-01T00:00:00Z',
    ...overrides,
  }
}

function session(overrides: Partial<LogEntry>): LogEntry {
  return {
    id: 's1',
    activity_id: 'read',
    user_id: 'u1',
    type: 'session',
    source: 'timer',
    started_at: '2026-08-11T10:00:00Z',
    duration_seconds: 300,
    date: '2026-08-11',
    note: null,
    created_at: '2026-08-11T10:05:00Z',
    updated_at: null,
    ...overrides,
  }
}

describe('timer math', () => {
  it('sums multiple sessions on the same day', () => {
    const total = sumSessionSeconds(
      [
        session({ id: '1', duration_seconds: 300 }),
        session({ id: '2', duration_seconds: 360 }),
      ],
      'read',
      '2026-08-11',
      '2026-08-11',
    )
    expect(total).toBe(660)
    expect(isTimerTargetMet(total, activity())).toBe(true)
  })

  it('computes elapsed across pause/resume segments', () => {
    const started = '2026-08-11T10:00:00.000Z'
    const now = Date.parse('2026-08-11T10:00:30.000Z')
    expect(
      computeElapsedSeconds({
        status: 'running',
        accumulatedSeconds: 120,
        segmentStartedAt: started,
        nowMs: now,
      }),
    ).toBe(150)
  })

  it('formats durations', () => {
    expect(formatDuration(65)).toBe('1:05')
    expect(formatDuration(3661)).toBe('1:01:01')
  })
})

describe('buildTodayProgress timer', () => {
  it('marks daily timer done when summed sessions meet target', () => {
    const rows = buildTodayProgress(
      [activity()],
      [
        session({ id: '1', duration_seconds: 300 }),
        session({ id: '2', duration_seconds: 360 }),
      ],
      [],
      '2026-08-11',
    )
    expect(rows[0].done).toBe(true)
    expect(rows[0].current).toBe(660)
    expect(rows[0].target).toBe(600)
  })
})
