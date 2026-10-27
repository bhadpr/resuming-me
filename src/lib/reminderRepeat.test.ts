import { describe, expect, it } from 'vitest'
import {
  addMonthsClamped,
  clampRepeatUntil,
  completeOccurrence,
  defaultRepeatUntil,
  effectiveReminder,
  occurrenceOnOrAfter,
  reopenOccurrence,
  repeatIssue,
  repeatLimit,
  upcomingOccurrences,
} from './reminderRepeat'
import { planReminderAlerts } from './reminderAlerts'
import {
  remindersComingUp,
  remindersDoneToday,
  remindersForToday,
  validateReminder,
  type Reminder,
} from './reminderSchedule'

function reminder(over: Partial<Reminder> = {}): Reminder {
  return {
    id: 'r1',
    text: 'Take the stairs',
    day: '2026-10-14',
    hour: null,
    minute: null,
    remindBefore: false,
    kind: 'other',
    everyYear: false,
    doneAt: null,
    repeat: 'day',
    repeatFrom: '2026-10-14',
    repeatUntil: '2026-11-14',
    lastDoneOn: null,
    ...over,
  }
}

describe('dates for a repeat', () => {
  it('adds months and ends a short month on its last day', () => {
    expect(addMonthsClamped('2026-10-14', 1)).toBe('2026-11-14')
    expect(addMonthsClamped('2026-12-31', 2)).toBe('2027-02-28')
    expect(addMonthsClamped('2027-12-31', 2)).toBe('2028-02-29')
    expect(addMonthsClamped('2026-01-31', 1)).toBe('2026-02-28')
  })

  it('ends after one month by default and at most two months out', () => {
    expect(defaultRepeatUntil('2026-10-14')).toBe('2026-11-14')
    expect(repeatLimit('2026-10-14')).toBe('2026-12-14')
  })

  it('keeps a chosen end date between the first day and the limit', () => {
    expect(clampRepeatUntil('2026-10-14', '2027-03-01')).toBe('2026-12-14')
    expect(clampRepeatUntil('2026-10-14', '2026-10-01')).toBe('2026-10-14')
    expect(clampRepeatUntil('2026-10-14', '2026-11-20')).toBe('2026-11-20')
  })
})

describe('occurrenceOnOrAfter', () => {
  it('keeps a day that has not passed', () => {
    expect(occurrenceOnOrAfter('2026-10-14', 'day', '2026-11-14', '2026-10-14')).toBe('2026-10-14')
    expect(occurrenceOnOrAfter('2026-10-20', 'week', '2026-11-14', '2026-10-14')).toBe('2026-10-20')
  })

  it('drops missed days and lands on the next one', () => {
    expect(occurrenceOnOrAfter('2026-10-10', 'day', '2026-11-14', '2026-10-14')).toBe('2026-10-14')
    // Mondays: 5 Oct, 12 Oct, 19 Oct. On Wednesday 14 Oct the next is 19 Oct.
    expect(occurrenceOnOrAfter('2026-10-05', 'week', '2026-11-14', '2026-10-14')).toBe('2026-10-19')
    expect(occurrenceOnOrAfter('2026-10-05', 'week', '2026-11-14', '2026-10-19')).toBe('2026-10-19')
  })

  it('is null once the end date has passed', () => {
    expect(occurrenceOnOrAfter('2026-10-01', 'day', '2026-10-10', '2026-10-14')).toBeNull()
    expect(occurrenceOnOrAfter('2026-10-05', 'week', '2026-10-18', '2026-10-14')).toBeNull()
    expect(occurrenceOnOrAfter('2026-10-05', 'week', '2026-10-19', '2026-10-14')).toBe('2026-10-19')
  })
})

describe('effectiveReminder', () => {
  it('leaves a one-time reminder alone', () => {
    const once = reminder({ repeat: null, repeatUntil: null, repeatFrom: null, day: '2026-10-01' })
    expect(effectiveReminder(once, '2026-10-14')).toBe(once)
  })

  it('moves a repeat past its missed days', () => {
    const missed = reminder({ day: '2026-10-10' })
    expect(effectiveReminder(missed, '2026-10-14').day).toBe('2026-10-14')
  })

  it('counts a repeat past its end date as done', () => {
    const ended = effectiveReminder(reminder({ day: '2026-10-01', repeatUntil: '2026-10-05' }), '2026-10-14')
    expect(ended.doneAt).not.toBeNull()
    expect(new Date(ended.doneAt!).getTime()).toBeLessThan(new Date('2026-10-06T00:00:00').getTime())
  })
})

describe('completeOccurrence and reopenOccurrence', () => {
  const done = '2026-10-14T09:00:00'

  it('moves a daily repeat to tomorrow', () => {
    const current = reminder()
    expect(completeOccurrence(current as never, done)).toEqual({
      day: '2026-10-15',
      doneAt: null,
      lastDoneOn: '2026-10-14',
    })
  })

  it('moves a weekly repeat a week on', () => {
    const current = reminder({ repeat: 'week' })
    expect(completeOccurrence(current as never, done).day).toBe('2026-10-21')
  })

  it('is done for good after the last day', () => {
    const last = reminder({ day: '2026-11-14' })
    const next = completeOccurrence(last as never, '2026-11-14T09:00:00')
    expect(next.day).toBe('2026-11-14')
    expect(next.doneAt).toBe('2026-11-14T09:00:00')
  })

  it('goes back to the day it moved past', () => {
    const moved = reminder({ day: '2026-10-15', lastDoneOn: '2026-10-14' })
    expect(reopenOccurrence(moved as never, '2026-10-14')).toEqual({
      day: '2026-10-14',
      doneAt: null,
      lastDoneOn: null,
    })
    const weekly = reminder({ repeat: 'week', day: '2026-10-21', lastDoneOn: '2026-10-14' })
    expect(reopenOccurrence(weekly as never, '2026-10-14').day).toBe('2026-10-14')
  })

  it('also takes the reminder as it was just before Done', () => {
    const before = reminder({ day: '2026-10-14', lastDoneOn: '2026-10-13' })
    expect(reopenOccurrence(before as never, '2026-10-14').day).toBe('2026-10-14')
  })

  it('reopens a series that Done ended', () => {
    const ended = reminder({ day: '2026-11-14', doneAt: '2026-11-14T09:00:00', lastDoneOn: '2026-11-14' })
    expect(reopenOccurrence(ended as never, '2026-11-14')).toEqual({
      day: '2026-11-14',
      doneAt: null,
      lastDoneOn: null,
    })
  })
})

