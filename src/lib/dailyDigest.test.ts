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
    })
  })

  it('rejects invalid JSON and out-of-range times', () => {
    expect(parseDailyDigestPrefs('{')).toEqual(DEFAULT_DAILY_DIGEST_PREFS)
    expect(parseDailyDigestPrefs('{"enabled":true,"hour":99,"minute":-1}')).toEqual({
      enabled: true,
      hour: 19,
      minute: 0,
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
  const prefs = { enabled: true, hour: 19, minute: 0 }

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
    expect(fires.map((f) => f.kind)).toEqual(['later', 'later'])
    expect(fires[0].at).toEqual(new Date(2026, 7, 14, 19, 0, 0))
  })

  it('skips today when everything is done', () => {
    const now = new Date(2026, 7, 13, 10, 0, 0)
    const fires = nextDigestFires(prefs, now, { skipToday: true })
    expect(fires.map((f) => f.kind)).toEqual(['later', 'later'])
    expect(fires[0].at).toEqual(new Date(2026, 7, 14, 19, 0, 0))
  })

  it('returns nothing when disabled', () => {
    const now = new Date(2026, 7, 13, 10, 0, 0)
    expect(nextDigestFires({ ...prefs, enabled: false }, now, { skipToday: false })).toEqual(
      [],
    )
  })
})

describe('buildDigestNotifications', () => {
  const prefs = { enabled: true, hour: 19, minute: 0 }
  const now = new Date(2026, 7, 13, 10, 0, 0)

  it('does not schedule an empty activity list', () => {
    expect(buildDigestNotifications([], prefs, now)).toEqual([])
  })

  it('skips today and uses fallback copy when everything is done', () => {
    const notifications = buildDigestNotifications(
      [{ name: 'Reading', done: true }],
      prefs,
      now,
    )
    expect(notifications).toHaveLength(2)
    expect(notifications[0].id).toBe(DIGEST_NOTIFICATION_ID_BASE)
    expect(notifications[0].title).toBe(DIGEST_TITLE)
    expect(notifications[0].body).toBe(DIGEST_FALLBACK_BODY)
    expect(notifications[0].at).toEqual(new Date(2026, 7, 14, 19, 0, 0))
  })

  it('uses live copy for today and the lookahead days', () => {
    const notifications = buildDigestNotifications(
      [
        { name: 'Reading', done: false },
        { name: 'Walk', done: false },
      ],
      prefs,
      now,
    )
    expect(notifications).toHaveLength(3)
    expect(notifications.every((n) => n.body === 'Reading and Walk are still open.')).toBe(
      true,
    )
    expect(notifications[0].at).toEqual(new Date(2026, 7, 13, 19, 0, 0))
  })
})

describe('digestScheduleHint', () => {
  const prefs = { enabled: true, hour: 19, minute: 0 }
  const open = [{ name: 'Reading', done: false }]

  it('is silent when the reminder is off', () => {
    expect(digestScheduleHint(open, { ...prefs, enabled: false })).toBeNull()
  })

  it('asks for a Today activity when the list is empty', () => {
    expect(digestScheduleHint([], prefs, new Date(2026, 7, 13, 10, 0, 0))).toMatch(
      /add something on Today/i,
    )
  })

  it('skips today when everything is done', () => {
    expect(
      digestScheduleHint(
        [{ name: 'Reading', done: true }],
        prefs,
        new Date(2026, 7, 13, 10, 0, 0),
      ),
    ).toMatch(/done today/i)
  })

  it('rolls to tomorrow when the clock has passed', () => {
    expect(
      digestScheduleHint(open, prefs, new Date(2026, 7, 13, 20, 0, 0)),
    ).toMatch(/already passed today/i)
  })

  it('confirms today when the time is still ahead', () => {
    expect(
      digestScheduleHint(open, prefs, new Date(2026, 7, 13, 10, 0, 0)),
    ).toMatch(/today at 7:00 PM/i)
  })
})
