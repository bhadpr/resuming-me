import { describe, expect, it } from 'vitest'
import { reminderClock } from './listClock'

describe('reminderClock', () => {
  const kickoff = { day: '2026-10-25', hour: 17, minute: 20 }

  it('keeps Pacific kickoff on a Pacific phone', () => {
    expect(reminderClock(kickoff, 'America/Los_Angeles', 'America/Los_Angeles')).toEqual(kickoff)
  })

  it('moves a Pacific kickoff to the phone', () => {
    expect(reminderClock(kickoff, 'America/Los_Angeles', 'America/New_York')).toEqual({
      day: '2026-10-25',
      hour: 20,
      minute: 20,
    })
  })

  it('leaves a day with no kickoff, and a list with no zone, on the stored clock', () => {
    expect(reminderClock({ day: '2027-01-10', hour: null, minute: null }, 'America/Los_Angeles', 'America/New_York')).toEqual({
      day: '2027-01-10',
      hour: null,
      minute: null,
    })
    expect(reminderClock(kickoff, null, 'America/New_York')).toEqual(kickoff)
  })
})