describe('upcomingOccurrences', () => {
  it('lists the next days and stops at the end date', () => {
    expect(upcomingOccurrences(reminder() as never, 3)).toEqual(['2026-10-14', '2026-10-15', '2026-10-16'])
    expect(upcomingOccurrences(reminder({ repeat: 'week', repeatUntil: '2026-10-30' }) as never)).toEqual([
      '2026-10-14',
      '2026-10-21',
      '2026-10-28',
    ])
  })
})

describe('repeatIssue and validateReminder', () => {
  it('accepts no repeat and a repeat inside two months', () => {
    expect(repeatIssue({ day: '2026-10-14' })).toBeNull()
    expect(repeatIssue({ day: '2026-10-14', repeat: 'day', repeatUntil: '2026-12-14' })).toBeNull()
  })

  it('rejects an end date before the first day or past two months', () => {
    expect(repeatIssue({ day: '2026-10-14', repeat: 'day', repeatUntil: '2026-10-13' })).toBe('repeat')
    expect(repeatIssue({ day: '2026-10-14', repeat: 'day', repeatUntil: '2026-12-15' })).toBe('repeat')
    expect(repeatIssue({ day: '2026-10-14', repeat: 'day', repeatUntil: null })).toBe('repeat')
  })

  it('counts the two months from the first day of the repeat, not the next day', () => {
    const input = { day: '2026-11-20', repeat: 'day' as const, repeatFrom: '2026-10-14' }
    expect(repeatIssue({ ...input, repeatUntil: '2026-12-14' })).toBeNull()
    expect(repeatIssue({ ...input, repeatUntil: '2026-12-15' })).toBe('repeat')
  })

  it('is part of validating a reminder', () => {
    expect(
      validateReminder({ text: 'Stairs', day: '2026-10-14', hour: null, minute: null, repeat: 'day', repeatUntil: '2027-01-01' }),
    ).toBe('repeat')
  })
})

describe('reminder lists', () => {
  const today = '2026-10-14'

  it('shows a repeat on Today on each due day, and not after Done moved it on', () => {
    expect(remindersForToday([reminder()], today)).toHaveLength(1)
    const doneToday = reminder({ day: '2026-10-15', lastDoneOn: today })
    expect(remindersForToday([doneToday], today)).toHaveLength(0)
    expect(remindersComingUp([doneToday], today).map((item) => item.day)).toEqual(['2026-10-15'])
  })

  it('lists a repeat done today under Done today', () => {
    const doneToday = reminder({ day: '2026-10-15', lastDoneOn: today })
    expect(remindersDoneToday([doneToday], today)).toHaveLength(1)
    expect(remindersDoneToday([reminder({ lastDoneOn: '2026-10-13' })], today)).toHaveLength(0)
  })

  it('does not stack missed days as overdue', () => {
    const list = remindersForToday([reminder({ day: '2026-10-08' })], today)
    expect(list.map((item) => item.day)).toEqual([today])
  })

  it('drops a series past its end date', () => {
    const old = reminder({ day: '2026-09-01', repeatFrom: '2026-09-01', repeatUntil: '2026-09-20' })
    expect(remindersForToday([old], today)).toHaveLength(0)
    expect(remindersComingUp([old], today)).toHaveLength(0)
  })
})

describe('alerts for a repeat', () => {
  const copy = { now: 'Now', lead: () => 'Soon', dayBefore: () => 'Tomorrow', weekBefore: () => 'Week' }
  const evening = { hour: 18, minute: 0 }
  const now = new Date(2026, 9, 14, 8, 0)

  it('arms only the next seven days, and never an evening-before alert', () => {
    const timed = reminder({ hour: 9, minute: 0, remindBefore: true })
    const alerts = planReminderAlerts([timed], [], now, evening, copy)
    expect(alerts).toHaveLength(7)
    expect(alerts.every((alert) => alert.kind === 'time')).toBe(true)
    expect(alerts[0].at.getDate()).toBe(14)
    expect(alerts[6].at.getDate()).toBe(20)
  })

  it('skips today when its time has passed, and stops at the end date', () => {
    const timed = reminder({ hour: 7, minute: 0, repeatUntil: '2026-10-16' })
    const alerts = planReminderAlerts([timed], [], now, evening, copy)
    expect(alerts.map((alert) => alert.at.getDate())).toEqual([15, 16])
  })

  it('has nothing to arm for a repeat without a time or one that has ended', () => {
    expect(planReminderAlerts([reminder()], [], now, evening, copy)).toHaveLength(0)
    const ended = reminder({ hour: 9, minute: 0, day: '2026-09-01', repeatFrom: '2026-09-01', repeatUntil: '2026-09-10' })
    expect(planReminderAlerts([ended], [], now, evening, copy)).toHaveLength(0)
  })
})
