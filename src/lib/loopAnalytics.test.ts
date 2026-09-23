import { describe, expect, it } from 'vitest'
import { cohortRetention, summarizeComebackLoop } from './loopAnalytics'

describe('comeback loop dashboard', () => {
  it('splits returns by whether the welcome card was shown', () => {
    const summary = summarizeComebackLoop(
      [
        { name: 'comeback', userId: 'a', createdAt: '2026-09-01T00:00:00Z' },
        { name: 'comeback', userId: 'a', createdAt: '2026-09-08T00:00:00Z' },
        { name: 'welcome_back_shown', userId: 'a', createdAt: '2026-09-08T00:00:00Z' },
        { name: 'comeback', userId: 'b', createdAt: '2026-09-03T00:00:00Z' },
        { name: 'review_generated', userId: 'a', createdAt: '2026-09-07T00:00:00Z' },
        { name: 'review_generated', userId: 'b', createdAt: '2026-09-07T00:00:00Z' },
        { name: 'review_opened', userId: 'a', createdAt: '2026-09-07T01:00:00Z' },
        { name: 'review_focus_set', userId: 'a', createdAt: '2026-09-07T01:05:00Z' },
      ],
      2,
    )
    expect(summary.comebacksPerActiveUser).toBe(1.5)
    expect(summary.returnedWithCard).toBe(1)
    expect(summary.returnedWithoutCard).toBe(1)
    expect(summary.reviewOpenRate).toBe(0.5)
    expect(summary.reviewActionRate).toBe(1)
    expect(summary.caveat).toContain('not a controlled test')
  })

  it('leaves later cohort weeks empty until they have ended', () => {
    const rows = cohortRetention({
      signups: [{ userId: 'a', at: '2026-09-01T00:00:00Z' }],
      showedUp: [{ userId: 'a', at: '2026-09-10T00:00:00Z' }],
      asOf: '2026-09-20',
    })
    expect(rows[0]?.week2).toBe(1)
    expect(rows[0]?.week4).toBeNull()
    expect(rows[0]?.week8).toBeNull()
  })
})
