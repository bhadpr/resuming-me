import { describe, it, expect } from 'vitest'
import {
  dailyTargetMet,
  isDeadlineOverdue,
  localDateInTimeZone,
  monthlyTargetMet,
  planRollover,
  weeklyTargetMet,
} from './rollover'
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
    date: '2026-08-10',
    note: null,
    created_at: '2026-08-10T12:00:00Z',
    updated_at: null,
    ...overrides,
  }
}

describe('localDateInTimeZone', () => {
  it('uses America/Los_Angeles date near UTC midnight', () => {
    // 2026-08-12 05:00 UTC = Aug 11 evening in LA (PDT, UTC-7)
    const utc = new Date('2026-08-12T05:00:00.000Z')
    expect(localDateInTimeZone(utc, 'America/Los_Angeles')).toBe('2026-08-11')
    expect(localDateInTimeZone(utc, 'UTC')).toBe('2026-08-12')
  })
})

describe('dailyTargetMet', () => {
  it('is false when no completions', () => {
    expect(dailyTargetMet(activity(), [], '2026-08-10')).toBe(false)
  })

  it('is true when checkbox completed', () => {
    expect(
      dailyTargetMet(activity(), [entry({ date: '2026-08-10' })], '2026-08-10'),
    ).toBe(true)
  })

  it('sums timer sessions toward minutes target', () => {
    const read = activity({
      tracking_mode: 'timer',
      target_value: 10,
      target_unit: 'minutes',
    })
    const entries = [
      entry({
        id: '1',
        type: 'session',
        source: 'timer',
        duration_seconds: 300,
        date: '2026-08-10',
      }),
      entry({
        id: '2',
        type: 'session',
        source: 'timer',
        duration_seconds: 300,
        date: '2026-08-10',
      }),
    ]
    expect(dailyTargetMet(read, entries, '2026-08-10')).toBe(true)
  })
})

describe('planRollover', () => {
  it('plans postponed for unmet daily day that just closed', () => {
    // Local LA "today" = 2026-08-11 → closed day 2026-08-10
    const nowUtc = new Date('2026-08-12T05:00:00.000Z')
    const walk = activity({ id: 'walk', created_at: '2026-08-01T00:00:00Z' })
    const plans = planRollover({
      userId: 'u1',
      timezone: 'America/Los_Angeles',
      nowUtc,
      activities: [walk],
      entries: [],
      lookbackDays: 1,
    })
    expect(plans).toEqual([
      {
        activityId: 'walk',
        userId: 'u1',
        date: '2026-08-10',
        reason: 'daily',
      },
    ])
  })

  it('skips days that already have postponed or were met', () => {
    const nowUtc = new Date('2026-08-12T05:00:00.000Z')
    const walk = activity({ id: 'walk' })
    const plans = planRollover({
      userId: 'u1',
      timezone: 'America/Los_Angeles',
      nowUtc,
      activities: [walk],
      entries: [
        entry({
          activity_id: 'walk',
          type: 'postponed',
          date: '2026-08-10',
        }),
      ],
      lookbackDays: 1,
    })
    expect(plans).toEqual([])
  })

  it('plans weekly postponed on Sunday when week unmet', () => {
    // Monday Aug 17 2026 05:00 UTC → Sun Aug 16 evening LA? 
    // Aug 17 05:00 UTC = Aug 16 22:00 PDT → local Monday? 
    // PDT = UTC-7: Aug 17 05:00 UTC = Aug 16 22:00 LA = Sunday
    // Use a clear Monday morning in LA: Aug 17 15:00 UTC = Aug 17 08:00 LA Monday
    const nowUtc = new Date('2026-08-17T15:00:00.000Z')
    expect(localDateInTimeZone(nowUtc, 'America/Los_Angeles')).toBe('2026-08-17')

    const gym = activity({
      id: 'gym',
      type: 'weekly_n',
      tracking_mode: 'count',
      weekly_target: 2,
      target_value: 1,
      created_at: '2026-08-01T00:00:00Z',
    })
    const plans = planRollover({
      userId: 'u1',
      timezone: 'America/Los_Angeles',
      nowUtc,
      activities: [gym],
      entries: [],
      lookbackDays: 7,
    })
    // Previous week Mon Aug 10 – Sun Aug 16
    expect(plans.some((p) => p.reason === 'weekly' && p.date === '2026-08-16')).toBe(
      true,
    )
  })

  it('does not postpone weekly when target met', () => {
    const nowUtc = new Date('2026-08-17T15:00:00.000Z')
    const gym = activity({
      id: 'gym',
      type: 'weekly_n',
      tracking_mode: 'count',
      weekly_target: 2,
      target_value: 1,
    })
    expect(
      weeklyTargetMet(
        gym,
        [
          entry({ id: '1', activity_id: 'gym', date: '2026-08-11' }),
          entry({ id: '2', activity_id: 'gym', date: '2026-08-13' }),
        ],
        '2026-08-10',
      ),
    ).toBe(true)

    const plans = planRollover({
      userId: 'u1',
      timezone: 'America/Los_Angeles',
      nowUtc,
      activities: [gym],
      entries: [
        entry({ id: '1', activity_id: 'gym', date: '2026-08-11' }),
        entry({ id: '2', activity_id: 'gym', date: '2026-08-13' }),
      ],
      lookbackDays: 7,
    })
    expect(plans.filter((p) => p.activityId === 'gym')).toEqual([])
  })

  it('plans postponed for an unmet closed month', () => {
    const nowUtc = new Date('2026-08-17T15:00:00.000Z')
    const bills = activity({
      id: 'bills',
      type: 'monthly',
      tracking_mode: 'checkbox',
      created_at: '2026-07-01T00:00:00Z',
    })
    expect(monthlyTargetMet(bills, [], '2026-07-01')).toBe(false)
    const plans = planRollover({
      userId: 'u1',
      timezone: 'America/Los_Angeles',
      nowUtc,
      activities: [bills],
      entries: [],
      lookbackDays: 7,
    })
    expect(plans.some((p) => p.reason === 'monthly' && p.date === '2026-07-31')).toBe(
      true,
    )
  })
})

describe('isDeadlineOverdue', () => {
  it('is true when past deadline without completed', () => {
    const taxes = activity({
      type: 'deadline',
      tracking_mode: 'checkbox',
      deadline: '2026-08-01',
    })
    expect(isDeadlineOverdue(taxes, [], '2026-08-11')).toBe(true)
  })

  it('is false when completed', () => {
    const taxes = activity({
      id: 'taxes',
      type: 'deadline',
      tracking_mode: 'checkbox',
      deadline: '2026-08-01',
    })
    expect(
      isDeadlineOverdue(
        taxes,
        [entry({ activity_id: 'taxes', date: '2026-08-05' })],
        '2026-08-11',
      ),
    ).toBe(false)
  })
})
