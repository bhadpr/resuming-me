import { describe, it, expect } from 'vitest'
import {
  applyEasyWins,
  buildQuietInsightLine,
  buildReentryNotification,
  canShrinkToday,
  isQuietReentry,
  lastActivityWinDate,
  pickEasiestReentryRow,
  reentryPrimaryLabel,
  reentrySuggestLine,
  trackingStartDate,
  QUIET_DAYS_THRESHOLD,
  REENTRY_NOTIFICATION_BODY,
  REENTRY_NOTIFICATION_ID,
} from './reentry'
import { buildTodayProgress } from './today'
import type { Activity } from './activities'
import type { LogEntry } from './logs'

function activity(overrides: Partial<Activity>): Activity {
  return {
    id: 'a1',
    user_id: 'u1',
    name: 'Meditation',
    emoji: '🧘',
    type: 'daily',
    tracking_mode: 'timer',
    target_value: 1,
    target_unit: 'min',
    target_effective_from: '2026-08-01',
    weekly_target: null,
    deadline: null,
    micro_steps: [],
    archived: false,
    created_at: '2026-08-01T12:00:00.000Z',
    updated_at: '2026-08-01T12:00:00.000Z',
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

describe('isQuietReentry', () => {
  it('is false with no active activities', () => {
    expect(
      isQuietReentry({
        activities: [activity({ archived: true })],
        entries: [],
        today: '2026-08-19',
      }),
    ).toBe(false)
    expect(
      isQuietReentry({
        activities: [],
        entries: [entry({ date: '2026-08-01' })],
        today: '2026-08-19',
      }),
    ).toBe(false)
  })

  it('is false when something was completed today', () => {
    expect(
      isQuietReentry({
        activities: [activity()],
        entries: [entry({ date: '2026-08-19' })],
        today: '2026-08-19',
      }),
    ).toBe(false)
  })

  it('is false before 5 quiet days', () => {
    expect(
      isQuietReentry({
        activities: [activity()],
        entries: [entry({ date: '2026-08-15' })],
        today: '2026-08-19',
      }),
    ).toBe(false)
  })

  it('is true after 5 days with no completions', () => {
    expect(QUIET_DAYS_THRESHOLD).toBe(5)
    expect(
      isQuietReentry({
        activities: [activity()],
        entries: [entry({ date: '2026-08-14' })],
        today: '2026-08-19',
      }),
    ).toBe(true)
  })

  it('counts timer sessions as a win', () => {
    expect(
      isQuietReentry({
        activities: [activity()],
        entries: [entry({ type: 'session', date: '2026-08-18', duration_seconds: 60 })],
        today: '2026-08-19',
      }),
    ).toBe(false)
  })

  it('ignores tiny accidental sessions', () => {
    expect(
      isQuietReentry({
        activities: [activity({ created_at: '2026-08-01T12:00:00.000Z' })],
        entries: [entry({ type: 'session', date: '2026-08-19', duration_seconds: 1 })],
        today: '2026-08-19',
      }),
    ).toBe(true)
  })

  it('ignores postponed entries', () => {
    expect(
      isQuietReentry({
        activities: [activity()],
        entries: [entry({ type: 'postponed', date: '2026-08-19' })],
        today: '2026-08-19',
      }),
    ).toBe(true)
  })

  it('ignores wins on archived activities', () => {
    expect(
      isQuietReentry({
        activities: [
          activity({ id: 'old', archived: true }),
          activity({ id: 'new', created_at: '2026-08-01T12:00:00.000Z' }),
        ],
        entries: [entry({ activity_id: 'old', date: '2026-08-19' })],
        today: '2026-08-19',
      }),
    ).toBe(true)
  })

  it('waits 5 days after setup when nothing has been done yet', () => {
    expect(
      isQuietReentry({
        activities: [activity({ created_at: '2026-08-17T15:00:00.000Z' })],
        entries: [],
        today: '2026-08-19',
      }),
    ).toBe(false)
    expect(
      isQuietReentry({
        activities: [activity({ created_at: '2026-08-14T15:00:00.000Z' })],
        entries: [],
        today: '2026-08-19',
      }),
    ).toBe(true)
  })
})

describe('lastActivityWinDate', () => {
  it('returns the latest completed or session date', () => {
    expect(
      lastActivityWinDate(
        [
          entry({ activity_id: 'a1', type: 'session', date: '2026-08-10' }),
          entry({ activity_id: 'a1', type: 'completed', date: '2026-08-12' }),
          entry({ activity_id: 'a1', type: 'postponed', date: '2026-08-13' }),
        ],
        new Set(['a1']),
      ),
    ).toBe('2026-08-12')
  })
})

describe('trackingStartDate', () => {
  it('uses the oldest active activity', () => {
    expect(
      trackingStartDate([
        activity({ created_at: '2026-08-10T12:00:00.000Z' }),
        activity({ id: 'a2', created_at: '2026-08-04T12:00:00.000Z' }),
        activity({ id: 'a3', archived: true, created_at: '2026-07-01T12:00:00.000Z' }),
      ]),
    ).toBe('2026-08-04')
  })
})

describe('pickEasiestReentryRow', () => {
  it('prefers the shortest timer over a checkbox', () => {
    const rows = buildTodayProgress(
      [
        activity({
          id: 'walk',
          name: 'Walk',
          tracking_mode: 'checkbox',
          target_value: null,
          target_unit: null,
        }),
        activity({
          id: 'read',
          name: 'Reading',
          tracking_mode: 'timer',
          target_value: 10,
          target_unit: 'min',
        }),
        activity({
          id: 'med',
          name: 'Meditation',
          tracking_mode: 'timer',
          target_value: 1,
          target_unit: 'min',
        }),
      ],
      [],
      [],
      '2026-08-19',
    )
    expect(pickEasiestReentryRow(rows)?.activity.id).toBe('med')
  })

  it('skips activities that are already done', () => {
    const rows = buildTodayProgress(
      [
        activity({ id: 'med', name: 'Meditation', target_value: 1 }),
        activity({
          id: 'walk',
          name: 'Walk',
          tracking_mode: 'checkbox',
          target_value: null,
          target_unit: null,
        }),
      ],
      [entry({ activity_id: 'med', type: 'session', duration_seconds: 60, date: '2026-08-19' })],
      [],
      '2026-08-19',
    )
    expect(pickEasiestReentryRow(rows)?.activity.id).toBe('walk')
  })
})

describe('canShrinkToday', () => {
  it('is only for timers bigger than 2 minutes', () => {
    const [tiny, bigger, walk] = buildTodayProgress(
      [
        activity({ id: 'tiny', target_value: 1 }),
        activity({ id: 'bigger', name: 'Reading', target_value: 10 }),
        activity({
          id: 'walk',
          name: 'Walk',
          tracking_mode: 'checkbox',
          target_value: null,
          target_unit: null,
        }),
      ],
      [],
      [],
      '2026-08-19',
    )
    expect(canShrinkToday(tiny)).toBe(false)
    expect(canShrinkToday(bigger)).toBe(true)
    expect(canShrinkToday(walk)).toBe(false)
  })
})

describe('reentry copy', () => {
  it('names the small ask', () => {
    const [row] = buildTodayProgress(
      [activity({ name: 'Reading', target_value: 10 })],
      [],
      [],
      '2026-08-19',
    )
    expect(reentrySuggestLine(row)).toBe('Try Reading · 10 min')
    expect(reentryPrimaryLabel(row)).toBe('Start')
  })
})

describe('applyEasyWins', () => {
  it('marks a today-only smaller session as done', () => {
    const rows = buildTodayProgress(
      [activity({ id: 'read', name: 'Reading', target_value: 10 })],
      [
        entry({
          activity_id: 'read',
          type: 'session',
          duration_seconds: 120,
          date: '2026-08-19',
        }),
      ],
      [],
      '2026-08-19',
    )
    expect(rows[0].done).toBe(false)
    const next = applyEasyWins(rows, new Set(['read']))
    expect(next[0].done).toBe(true)
    expect(next[0].progressLabel).toBe('Enough for today')
  })

  it('does not stay done after today\'s session is gone', () => {
    const rows = buildTodayProgress(
      [activity({ id: 'read', name: 'Reading', target_value: 10 })],
      [],
      [],
      '2026-08-19',
    )
    const next = applyEasyWins(rows, new Set(['read']))
    expect(next[0].done).toBe(false)
  })
})

describe('buildReentryNotification', () => {
  const prefs = { enabled: true, hour: 19, minute: 0 }

  it('is silent when the reminder is off', () => {
    expect(
      buildReentryNotification({
        activities: [activity()],
        entries: [],
        today: '2026-08-16',
        prefs: { ...prefs, enabled: false },
        now: new Date(2026, 7, 16, 10, 0, 0),
      }),
    ).toBeNull()
  })

  it('is silent with no active activities', () => {
    expect(
      buildReentryNotification({
        activities: [activity({ archived: true })],
        entries: [],
        today: '2026-08-16',
        prefs,
        now: new Date(2026, 7, 16, 10, 0, 0),
      }),
    ).toBeNull()
  })

  it('arms a ping 5 days after the last win so it can fire with the app closed', () => {
    const ping = buildReentryNotification({
      activities: [activity()],
      entries: [entry({ date: '2026-08-14', type: 'completed' })],
      today: '2026-08-16',
      prefs,
      now: new Date(2026, 7, 16, 10, 0, 0),
    })
    expect(ping).toEqual({
      id: REENTRY_NOTIFICATION_ID,
      title: 'Resuming',
      body: REENTRY_NOTIFICATION_BODY,
      at: new Date(2026, 7, 19, 19, 0, 0),
    })
  })

  it('still arms today if quiet day 5 has not reached reminder time yet', () => {
    const ping = buildReentryNotification({
      activities: [activity()],
      entries: [entry({ date: '2026-08-14', type: 'completed' })],
      today: '2026-08-19',
      prefs,
      now: new Date(2026, 7, 19, 10, 0, 0),
    })
    expect(ping?.at).toEqual(new Date(2026, 7, 19, 19, 0, 0))
  })

  it('does not schedule another day after that slot has passed', () => {
    expect(
      buildReentryNotification({
        activities: [activity()],
        entries: [entry({ date: '2026-08-14', type: 'completed' })],
        today: '2026-08-19',
        prefs,
        now: new Date(2026, 7, 19, 20, 0, 0),
      }),
    ).toBeNull()
  })
})

describe('buildQuietInsightLine', () => {
  it('is silent when the last 5 days were not quiet', () => {
    expect(
      buildQuietInsightLine({
        activities: [activity()],
        entries: [entry({ date: '2026-08-19' })],
        today: '2026-08-19',
        rows: [],
      }),
    ).toBeNull()
  })

  it('names the easiest activity to pick up', () => {
    const rows = buildTodayProgress(
      [
        activity({
          id: 'read',
          name: 'Reading',
          tracking_mode: 'timer',
          target_value: 10,
          target_unit: 'min',
        }),
        activity({
          id: 'med',
          name: 'Meditation',
          tracking_mode: 'timer',
          target_value: 1,
          target_unit: 'min',
        }),
      ],
      [],
      [],
      '2026-08-19',
    )
    expect(
      buildQuietInsightLine({
        activities: rows.map((row) => row.activity),
        entries: [entry({ date: '2026-08-14' })],
        today: '2026-08-19',
        rows,
      }),
    ).toBe('Last 5 days were quiet. Meditation is an easy place to pick up.')
  })
})
