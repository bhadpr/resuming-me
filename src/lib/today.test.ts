import { describe, it, expect } from 'vitest'
import { buildTodayProgress, completedCountInWindow, shouldShowDeadlineOnToday } from './today'
import { startOfWeekMonday, endOfWeekSunday, daysBetween } from './dates'
import type { Activity } from './activities'
import type { LogEntry } from './logs'

function activity(overrides: Partial<Activity>): Activity {
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

function entry(overrides: Partial<LogEntry>): LogEntry {
  return {
    id: 'e1',
    activity_id: 'a1',
    user_id: 'u1',
    type: 'completed',
    source: null,
    started_at: null,
    duration_seconds: null,
    date: '2026-08-11',
    note: null,
    created_at: '2026-08-11T00:00:00Z',
    updated_at: null,
    ...overrides,
  }
}

describe('week helpers', () => {
  it('uses Mon–Sun weeks', () => {
    // 2026-08-11 is a Tuesday
    expect(startOfWeekMonday('2026-08-11')).toBe('2026-08-10')
    expect(endOfWeekSunday('2026-08-11')).toBe('2026-08-16')
  })

  it('computes days between', () => {
    expect(daysBetween('2026-08-11', '2026-08-15')).toBe(4)
    expect(daysBetween('2026-08-15', '2026-08-11')).toBe(-4)
  })
})

describe('completedCountInWindow', () => {
  it('counts completed entries in range', () => {
    const entries = [
      entry({ id: '1', date: '2026-08-10' }),
      entry({ id: '2', date: '2026-08-11' }),
      entry({ id: '3', date: '2026-08-12', type: 'postponed' }),
    ]
    expect(completedCountInWindow(entries, 'a1', '2026-08-10', '2026-08-11')).toHaveLength(2)
  })
})

describe('buildTodayProgress', () => {
  it('marks daily checkbox done when completed today', () => {
    const walk = activity({ id: 'walk', name: 'Walk' })
    const rows = buildTodayProgress(
      [walk],
      [entry({ activity_id: 'walk', date: '2026-08-11' })],
      [],
      '2026-08-11',
    )
    expect(rows).toHaveLength(1)
    expect(rows[0].done).toBe(true)
    expect(rows[0].actionKind).toBe('checkbox')
  })

  it('tracks weekly count toward weekly_target', () => {
    const gym = activity({
      id: 'gym',
      name: 'Gym',
      type: 'weekly_n',
      tracking_mode: 'count',
      weekly_target: 2,
      target_value: 1,
    })
    const rows = buildTodayProgress(
      [gym],
      [
        entry({ id: '1', activity_id: 'gym', date: '2026-08-10' }),
        entry({ id: '2', activity_id: 'gym', date: '2026-08-11' }),
      ],
      [],
      '2026-08-11',
    )
    expect(rows[0].current).toBe(2)
    expect(rows[0].target).toBe(2)
    expect(rows[0].done).toBe(true)
  })

  it('sorts incomplete overdue-feeling activities first', () => {
    const fresh = activity({
      id: 'fresh',
      name: 'Fresh',
      created_at: '2026-08-11T00:00:00Z',
    })
    const stale = activity({
      id: 'stale',
      name: 'Stale',
      created_at: '2026-08-01T00:00:00Z',
    })
    const rows = buildTodayProgress([fresh, stale], [], [], '2026-08-11')
    expect(rows[0].activity.id).toBe('stale')
    expect(rows[1].activity.id).toBe('fresh')
  })

  it('shows completed deadline checkbox until due date', () => {
    const taxes = activity({
      id: 'taxes',
      name: 'Taxes',
      type: 'deadline',
      tracking_mode: 'checkbox',
      deadline: '2026-08-20',
    })
    const rows = buildTodayProgress(
      [taxes],
      [entry({ activity_id: 'taxes', date: '2026-08-10' })],
      [],
      '2026-08-11',
    )
    expect(rows).toHaveLength(1)
    expect(rows[0].done).toBe(true)
    expect(rows[0].actionKind).toBe('checkbox')
    expect(rows[0].progressLabel).toBe('Completed · 9d until due')
  })

  it('hides completed deadlines after due date passes', () => {
    const taxes = activity({
      id: 'taxes',
      name: 'Taxes',
      type: 'deadline',
      tracking_mode: 'checkbox',
      deadline: '2026-08-10',
    })
    const rows = buildTodayProgress(
      [taxes],
      [entry({ activity_id: 'taxes', date: '2026-08-08' })],
      [],
      '2026-08-11',
    )
    expect(rows).toHaveLength(0)
  })

  it('shouldShowDeadlineOnToday keeps done tasks visible through due date', () => {
    const taxes = activity({
      type: 'deadline',
      tracking_mode: 'checkbox',
      deadline: '2026-08-20',
    })
    expect(shouldShowDeadlineOnToday(taxes, true, '2026-08-11')).toBe(true)
    expect(shouldShowDeadlineOnToday(taxes, true, '2026-08-20')).toBe(true)
    expect(shouldShowDeadlineOnToday(taxes, true, '2026-08-21')).toBe(false)
  })
})
