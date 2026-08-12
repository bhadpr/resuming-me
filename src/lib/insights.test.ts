import { describe, it, expect } from 'vitest'
import {
  buildActivityInsightSeries,
  computeInsights,
  formatPercent,
} from './insights'
import type { Activity } from './activities'
import type { LogEntry } from './logs'

function activity(overrides: Partial<Activity> = {}): Activity {
  return {
    id: 'walk',
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
    activity_id: 'walk',
    user_id: 'u1',
    type: 'completed',
    source: null,
    started_at: null,
    duration_seconds: null,
    date: '2026-08-10',
    note: null,
    created_at: '2026-08-10T18:00:00Z',
    updated_at: null,
    ...overrides,
  }
}

describe('computeInsights', () => {
  it('computes postponement rate for the week window', () => {
    const walk = activity()
    const gym = activity({
      id: 'gym',
      name: 'Gym',
      emoji: '🏋️',
      type: 'weekly_n',
      tracking_mode: 'count',
      weekly_target: 2,
      target_value: 1,
    })

    // Week ending 2026-08-11 (Tue): dates Aug 5–11
    const entries: LogEntry[] = [
      entry({ id: '1', date: '2026-08-10', type: 'completed' }),
      entry({ id: '2', date: '2026-08-09', type: 'postponed' }),
      entry({ id: '3', date: '2026-08-08', type: 'postponed' }),
      entry({
        id: '4',
        activity_id: 'gym',
        date: '2026-08-10',
        type: 'completed',
      }),
    ]

    const result = computeInsights([walk, gym], entries, 'week', '2026-08-11')
    expect(result.from).toBe('2026-08-05')
    expect(result.to).toBe('2026-08-11')

    const walkInsight = result.activities.find((a) => a.activityId === 'walk')!
    expect(walkInsight.scheduled).toBe(7)
    expect(walkInsight.postponed).toBe(2)
    expect(walkInsight.met).toBe(1)
    expect(walkInsight.postponementRate).toBeCloseTo(2 / 7)

    expect(result.summary).toContain('this week')
    expect(result.summary).toContain('Walk')
  })

  it('builds day-of-week skip correlation', () => {
    // 2026-08-10 is Monday
    const result = computeInsights(
      [activity()],
      [
        entry({ id: '1', date: '2026-08-10', type: 'postponed' }),
        entry({ id: '2', date: '2026-08-03', type: 'postponed' }),
        entry({ id: '3', date: '2026-08-11', type: 'postponed' }),
      ],
      'month',
      '2026-08-11',
    )
    const monday = result.dayOfWeekSkips.find((d) => d.label === 'Mon')!
    expect(monday.count).toBe(2)
    expect(result.peakSkipDay?.label).toBe('Mon')
  })

  it('buckets session times of day', () => {
    const result = computeInsights(
      [activity({ tracking_mode: 'timer', target_value: 10, target_unit: 'minutes' })],
      [
        entry({
          id: '1',
          type: 'session',
          source: 'timer',
          duration_seconds: 600,
          date: '2026-08-11',
          started_at: '2026-08-11T19:30:00',
          created_at: '2026-08-11T19:40:00',
        }),
        entry({
          id: '2',
          type: 'session',
          source: 'timer',
          duration_seconds: 300,
          date: '2026-08-10',
          started_at: '2026-08-10T20:00:00',
          created_at: '2026-08-10T20:10:00',
        }),
      ],
      'week',
      '2026-08-11',
    )
    expect(result.peakSessionBucket?.label).toBe('evening')
  })

  it('formats percent', () => {
    expect(formatPercent(0.8)).toBe('80%')
  })

  it('builds a day series for week and month windows', () => {
    const reading = activity({
      id: 'reading',
      name: 'Reading',
      tracking_mode: 'timer',
      target_value: 10,
      target_unit: 'minutes',
    })
    const entries: LogEntry[] = [
      entry({
        id: '1',
        activity_id: 'reading',
        type: 'session',
        source: 'timer',
        duration_seconds: 600,
        date: '2026-08-11',
      }),
      entry({
        id: '2',
        activity_id: 'reading',
        type: 'postponed',
        date: '2026-08-10',
      }),
    ]

    const week = buildActivityInsightSeries(reading, entries, 'week', '2026-08-11')
    expect(week).toHaveLength(7)
    expect(week.find((p) => p.date === '2026-08-11')?.status).toBe('met')
    expect(week.find((p) => p.date === '2026-08-11')?.value).toBe(10)
    expect(week.find((p) => p.date === '2026-08-10')?.status).toBe('postponed')

    const month = buildActivityInsightSeries(reading, entries, 'month', '2026-08-11')
    expect(month).toHaveLength(11) // created Aug 1 → Aug 11
    expect(month[0]?.date).toBe('2026-08-01')
  })
})
