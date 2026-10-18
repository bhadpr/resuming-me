import { describe, expect, it } from 'vitest'
import {
  EVENT_BREAKDOWNS,
  EVENT_GROUPS,
  eventInfo,
  languageName,
  parseAlertStatus,
  parseAppErrors,
  parseAppInstalls,
  parseEventPeriods,
  parseGuestRetention,
  parsePropBreakdown,
  periodLabel,
  propLabel,
  retentionPercent,
  sourceName,
} from './eventAnalytics'

describe('parseEventPeriods', () => {
  it('reads the periods and each event', () => {
    const parsed = parseEventPeriods({
      period: 'week',
      currentStart: '2026-10-12',
      starts: ['2026-10-05', '2026-10-12'],
      events: [
        { name: 'reminder_added', total: '5', counts: [2, '3'], devices: [1, 2] },
        { name: '', total: 1, counts: [1, 0], devices: [1, 0] },
      ],
    })
    expect(parsed.period).toBe('week')
    expect(parsed.starts).toEqual(['2026-10-05', '2026-10-12'])
    expect(parsed.currentStart).toBe('2026-10-12')
    expect(parsed.events).toEqual([{ name: 'reminder_added', total: 5, counts: [2, 3], devices: [1, 2] }])
  })

  it('pads a short list with zeros and survives bad data', () => {
    const parsed = parseEventPeriods({
      period: 'month',
      starts: ['2026-09-01', '2026-10-01', 'nonsense'],
      events: [{ name: 'a', total: 1, counts: [1], devices: 'x' }],
    })
    expect(parsed.period).toBe('month')
    expect(parsed.starts).toEqual(['2026-09-01', '2026-10-01'])
    expect(parsed.currentStart).toBe('2026-10-01')
    expect(parsed.events[0].counts).toEqual([1, 0])
    expect(parsed.events[0].devices).toEqual([0, 0])
    expect(parseEventPeriods(null).events).toEqual([])
  })
})

describe('periodLabel', () => {
  it('shows a week as day and month and a month as month and year', () => {
    expect(periodLabel('2026-10-12', 'week')).toBe('Oct 12')
    expect(periodLabel('2026-10-01', 'month')).toBe('Oct 26')
  })

  it('returns the text for a bad date', () => {
    expect(periodLabel('nope', 'week')).toBe('nope')
  })
})

describe('eventInfo', () => {
  it('gives a friendly name and a group', () => {
    expect(eventInfo('reminder_added')).toEqual({ label: 'Reminders added', group: 'Reminders' })
    expect(eventInfo('app_error').group).toBe('Errors')
  })

  it('puts an unknown event under Other with its own name', () => {
    expect(eventInfo('brand_new_event')).toEqual({ label: 'brand_new_event', group: 'Other' })
    expect(EVENT_GROUPS).toContain('Other')
  })
})

describe('parseAppInstalls', () => {
  it('reads counts, lists and the language date', () => {
    const parsed = parseAppInstalls({
      since: '2026-09-18',
      firstOpens: '4',
      firstOpensByVersion: [{ key: '1.0.6+9', count: 3 }, { count: 1 }],
      firstOpensByLanguage: [{ key: 'hi', count: '2' }],
      firstOpensPerDay: [{ day: '2026-10-16', count: 2 }, { day: 'bad', count: 1 }],
      activeDevices: 10,
      webDevices: 3,
      languageKnownSince: '2026-10-17T10:00:00Z',
    })
    expect(parsed.firstOpens).toBe(4)
    expect(parsed.firstOpensByVersion).toEqual([{ key: '1.0.6+9', count: 3 }])
    expect(parsed.firstOpensByLanguage).toEqual([{ key: 'hi', count: 2 }])
    expect(parsed.firstOpensPerDay).toEqual([{ day: '2026-10-16', count: 2 }])
    expect(parsed.activeDevices).toBe(10)
    expect(parsed.languageKnownSince).toBe('2026-10-17')
    expect(parseAppInstalls(undefined).languageKnownSince).toBeNull()
  })
})

describe('parseAppErrors', () => {
  it('reads totals and the most common errors', () => {
    const parsed = parseAppErrors({
      total: 3,
      devices: 2,
      activeDevices: 20,
      byVersion: [{ platform: 'android', version: '1.0.6', count: 3, devices: 2 }],
      top: [{ message: 'boom', kind: 'promise', count: 2, devices: 1, lastSeen: '2026-10-17T01:00:00Z', version: '1.0.6', file: 'i.js', line: '12' }],
      perDay: [{ day: '2026-10-17', count: 3 }],
    })
    expect(parsed.total).toBe(3)
    expect(parsed.byVersion[0]).toEqual({ platform: 'android', version: '1.0.6', count: 3, devices: 2 })
    expect(parsed.top[0]).toMatchObject({ message: 'boom', kind: 'promise', line: 12, file: 'i.js' })
    expect(parseAppErrors(null).top).toEqual([])
  })
})

