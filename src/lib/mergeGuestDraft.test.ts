import { describe, expect, it } from 'vitest'
import { guestReminderAlreadySaved } from './mergeGuestDraft'

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
