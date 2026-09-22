import { describe, it, expect } from 'vitest'
import { buildActivityHistory, formatQuietRange } from './activityHistory'
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
    micro_steps: [],
    archived: false,
    created_at: '2026-08-20T00:00:00Z',
    updated_at: '2026-08-20T00:00:00Z',
    ...overrides,
  }
}

function completed(date: string): LogEntry {
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
    updated_at: null,
  }
}

function autoPostponed(date: string): LogEntry {
  return {
    ...completed(date),
    id: `p-${date}`,
    type: 'postponed',
    source: null,
  }
}

describe('formatQuietRange', () => {
  it('formats a single day and a span', () => {
    expect(formatQuietRange('2026-08-23', '2026-08-23')).toBe('Aug 23 · quiet')
    expect(formatQuietRange('2026-08-23', '2026-09-21')).toBe(
      'Aug 23 – Sep 21 · quiet',
    )
  })
})

describe('buildActivityHistory', () => {
  it('collapses consecutive missed days and groups by month', () => {
    const groups = buildActivityHistory(
      activity({ created_at: '2026-08-23T00:00:00Z' }),
      [completed('2026-09-22'), autoPostponed('2026-09-01')],
      '2026-09-22',
    )

    expect(groups.map((g) => g.monthKey)).toEqual(['2026-09'])
    const sep = groups[0]
    expect(sep.monthLabel).toBe('September 2026')
    expect(sep.rows[0]).toMatchObject({
      kind: 'entry',
      entry: { date: '2026-09-22' },
    })
    expect(sep.rows[1]).toMatchObject({
      kind: 'quiet',
      from: '2026-08-23',
      to: '2026-09-21',
    })
    expect(
      sep.rows.every(
        (r) => r.kind !== 'entry' || r.entry.type !== 'postponed',
      ),
    ).toBe(true)
  })

  it('keeps sticky month groups when quiet does not cross', () => {
    const groups = buildActivityHistory(
      activity({ created_at: '2026-09-01T00:00:00Z' }),
      [completed('2026-09-05')],
      '2026-09-05',
    )
    expect(groups).toHaveLength(1)
    expect(groups[0].monthLabel).toBe('September 2026')
    expect(groups[0].rows).toHaveLength(2)
    expect(groups[0].rows[1]).toMatchObject({
      kind: 'quiet',
      from: '2026-09-01',
      to: '2026-09-04',
    })
  })
})
