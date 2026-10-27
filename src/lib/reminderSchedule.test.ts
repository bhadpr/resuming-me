import { describe, expect, it } from 'vitest'
import {
  DEFAULT_PART_TIMES,
  REMINDER_DESCRIPTION_MAX,
  cleanReminderDescription,
  cleanReminderText,
  formatShortReminderTime,
  isNextYearCopyOf,
  nextYearCopy,
  nextYearDay,
  partOfTime,
  reminderKindOf,
  reminderPrefillFrom,
  remindersComingUp,
  remindersDoneToday,
  remindersForToday,
  openReminderCount,
  reminderListKind,
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
      description: 'Order the cake',
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
      description: 'Order the cake',
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

describe('cleanReminderDescription', () => {
  it('keeps line breaks, tidies spaces, and allows one blank line in a row', () => {
    expect(cleanReminderDescription('  Hall B,   2nd floor \r\n\r\n\r\n\r\nBring  the form  ')).toBe(
      'Hall B, 2nd floor\n\nBring the form',
    )
  })

  it('is null when empty or missing', () => {
    expect(cleanReminderDescription('   \n \n ')).toBeNull()
    expect(cleanReminderDescription(null)).toBeNull()
    expect(cleanReminderDescription(undefined)).toBeNull()
  })

  it('stops at 500 characters', () => {
    expect(cleanReminderDescription('a'.repeat(600))).toHaveLength(REMINDER_DESCRIPTION_MAX)
  })
})

describe('reminderPrefillFrom', () => {
  it('carries the description into a new reminder', () => {
    expect(
      reminderPrefillFrom({ reminderPrefill: { text: 'Garba', description: ' Bring water ', day: '2026-10-12' } }),
    ).toMatchObject({ text: 'Garba', description: 'Bring water' })
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

  it('moves an undone personal reminder onto today, timed before any time', () => {
    const shown = remindersForToday(list, today)
    expect(shown.map((item) => item.id)).toEqual(['timed-today', 'any-today', 'earlier'])
    expect(shown.find((item) => item.id === 'earlier')?.day).toBe(today)
  })

  it('drops a meetup, holiday, or community day once that day has passed', () => {
    const passed = [
      reminder('meetup', '2026-10-04', { meetup: true }),
      reminder('holiday', '2026-10-05', { communityId: 'diwali' }),
      reminder('game', '2026-10-04', { sharedListId: 'seahawks', sharedListItemId: 'game-1' }),
      reminder('personal', '2026-10-04'),
      reminder('meetup-today', today, { meetup: true }),
    ]
    expect(remindersForToday(passed, today).map((item) => item.id)).toEqual(['personal', 'meetup-today'])
    expect(openReminderCount(passed, today)).toBe(2)
  })

  it('keeps a cancelled shared event on its day, then lets it go', () => {
    const shared = [
      reminder('cancelled-today', today, { sharedEventId: 'e1', sharedStatus: 'cancelled' }),
      reminder('cancelled-earlier', '2026-10-04', { sharedEventId: 'e2', sharedStatus: 'cancelled' }),
      reminder('off-earlier', '2026-10-05', { sharedEventId: 'e3', sharedStatus: 'switched_off' }),
      reminder('active-earlier', '2026-10-05', { sharedEventId: 'e4', sharedStatus: 'active' }),
    ]
    expect(remindersForToday(shared, today).map((item) => item.id)).toEqual(['cancelled-today', 'active-earlier'])
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

describe('formatShortReminderTime', () => {
  it('drops the minutes on the hour so the time chips stay short', () => {
    expect(formatShortReminderTime(9, 0, 'en')).not.toContain(':')
    expect(formatShortReminderTime(9, 0, 'en')).toMatch(/^9\s?(am|AM)$/)
  })

  it('keeps the minutes otherwise', () => {
    expect(formatShortReminderTime(9, 30, 'en')).toContain('9:30')
  })
})

describe('reminderListKind', () => {
  const row = { meetup: false, communityId: null, sharedListItemId: null, sharedListId: null }

  it('leaves a personal reminder unmarked', () => {
    expect(reminderListKind(row)).toBeNull()
  })

  it('marks a meetup ahead of a followed list', () => {
    expect(reminderListKind({ ...row, meetup: true })).toBe('meetup')
    expect(reminderListKind({ ...row, meetup: true, sharedListId: 'list' })).toBe('meetup')
  })

  it('marks a holiday list separately from a school or team schedule', () => {
    expect(reminderListKind({ ...row, communityId: 'diwali' })).toBe('holiday')
    expect(reminderListKind({ ...row, sharedListId: 'a11ce001-0000-4111-8001-000000000001' })).toBe('holiday')
    expect(reminderListKind({ ...row, sharedListId: 'school', sharedListItemId: 'day' })).toBe('schedule')
  })
})