describe('install source', () => {
  it('reads where installs came from and when that began', () => {
    const parsed = parseAppInstalls({
      firstOpensBySource: [{ key: 'resuming.me · landing', count: '2' }, { key: 'unknown', count: 5 }, { count: 1 }],
      sourceKnownSince: '2026-10-30T00:00:00Z',
    })
    expect(parsed.firstOpensBySource).toEqual([
      { key: 'resuming.me · landing', count: 2 },
      { key: 'unknown', count: 5 },
    ])
    expect(parsed.sourceKnownSince).toBe('2026-10-30')
    expect(parseAppInstalls(null).firstOpensBySource).toEqual([])
    expect(parseAppInstalls(null).sourceKnownSince).toBeNull()
  })

  it('names the words we made up and leaves the rest alone', () => {
    expect(sourceName('unknown')).toBe('Not recorded (older build)')
    expect(sourceName('direct')).toBe('Direct or search in Play')
    expect(sourceName('shared_event')).toBe('Shared event link')
    expect(sourceName('resuming.me · hero')).toBe('resuming.me · hero')
  })
})

describe('parseAlertStatus', () => {
  it('reads the counts and the state list', () => {
    const parsed = parseAlertStatus({
      devices: '10',
      ready: 7,
      notificationsOff: 2,
      exactAlarmsOff: 1,
      states: [{ notifications: 'granted', exactAlarms: 'granted', count: 7 }, { count: 3 }],
      knownSince: '2026-10-30',
    })
    expect(parsed).toMatchObject({ devices: 10, ready: 7, notificationsOff: 2, exactAlarmsOff: 1, knownSince: '2026-10-30' })
    expect(parsed.states).toEqual([
      { notifications: 'granted', exactAlarms: 'granted', count: 7 },
      { notifications: 'unknown', exactAlarms: 'unknown', count: 3 },
    ])
    expect(parseAlertStatus(undefined)).toMatchObject({ devices: 0, states: [], knownSince: null })
  })
})

describe('parsePropBreakdown', () => {
  it('reads the rows and drops ones with no key', () => {
    expect(
      parsePropBreakdown({
        name: 'reminder_added',
        prop: 'kind',
        rows: [{ key: 'school', count: '4', devices: 3 }, { key: '(not set)', count: 1 }, { count: 9 }],
      }),
    ).toEqual({
      name: 'reminder_added',
      prop: 'kind',
      rows: [
        { key: 'school', count: 4, devices: 3 },
        { key: '(not set)', count: 1, devices: 0 },
      ],
    })
    expect(parsePropBreakdown(null)).toEqual({ name: '', prop: '', rows: [] })
  })

  it('only offers plain properties, each a short word', () => {
    for (const props of Object.values(EVENT_BREAKDOWNS)) {
      for (const prop of props) expect(prop).toMatch(/^[a-z][a-z0-9_]{0,39}$/)
    }
    expect(EVENT_BREAKDOWNS.reminder_added).toContain('kind')
    expect(EVENT_BREAKDOWNS.log_created).toContain('kind')
  })

  it('names the split-by chips in plain words', () => {
    expect(propLabel('exact_alarms')).toBe('Alarms & reminders')
    expect(propLabel('has_time')).toBe('Has a time')
    expect(propLabel('brand_new_prop')).toBe('brand new prop')
  })
})

describe('parseGuestRetention', () => {
  const group = { size: '10', e1: 8, r1: 4, e7: 5, rw1: 3, r7: 2, e30: 0, r30: 0 }

  it('reads each group, with a week sharing the day-7 sample', () => {
    const parsed = parseGuestRetention({
      platform: 'web',
      weeks: [
        { weekStart: '2026-10-05', guest: group, account: { size: 1 } },
        { weekStart: 'bad', guest: group, account: group },
      ],
      headline: { guest: group, account: {} },
    })
    expect(parsed.platform).toBe('web')
    expect(parsed.weeks).toHaveLength(1)
    expect(parsed.weeks[0].guest).toEqual({
      size: 10,
      d1: { back: 4, eligible: 8 },
      w1: { back: 3, eligible: 5 },
      d7: { back: 2, eligible: 5 },
      d30: { back: 0, eligible: 0 },
    })
    expect(parsed.weeks[0].account.size).toBe(1)
    expect(parsed.headline.account.size).toBe(0)
  })

  it('survives nothing and falls back to Android', () => {
    const parsed = parseGuestRetention(null)
    expect(parsed.platform).toBe('android')
    expect(parsed.weeks).toEqual([])
    expect(parsed.headline.guest.d1).toEqual({ back: 0, eligible: 0 })
  })
})

describe('retentionPercent', () => {
  it('rounds, and says nothing when no device could be measured yet', () => {
    expect(retentionPercent({ back: 1, eligible: 3 })).toBe('33%')
    expect(retentionPercent({ back: 0, eligible: 4 })).toBe('0%')
    expect(retentionPercent({ back: 4, eligible: 4 })).toBe('100%')
    expect(retentionPercent({ back: 0, eligible: 0 })).toBeNull()
  })
})

describe('new events', () => {
  it('are named and grouped', () => {
    expect(eventInfo('video_played')).toEqual({ label: 'Videos played', group: 'Features and permissions' })
    expect(eventInfo('alerts_status').group).toBe('Features and permissions')
    expect(eventInfo('install_attributed').group).toBe('App')
    for (const name of ['video_played', 'health_permission', 'language_changed', 'alerts_status', 'install_attributed']) {
      expect(EVENT_GROUPS).toContain(eventInfo(name).group)
    }
  })
})

describe('languageName', () => {
  it('names the app languages and the unknown bucket', () => {
    expect(languageName('hi')).toBe('Hindi')
    expect(languageName('unknown')).toBe('Not known yet')
    expect(languageName('xx')).toBe('xx')
  })
})
