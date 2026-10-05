import { describe, expect, it } from 'vitest'
import {
  DEFAULT_PART_TIMES,
  cleanReminderText,
  partOfTime,
  remindersComingUp,
  remindersDoneToday,
  remindersForToday,
  validateReminder,
  type Reminder,
} from './reminderSchedule'

function reminder(id: string, day: string, extra: Partial<Reminder> = {}): Reminder {
  return { id, text: id, day, hour: null, minute: null, doneAt: null, ...extra }
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
