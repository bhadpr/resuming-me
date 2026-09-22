import { describe, expect, it } from 'vitest'
import { getDayStatus, showedUp, type DayStatusActivity } from './dayStatus'
import type { LogEntry } from './logs'

function activity(overrides: Partial<DayStatusActivity> = {}): DayStatusActivity {
  return {
    id: 'a1',
    type: 'daily',
    tracking_mode: 'timer',
    target_value: 5,
    target_unit: 'min',
    weekly_target: null,
    deadline: null,
    archived: false,
    ...overrides,
  }
}

function entry(overrides: Partial<LogEntry>): LogEntry {
  return {
    id: 'e1',
    activity_id: 'a1',
    user_id: 'u1',
    type: 'session',
    source: 'timer',
    started_at: null,
    duration_seconds: 120,
    date: '2026-09-22',
    note: null,
    created_at: '2026-09-22T12:00:00Z',
    updated_at: null,
    ...overrides,
  }
}

const tz = 'America/Los_Angeles'
const today = '2026-09-22'

describe('getDayStatus — daily timer', () => {
  it('open today with nothing logged', () => {
    expect(
      getDayStatus({
        activity: activity(),
        entriesForDay: [],
        date: today,
        today,
        timezone: tz,
      }),
    ).toEqual({ status: 'open', value: 0, target: 5 })
  })

  it('partial for 2 min on a 5 min target', () => {
    const result = getDayStatus({
      activity: activity(),
      entriesForDay: [entry({ duration_seconds: 120 })],
      date: today,
      today,
      timezone: tz,
    })
    expect(result.status).toBe('partial')
    expect(result.value).toBe(2)
    expect(result.target).toBe(5)
    expect(showedUp(result.status)).toBe(true)
  })

  it('done when target met', () => {
    expect(
      getDayStatus({
        activity: activity(),
        entriesForDay: [entry({ duration_seconds: 300 })],
        date: today,
        today,
        timezone: tz,
      }).status,
    ).toBe('done')
  })

  it('missed for a past day with no log', () => {
    expect(
      getDayStatus({
        activity: activity(),
        entriesForDay: [],
        date: '2026-09-20',
        today,
        timezone: tz,
      }).status,
    ).toBe('missed')
  })

  it('treats auto postponed as missed, not skipped', () => {
    expect(
      getDayStatus({
        activity: activity(),
        entriesForDay: [
          entry({ type: 'postponed', source: 'auto', duration_seconds: null }),
        ],
        date: '2026-09-20',
        today,
        timezone: tz,
      }).status,
    ).toBe('missed')
  })

  it('treats null-source postponed as auto/missed (pre-migration)', () => {
    expect(
      getDayStatus({
        activity: activity(),
        entriesForDay: [
          entry({ type: 'postponed', source: null, duration_seconds: null }),
        ],
        date: '2026-09-20',
        today,
        timezone: tz,
      }).status,
    ).toBe('missed')
  })

  it('skipped for explicit user postpone (non-auto source)', () => {
    expect(
      getDayStatus({
        activity: activity(),
        entriesForDay: [
          entry({
            type: 'postponed',
            source: 'manual',
            duration_seconds: null,
            note: 'Too tired',
          }),
        ],
        date: today,
        today,
        timezone: tz,
      }).status,
    ).toBe('skipped')
  })
})

describe('getDayStatus — daily checkbox / count', () => {
  it('checkbox done / open / missed', () => {
    const box = activity({
      tracking_mode: 'checkbox',
      target_value: null,
      target_unit: null,
    })
    expect(
      getDayStatus({
        activity: box,
        entriesForDay: [entry({ type: 'completed', source: null, duration_seconds: null })],
        date: today,
        today,
        timezone: tz,
      }).status,
    ).toBe('done')
    expect(
      getDayStatus({
        activity: box,
        entriesForDay: [],
        date: today,
        today,
        timezone: tz,
      }).status,
    ).toBe('open')
    expect(
      getDayStatus({
        activity: box,
        entriesForDay: [],
        date: '2026-09-20',
        today,
        timezone: tz,
      }).status,
    ).toBe('missed')
  })

  it('count partial when below target', () => {
    const count = activity({
      tracking_mode: 'count',
      target_value: 3,
      target_unit: null,
    })
    expect(
      getDayStatus({
        activity: count,
        entriesForDay: [
          entry({ id: '1', type: 'completed', source: null, duration_seconds: null }),
        ],
        date: today,
        today,
        timezone: tz,
      }),
    ).toMatchObject({ status: 'partial', value: 1, target: 3 })
  })
})

describe('getDayStatus — weekly / monthly / deadline', () => {
  it('weekly timer done when qualifying sessions meet target', () => {
    const weekly = activity({
      type: 'weekly_n',
      target_value: 10,
      weekly_target: 2,
    })
    // week of Mon 2026-09-21
    const result = getDayStatus({
      activity: weekly,
      entriesForDay: [
        entry({
          id: '1',
          date: '2026-09-21',
          duration_seconds: 600,
        }),
        entry({
          id: '2',
          date: '2026-09-22',
          duration_seconds: 600,
        }),
      ],
      date: '2026-09-21',
      today,
      timezone: tz,
    })
    expect(result.status).toBe('done')
    expect(result.value).toBe(2)
    expect(result.target).toBe(2)
  })

  it('monthly open until completed', () => {
    const monthly = activity({
      type: 'monthly',
      tracking_mode: 'checkbox',
      target_value: null,
      target_unit: null,
    })
    expect(
      getDayStatus({
        activity: monthly,
        entriesForDay: [],
        date: '2026-09-01',
        today,
        timezone: tz,
      }).status,
    ).toBe('open')
    expect(
      getDayStatus({
        activity: monthly,
        entriesForDay: [
          entry({
            type: 'completed',
            source: null,
            duration_seconds: null,
            date: '2026-09-10',
          }),
        ],
        date: '2026-09-01',
        today,
        timezone: tz,
      }).status,
    ).toBe('done')
  })

  it('deadline done / open / missed', () => {
    const deadline = activity({
      type: 'deadline',
      tracking_mode: 'checkbox',
      target_value: null,
      target_unit: null,
      deadline: '2026-09-25',
    })
    expect(
      getDayStatus({
        activity: deadline,
        entriesForDay: [],
        date: today,
        today,
        timezone: tz,
      }).status,
    ).toBe('open')
    expect(
      getDayStatus({
        activity: deadline,
        entriesForDay: [
          entry({ type: 'completed', source: null, duration_seconds: null }),
        ],
        date: today,
        today,
        timezone: tz,
      }).status,
    ).toBe('done')
    expect(
      getDayStatus({
        activity: { ...deadline, deadline: '2026-09-20' },
        entriesForDay: [],
        date: today,
        today,
        timezone: tz,
      }).status,
    ).toBe('missed')
  })
})

describe('getDayStatus — rest / paused stubs', () => {
  it('rest and paused take priority', () => {
    expect(
      getDayStatus({
        activity: activity(),
        entriesForDay: [],
        date: today,
        today,
        timezone: tz,
        restDates: new Set([today]),
      }).status,
    ).toBe('rest')
    expect(
      getDayStatus({
        activity: activity(),
        entriesForDay: [],
        date: today,
        today,
        timezone: tz,
        pauses: [{ activityId: 'a1', from: '2026-09-20', until: null }],
      }).status,
    ).toBe('paused')
  })
})
