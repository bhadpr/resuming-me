import { describe, expect, it } from 'vitest'
import { parseReminderSummary } from './reminderAnalytics'

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

  it('treats a missing result as zeros', () => {
    const summary = parseReminderSummary(null)
    expect(summary.added).toBe(0)
    expect(summary.kinds).toEqual([])
    expect(summary.shared.created).toBe(0)
  })
})
