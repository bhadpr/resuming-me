import { describe, expect, it } from 'vitest'
import { emailReminderLine, formatReminderClock } from './checkinPrefs'

describe('formatReminderClock', () => {
  it('writes 19:00 as 7:00 pm', () => {
    expect(formatReminderClock('19:00')).toBe('7:00 pm')
    expect(emailReminderLine('19:00')).toBe(
      "Email at 7:00 pm if it's still open. Nothing if you're done.",
    )
  })
})
