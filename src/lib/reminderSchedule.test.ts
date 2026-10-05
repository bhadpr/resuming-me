import { describe, expect, it } from 'vitest'
import {
  DEFAULT_PART_TIMES,
  cleanReminderText,
  isNextYearCopyOf,
  nextYearCopy,
  nextYearDay,
  partOfTime,
  reminderKindOf,
  remindersComingUp,
  remindersDoneToday,
  remindersForToday,
  validateReminder,
  type Reminder,
} from './reminderSchedule'

describe('every year', () => {
  it('moves to the same date next year, and 29 February to 28 February', () => {
    expect(nextYearDay('2026-10-10')).toBe('2027-10-10')
    expect(nextYearDay('2026-12-31')).toBe('2027-12-31')
    expect(nextYearDay('2028-02-29')).toBe('2029-02-28')
    expect(nextYearDay('2027-02-28')).toBe('2028-02-28')
  })

  it('copies everything but the day, and the copy repeats too', () => {
    const birthday: Reminder = {
      id: 'b',
      text: "Amma's birthday",
      day: '2026-10-10',
      hour: 8,
      minute: 0,
      remindBefore: true,
      kind: 'event',
      everyYear: true,
      doneAt: '2026-10-10T03:00:00.000Z',
    }
    expect(nextYearCopy(birthday)).toEqual({
      text: "Amma's birthday",
      day: '2027-10-10',
      hour: 8,
      minute: 0,
      remindBefore: true,
      kind: 'event',
      everyYear: true,
    })
  })

  it('recognises the open copy next year, and nothing else', () => {
    const done = { ...reminderOf('b', '2026-10-10'), everyYear: true, doneAt: '2026-10-10T03:00:00.000Z' }
    expect(isNextYearCopyOf({ ...reminderOf('c', '2027-10-10'), everyYear: true }, done)).toBe(true)
    expect(isNextYearCopyOf({ ...reminderOf('c', '2027-10-11'), everyYear: true }, done)).toBe(false)
    expect(isNextYearCopyOf(reminderOf('c', '2027-10-10'), done)).toBe(false)
    expect(isNextYearCopyOf({ ...reminderOf('c', '2027-10-10'), everyYear: true, text: 'Other' }, done)).toBe(false)
  })
})

describe('reminderKindOf', () => {
  it('keeps known kinds and treats anything else as Other', () => {
    expect(reminderKindOf('doctor')).toBe('doctor')
    expect(reminderKindOf(null)).toBe('other')
    expect(reminderKindOf('holiday')).toBe('other')
  })
})

function reminderOf(id: string, day: string): Reminder {
  return {
    id,
    text: 'b',
    day,
    hour: null,
    minute: null,
    remindBefore: false,
    kind: 'other',
    everyYear: false,
    doneAt: null,
  }
}

function reminder(id: string, day: string, extra: Partial<Reminder> = {}): Reminder {
  return {
    id,
    text: id,
    day,
    hour: null,
    minute: null,
    remindBefore: false,
    kind: 'other',
    everyYear: false,
    doneAt: null,
    ...extra,
  }
}

function localIso(day: string, hour: number): string {
  const [y, m, d] = day.split('-').map(Number)
  return new Date(y, m - 1, d, hour, 0, 0).toISOString()
}

const today = '2026-10-06'

describe('reminder lists', () => {
  const list = [
    reminder('later', '2026-10-09'),
    reminder('any-today', today),
    reminder('timed-today', today, { hour: 9, minute: 30 }),
    reminder('earlier', '2026-10-04'),
    reminder('tomorrow', '2026-10-07', { hour: 18, minute: 0 }),
    reminder('done-today', today, { doneAt: localIso(today, 10) }),
    reminder('done-yesterday', '2026-10-05', { doneAt: localIso('2026-10-05', 20) }),
  ]

  it('keeps earlier open days on Today, timed before any time', () => {
    expect(remindersForToday(list, today).map((item) => item.id)).toEqual([
      'earlier',
      'timed-today',
      'any-today',
    ])
  })

  it('lists only what was done today', () => {
    expect(remindersDoneToday(list, today).map((item) => item.id)).toEqual(['done-today'])
  })

  it('lists open reminders after today by date', () => {
    expect(remindersComingUp(list, today).map((item) => item.id)).toEqual(['tomorrow', 'later'])
  })
})

describe('validateReminder', () => {
  it('needs text and a day', () => {
    expect(validateReminder({ text: '  ', day: today, hour: null, minute: null })).toBe('text')
    expect(validateReminder({ text: 'File tax', day: 'soon', hour: null, minute: null })).toBe('day')
    expect(validateReminder({ text: 'File tax', day: today, hour: null, minute: null })).toBeNull()
  })

  it('collapses spaces and caps the length', () => {
    expect(cleanReminderText('  Doctor   at 11 ')).toBe('Doctor at 11')
    expect(cleanReminderText('a'.repeat(200))).toHaveLength(120)
  })
})

describe('partOfTime', () => {
  it('matches the time chips', () => {
    expect(partOfTime(null, null, DEFAULT_PART_TIMES)).toBe('any')
    expect(partOfTime(9, 0, DEFAULT_PART_TIMES)).toBe('morning')
    expect(partOfTime(18, 0, DEFAULT_PART_TIMES)).toBe('evening')
    expect(partOfTime(11, 15, DEFAULT_PART_TIMES)).toBe('pick')
  })
})
