import { describe, expect, it } from 'vitest'
import { ReminderCapError } from './reminders'
import { guestReminderAlreadySaved, reminderSaveOutcome } from './mergeGuestDraft'

const diwali = {
  text: 'Diwali',
  day: '2026-11-08',
  hour: null,
  minute: null,
  communityId: 'diwali',
  sharedEventId: null,
}

describe('guestReminderAlreadySaved', () => {
  it('keeps one community reminder when the title is in another language', () => {
    expect(
      guestReminderAlreadySaved([diwali], { ...diwali, text: 'दिवाली' }),
    ).toBe(true)
  })

  it('keeps one reminder with the same wording, day, and time', () => {
    expect(
      guestReminderAlreadySaved([diwali], { ...diwali, communityId: null }),
    ).toBe(true)
  })

  it('keeps one shared event', () => {
    expect(
      guestReminderAlreadySaved(
        [{ ...diwali, communityId: null, sharedEventId: 'event-1' }],
        { ...diwali, text: 'Meet at the mall', communityId: null, sharedEventId: 'event-1' },
      ),
    ).toBe(true)
  })

  it('stops at the reminder cap and skips one bad row', () => {
    expect(reminderSaveOutcome(new ReminderCapError())).toBe('stop')
    expect(reminderSaveOutcome({ code: 'P0001', message: 'reminders_open_cap' })).toBe('stop')
    expect(reminderSaveOutcome({ code: '23505', message: 'duplicate key' })).toBe('skip')
    expect(
      reminderSaveOutcome({ code: '22P02', message: 'invalid input syntax for type uuid' }),
    ).toBe('skip')
    expect(
      reminderSaveOutcome({
        code: '23503',
        message: 'insert or update on table "reminders" violates foreign key constraint "reminders_user_id_fkey"',
      }),
    ).toBe('fail')
    expect(reminderSaveOutcome(new Error('Load failed'))).toBe('fail')
  })

  it('still adds a different reminder', () => {
    expect(
      guestReminderAlreadySaved([diwali], {
        ...diwali,
        text: 'Holi',
        day: '2027-03-03',
        communityId: null,
      }),
    ).toBe(false)
  })
})
