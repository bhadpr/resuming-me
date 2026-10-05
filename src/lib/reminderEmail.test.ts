import { describe, expect, it } from 'vitest'
import { reminderEmailCopy } from './reminderEmail'

const links = { open: 'https://resuming.me/today', off: 'https://example.com/off' }

describe('reminderEmailCopy', () => {
  it('names a single reminder in the subject', () => {
    const copy = reminderEmailCopy('en', [{ text: 'Doctor at the clinic', hour: 11, minute: 0 }], links)
    expect(copy.subject).toBe('Today: Doctor at the clinic')
    expect(copy.text).toContain('• 11:00 Doctor at the clinic')
    expect(copy.text).toContain('Open Today: https://resuming.me/today')
    expect(copy.text).toContain('Turn off emails from Resuming: https://example.com/off')
  })

  it('counts several, with timed ones showing their time', () => {
    const copy = reminderEmailCopy(
      'en',
      [
        { text: 'Doctor', hour: 9, minute: 30 },
        { text: 'Post office', hour: null, minute: null },
      ],
      links,
    )
    expect(copy.subject).toBe('2 reminders today')
    expect(copy.text).toContain('• 09:30 Doctor\n• Post office')
  })

  it('writes in the person’s language, and falls back to English', () => {
    expect(reminderEmailCopy('hi', [{ text: 'डाकघर', hour: null, minute: null }], links).subject).toBe('आज: डाकघर')
    expect(
      reminderEmailCopy(
        'mr',
        [
          { text: 'अ', hour: 9, minute: 0 },
          { text: 'ब', hour: null, minute: null },
        ],
        links,
      ),
    ).toMatchObject({ subject: 'आज २ आठवणी' })
    expect(reminderEmailCopy('fr', [{ text: 'Tax', hour: null, minute: null }], links).subject).toBe('Today: Tax')
    expect(reminderEmailCopy(null, [{ text: 'Tax', hour: null, minute: null }], links).subject).toBe('Today: Tax')
  })

  it('keeps a subject on one line', () => {
    const copy = reminderEmailCopy('en', [{ text: 'Pay\nrent', hour: null, minute: null }], links)
    expect(copy.subject).toBe('Today: Pay rent')
  })
})
