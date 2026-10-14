import { describe, expect, it } from 'vitest'
import { parseLoopAnalytics } from './loopAnalytics'

describe('parseLoopAnalytics', () => {
  it('turns the totals into rates and keeps cohort weeks that have not ended empty', () => {
    const { loop, cohorts } = parseLoopAnalytics({
      activeUsers: 2,
      comebacks: 3,
      returnedWithCard: 1,
      returnedWithoutCard: 1,
      reviewsGenerated: 2,
      reviewsOpened: 1,
      openedUsers: 1,
      actedUsers: 1,
      cohorts: [
        { weekStart: '2026-09-28', size: 6, week2: 0.5, week4: null, week8: null },
        { weekStart: '2026-09-21', size: 1, week2: 0, week4: null, week8: null },
      ],
    })
    expect(loop.comebacksPerActiveUser).toBe(1.5)
    expect(loop.returnedWithCard).toBe(1)
    expect(loop.returnedWithoutCard).toBe(1)
    expect(loop.reviewOpenRate).toBe(0.5)
    expect(loop.reviewActionRate).toBe(1)
    expect(loop.caveat).toContain('not a controlled test')
    expect(cohorts[0]).toEqual({ weekStart: '2026-09-28', size: 6, week2: 0.5, week4: null, week8: null })
    expect(cohorts[1]?.week2).toBe(0)
  })

  it('has no rates when nobody was active or opened a review', () => {
    const { loop, cohorts } = parseLoopAnalytics({ activeUsers: 0, comebacks: 0 })
    expect(loop.comebacksPerActiveUser).toBeNull()
    expect(loop.reviewOpenRate).toBeNull()
    expect(loop.reviewActionRate).toBeNull()
    expect(cohorts).toEqual([])
  })
})
