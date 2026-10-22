import { describe, expect, it } from 'vitest'
import { fitIosAlertBudget, IOS_PENDING_LIMIT, IOS_RESERVED_SLOTS } from './alertBudget'

function atMinutes(base: Date, minutes: number): Date {
  return new Date(base.getTime() + minutes * 60_000)
}

describe('fitIosAlertBudget', () => {
  const now = new Date('2026-10-21T12:00:00')

  it('keeps the soonest reminders and still keeps a later daily nudge', () => {
    const reminders = Array.from({ length: 100 }, (_, index) => ({
      id: 9000 + index,
      at: atMinutes(now, index + 1),
    }))
    const nudge = { id: 7100, at: atMinutes(now, 2_000) }
    const comeBack = { id: 7198, at: atMinutes(now, 3_000) }

    const fit = fitIosAlertBudget({
      reminders,
      digests: [nudge, { id: 7101, at: atMinutes(now, 4_000) }],
      reentry: comeBack,
    })

    const capacity = IOS_PENDING_LIMIT - IOS_RESERVED_SLOTS
    const scheduled = [...fit.reminders, ...fit.digests, fit.reentry].filter((item) => item != null)
    expect(scheduled).toHaveLength(capacity)
    expect(fit.digests.map((item) => item.id)).toContain(7100)
    expect(fit.reentry?.id).toBe(7198)
    expect(fit.reminders[0]?.id).toBe(9000)
    expect(fit.reminders.some((item) => item.id === 9000 + 99)).toBe(false)
    expect(new Set(scheduled.map((item) => item.id)).size).toBe(scheduled.length)
  })

  it('does not plan the same alert twice', () => {
    const shared = { id: 42, at: atMinutes(now, 5) }
    const fit = fitIosAlertBudget({
      reminders: [shared, { id: 43, at: atMinutes(now, 6) }],
      digests: [shared],
      reentry: null,
    })
    const ids = [...fit.reminders, ...fit.digests].map((item) => item.id)
    expect(ids.filter((id) => id === 42)).toHaveLength(1)
  })
})