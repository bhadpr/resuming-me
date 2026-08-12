import { describe, it, expect } from 'vitest'
import {
  computeActivityStats,
  computeCurrentStreak,
  computeMetricTrendStats,
} from './stats'
import type { Activity } from './activities'
import type { LogEntry } from './logs'
import type { MetricEntry } from './metricEntries'

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

function postponed(date: string): LogEntry {
  return {
    ...completed(date, `p-${date}`),
    type: 'postponed',
  }
}

describe('computeCurrentStreak', () => {
  it('counts consecutive completed days ending today', () => {
    const streak = computeCurrentStreak(
      activity(),
      [completed('2026-08-09'), completed('2026-08-10'), completed('2026-08-11')],
      '2026-08-11',
    )
    expect(streak).toBe(3)
  })

  it('breaks on postponed day', () => {
    const streak = computeCurrentStreak(
      activity(),
      [completed('2026-08-09'), postponed('2026-08-10'), completed('2026-08-11')],
      '2026-08-11',
    )
    expect(streak).toBe(1)
  })
})

describe('computeActivityStats', () => {
  it('counts postponements and average session length', () => {
    const timer = activity({
      tracking_mode: 'timer',
      target_value: 10,
      target_unit: 'minutes',
    })
    const entries: LogEntry[] = [
      postponed('2026-08-01'),
      postponed('2026-08-10'),
      {
        id: 's1',
        activity_id: 'a1',
        user_id: 'u1',
        type: 'session',
        source: 'timer',
        started_at: null,
        duration_seconds: 300,
        date: '2026-08-11',
        note: null,
        created_at: '2026-08-11T12:00:00Z',
        updated_at: null,
      },
      {
        id: 's2',
        activity_id: 'a1',
        user_id: 'u1',
        type: 'session',
        source: 'timer',
        started_at: null,
        duration_seconds: 600,
        date: '2026-08-11',
        note: null,
        created_at: '2026-08-11T13:00:00Z',
        updated_at: null,
      },
    ]
    const stats = computeActivityStats(timer, entries, '2026-08-11')
    expect(stats.postponementsAllTime).toBe(2)
    expect(stats.postponementsLast30).toBe(2)
    expect(stats.averageSessionSeconds).toBe(450)
    expect(stats.sessionCount).toBe(2)
  })
})

describe('computeMetricTrendStats', () => {
  it('computes min/max/avg/delta for window', () => {
    const entries: MetricEntry[] = [
      {
        id: '1',
        metric_id: 'm1',
        user_id: 'u1',
        date: '2026-08-05',
        value: 180,
        created_at: '',
        updated_at: '',
      },
      {
        id: '2',
        metric_id: 'm1',
        user_id: 'u1',
        date: '2026-08-11',
        value: 178,
        created_at: '',
        updated_at: '',
      },
    ]
    const stats = computeMetricTrendStats(entries, 30, '2026-08-11')
    expect(stats.min).toBe(178)
    expect(stats.max).toBe(180)
    expect(stats.avg).toBe(179)
    expect(stats.delta).toBe(-2)
  })
})
