import { describe, it, expect } from 'vitest'
import {
  buildTodayProgress,
  completedCountInWindow,
  pickHeroRow,
  partitionTodayRows,
  shouldShowDeadlineOnToday,
  todayEmptyKind,
} from './today'
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

  it('tracks twice-a-day count toward the daily target', () => {
    const kids = activity({
      id: 'kids',
      name: 'Play with kids',
      tracking_mode: 'count',
      target_value: 2,
    })
    const one = buildTodayProgress(
      [kids],
      [entry({ id: '1', activity_id: 'kids', date: '2026-08-11' })],
      [],
      '2026-08-11',
    )
    expect(one[0].current).toBe(1)
    expect(one[0].done).toBe(false)
    const two = buildTodayProgress(
      [kids],
      [
        entry({ id: '1', activity_id: 'kids', date: '2026-08-11' }),
        entry({ id: '2', activity_id: 'kids', date: '2026-08-11' }),
      ],
      [],
      '2026-08-11',
    )
    expect(two[0].done).toBe(true)
  })

  it('tracks monthly checkbox through the calendar month', () => {
    const bills = activity({
      id: 'bills',
      name: 'Pay bills',
      type: 'monthly',
      tracking_mode: 'checkbox',
    })
    const open = buildTodayProgress([bills], [], [], '2026-08-17')
    expect(open[0].done).toBe(false)
    expect(open[0].progressLabel).toBe('Not yet this month')
    const done = buildTodayProgress(
      [bills],
      [entry({ activity_id: 'bills', date: '2026-08-03' })],
      [],
      '2026-08-17',
    )
    expect(done[0].done).toBe(true)
    expect(done[0].progressLabel).toBe('Done this month')
  })

  it('preserves activity order when some are completed', () => {
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
    const rows = buildTodayProgress(
      [fresh, stale],
      [entry({ activity_id: 'fresh', date: '2026-08-11' })],
      [],
      '2026-08-11',
    )
    expect(rows.map((r) => r.activity.id)).toEqual(['fresh', 'stale'])
    expect(rows[0].done).toBe(true)
    expect(rows[1].done).toBe(false)
  })

  it('keeps completed activities in place instead of moving them to the end', () => {
    const alpha = activity({ id: 'alpha', name: 'Alpha' })
    const beta = activity({ id: 'beta', name: 'Beta' })
    const rows = buildTodayProgress(
      [alpha, beta],
      [entry({ activity_id: 'alpha', date: '2026-08-11' })],
      [],
      '2026-08-11',
    )
    expect(rows.map((r) => r.activity.id)).toEqual(['alpha', 'beta'])
    expect(rows[0].done).toBe(true)
    expect(rows[1].done).toBe(false)
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

describe('pickHeroRow', () => {
  const walk = activity({ id: 'walk', name: 'Walk' })
  const read = activity({
    id: 'read',
    name: 'Reading',
    tracking_mode: 'timer',
    target_value: 10,
    target_unit: 'minutes',
  })
  const taxes = activity({
    id: 'taxes',
    name: 'Taxes',
    type: 'deadline',
    tracking_mode: 'checkbox',
    deadline: '2026-08-01',
  })

  it('prefers a running timer', () => {
    const rows = buildTodayProgress([walk, read], [], [], '2026-08-11')
    expect(pickHeroRow(rows, 'read')?.activity.id).toBe('read')
  })

  it('prefers an overdue deadline over an open walk', () => {
    const rows = buildTodayProgress([walk, taxes], [], [], '2026-08-11')
    expect(pickHeroRow(rows, null)?.activity.id).toBe('taxes')
  })

  it('prefers a recently postponed activity', () => {
    const rows = buildTodayProgress(
      [walk, read],
      [],
      [entry({ activity_id: 'read', type: 'postponed', date: '2026-08-10' })],
      '2026-08-11',
    )
    expect(pickHeroRow(rows, null)?.activity.id).toBe('read')
    expect(rows.find((r) => r.activity.id === 'read')?.recentlyPostponed).toBe(true)
  })
})

describe('todayEmptyKind', () => {
  it('asks to get started when there are no activities', () => {
    expect(todayEmptyKind({ hasActivities: false, dueCount: 0 })).toBe('setup')
  })

  it('is a quiet clear day when activities exist but nothing is due', () => {
    expect(todayEmptyKind({ hasActivities: true, dueCount: 0 })).toBe('clear')
  })

  it('is not empty when something is due', () => {
    expect(todayEmptyKind({ hasActivities: true, dueCount: 2 })).toBeNull()
    expect(todayEmptyKind({ hasActivities: false, dueCount: 1 })).toBeNull()
  })
})

describe('partitionTodayRows', () => {
  it('splits hero, also due, and done', () => {
    const walk = activity({ id: 'walk', name: 'Walk' })
    const read = activity({ id: 'read', name: 'Reading' })
    const rows = buildTodayProgress(
      [walk, read],
      [entry({ activity_id: 'walk', date: '2026-08-11' })],
      [],
      '2026-08-11',
    )
    const parts = partitionTodayRows(rows, null)
    expect(parts.hero?.activity.id).toBe('read')
    expect(parts.done.map((r) => r.activity.id)).toEqual(['walk'])
    expect(parts.alsoDue).toEqual([])
  })

  it('can prefer a suggested hero during re-entry', () => {
    const walk = activity({ id: 'walk', name: 'Walk' })
    const read = activity({
      id: 'read',
      name: 'Reading',
      tracking_mode: 'timer',
      target_value: 10,
      target_unit: 'min',
    })
    const rows = buildTodayProgress([walk, read], [], [], '2026-08-11')
    const parts = partitionTodayRows(rows, null, 'read')
    expect(parts.hero?.activity.id).toBe('read')
    expect(parts.alsoDue.map((r) => r.activity.id)).toEqual(['walk'])
  })
})
