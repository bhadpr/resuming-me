import { describe, expect, it } from 'vitest'
import {
  buildDigestNotifications,
  DEFAULT_DAILY_DIGEST_PREFS,
  DIGEST_FALLBACK_BODY,
  DIGEST_NOTIFICATION_ID_BASE,
  DIGEST_TITLE,
  digestScheduleHint,
  formatDailyDigest,
  formatTimeInput,
  nextDigestFires,
  parseDailyDigestPrefs,
  parseTimeInput,
  withDigestTimes,
} from './dailyDigest'

describe('parseDailyDigestPrefs', () => {
  it('defaults to off at 19:00', () => {
    expect(parseDailyDigestPrefs(null)).toEqual(DEFAULT_DAILY_DIGEST_PREFS)
  })

  it('reads a valid payload', () => {
    expect(parseDailyDigestPrefs('{"enabled":true,"hour":7,"minute":30}')).toEqual({
      enabled: true,
      hour: 7,
      minute: 30,
      times: [{ hour: 7, minute: 30 }],
    })
  })

  it('reads multiple times', () => {
    expect(
      parseDailyDigestPrefs(
        '{"enabled":true,"hour":8,"minute":0,"times":[{"hour":8,"minute":0},{"hour":19,"minute":0}]}',
      ),
    ).toEqual({
      enabled: true,
      hour: 8,
      minute: 0,
      times: [
        { hour: 8, minute: 0 },
        { hour: 19, minute: 0 },
      ],
    })
  })

  it('rejects invalid JSON and out-of-range times', () => {
    expect(parseDailyDigestPrefs('{')).toEqual(DEFAULT_DAILY_DIGEST_PREFS)
    expect(parseDailyDigestPrefs('{"enabled":true,"hour":99,"minute":-1}')).toEqual({
      enabled: true,
      hour: 19,
      minute: 0,
      times: [{ hour: 19, minute: 0 }],
    })
  })
})

describe('time input', () => {
  it('pads HH:mm', () => {
    expect(formatTimeInput(7, 5)).toBe('07:05')
    expect(formatTimeInput(19, 0)).toBe('19:00')
  })

  it('parses HH:mm', () => {
    expect(parseTimeInput('07:05')).toEqual({ hour: 7, minute: 5 })
    expect(parseTimeInput('19:00')).toEqual({ hour: 19, minute: 0 })
    expect(parseTimeInput('24:00')).toBeNull()
    expect(parseTimeInput('7:5')).toBeNull()
  })
})

describe('formatDailyDigest', () => {
  it('is silent when nothing is open', () => {
    expect(formatDailyDigest([])).toBeNull()
    expect(formatDailyDigest([{ name: 'Reading', done: true }])).toBeNull()
  })

  it('names the last open activity', () => {
    expect(
      formatDailyDigest([
        { name: 'Walk', done: true },
        { name: 'Reading', done: false },
      ]),
    ).toBe('Reading is the last one left.')
  })

  it('names two open activities', () => {
    expect(
      formatDailyDigest([
        { name: 'Reading', done: false },
        { name: 'Walk', done: false },
      ]),
    ).toBe('Reading and Walk are still open.')
  })

  it('counts three or more', () => {
    expect(
      formatDailyDigest([
        { name: 'Reading', done: false },
        { name: 'Walk', done: false },
        { name: 'Gym', done: false },
      ]),
    ).toBe('3 still open today · Reading first.')
  })
})

describe('nextDigestFires', () => {
  const prefs = withDigestTimes({ enabled: true }, [{ hour: 19, minute: 0 }])

  it('schedules today when the time is still ahead', () => {
    const now = new Date(2026, 7, 13, 10, 0, 0)
    const fires = nextDigestFires(prefs, now, { skipToday: false })
    expect(fires).toHaveLength(3)
    expect(fires[0]).toEqual({ at: new Date(2026, 7, 13, 19, 0, 0), kind: 'today' })
    expect(fires[1].kind).toBe('later')
    expect(fires[1].at).toEqual(new Date(2026, 7, 14, 19, 0, 0))
  })

  it('skips today when the clock has passed', () => {
    const now = new Date(2026, 7, 13, 20, 0, 0)
    const fires = nextDigestFires(prefs, now, { skipToday: false })
    expect(fires.every((fire) => fire.kind === 'later')).toBe(true)
    expect(fires[0].at).toEqual(new Date(2026, 7, 14, 19, 0, 0))
  })

  it('schedules multiple times per day', () => {
    const multi = withDigestTimes(
      { enabled: true },
      [
        { hour: 8, minute: 0 },
        { hour: 19, minute: 0 },
      ],
    )
    const now = new Date(2026, 7, 13, 7, 0, 0)
    const fires = nextDigestFires(multi, now, { skipToday: false })
    expect(fires.filter((fire) => fire.kind === 'today')).toEqual([
      { at: new Date(2026, 7, 13, 8, 0, 0), kind: 'today' },
      { at: new Date(2026, 7, 13, 19, 0, 0), kind: 'today' },
    ])
  })
})

describe('buildDigestNotifications', () => {
  const prefs = withDigestTimes({ enabled: true }, [{ hour: 19, minute: 0 }])
  const now = new Date(2026, 7, 13, 10, 0, 0)

  it('is silent with no rows', () => {
    expect(buildDigestNotifications([], prefs, now)).toEqual([])
  })

  it('builds notifications for open habits', () => {
    const notifications = buildDigestNotifications(
      [{ name: 'Reading', done: false }],
      prefs,
      now,
    )
    expect(notifications[0]).toMatchObject({
      id: DIGEST_NOTIFICATION_ID_BASE,
      title: DIGEST_TITLE,
      body: 'Reading is the last one left.',
    })
  })

  it('skips today when everything is done', () => {
    const notifications = buildDigestNotifications(
      [{ name: 'Reading', done: true }],
      prefs,
      now,
    )
    expect(notifications.every((item) => item.body === DIGEST_FALLBACK_BODY || item.body.includes('Reading'))).toBe(true)
    expect(notifications[0]?.at.getDate()).toBe(14)
  })
})

describe('digestScheduleHint', () => {
  it('mentions multiple nudges', () => {
    const prefs = withDigestTimes(
      { enabled: true },
      [
        { hour: 8, minute: 0 },
        { hour: 19, minute: 0 },
      ],
    )
    const hint = digestScheduleHint([{ name: 'Walk', done: false }], prefs, new Date(2026, 7, 13, 7, 0, 0))
    expect(hint).toContain('2 nudges')
  })
})
