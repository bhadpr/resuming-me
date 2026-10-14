import { describe, expect, it } from 'vitest'
import { oneTimeDoneRate, parseReminderSummary } from './reminderAnalytics'

describe('parseReminderSummary', () => {
  it('reads the totals and folds unknown kinds into other', () => {
    const summary = parseReminderSummary({
      added: 3,
      done: 2,
      people: 3,
      withTime: 1,
      dayBefore: 1,
      everyYear: 1,
      signedIn: 1,
      doneFromNotification: 1,
      kinds: [
        { kind: 'doctor', count: 1 },
        { kind: 'event', count: 1 },
        { kind: null, count: 1 },
        { kind: 'surprise', count: 2 },
      ],
      shared: { created: 1, opened: 2, added: 1, installs: 1, cancelled: 0, reported: 1 },
    })
    expect(summary.added).toBe(3)
    expect(summary.doneFromNotification).toBe(1)
    expect(summary.kinds).toEqual([
      { kind: 'other', count: 3 },
      { kind: 'doctor', count: 1 },
      { kind: 'event', count: 1 },
    ])
    expect(summary.shared).toEqual({ created: 1, opened: 2, added: 1, installs: 1, cancelled: 0, reported: 1 })
  })

  it('reads repeats and the days, oldest first, and drops a bad day', () => {
    const summary = parseReminderSummary({
      repeatAdded: { day: 2, week: 1 },
      repeatDone: 5,
      perDay: [
        { day: '2026-10-14', added: 1, done: 3 },
        { day: 'not a day', added: 9, done: 9 },
        { day: '2026-10-13', added: 0, done: 0 },
      ],
    })
    expect(summary.repeatAdded).toEqual({ day: 2, week: 1 })
    expect(summary.repeatDone).toBe(5)
    expect(summary.perDay).toEqual([
      { day: '2026-10-13', added: 0, done: 0 },
      { day: '2026-10-14', added: 1, done: 3 },
    ])
  })

  it('works out done per added for one-time reminders only', () => {
    const base = { added: 10, done: 8, repeatAdded: { day: 2, week: 0 }, repeatDone: 3 }
    expect(oneTimeDoneRate(base)).toBe(63)
    expect(oneTimeDoneRate({ ...base, added: 2 })).toBeNull()
    expect(oneTimeDoneRate({ ...base, done: 2 })).toBe(0)
  })

  it('treats a missing result as zeros', () => {
    const summary = parseReminderSummary(null)
    expect(summary.perDay).toEqual([])
    expect(summary.repeatAdded).toEqual({ day: 0, week: 0 })
    expect(summary.added).toBe(0)
    expect(summary.kinds).toEqual([])
    expect(summary.shared.created).toBe(0)
  })
})
