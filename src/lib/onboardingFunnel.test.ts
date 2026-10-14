import { describe, expect, it } from 'vitest'
import { parseOnboardingFunnel } from './onboardingFunnel'

describe('parseOnboardingFunnel', () => {
  it('reads the totals counted in the database', () => {
    const summary = parseOnboardingFunnel({
      started: 2,
      steps: [
        { step: 1, people: 1 },
        { step: 2, people: 0 },
      ],
      timerStarted: 2,
      timerCompleted: 2,
      timerSkipped: 0,
      reminderSet: 1,
      reminderNone: 1,
      signinShown: 1,
      signups: 1,
      medianSecondsToFirstResume: 180,
      loggedDay2: 1,
      loggedDay3: 0,
      loggedDay7: 0,
      signupCohort: 1,
    })
    expect(summary.started).toBe(2)
    expect(summary.steps[0]).toEqual({ step: 1, people: 1 })
    expect(summary.medianSecondsToFirstResume).toBe(180)
    expect(summary.loggedDay2).toBe(1)
    expect(summary.signupCohort).toBe(1)
  })

  it('keeps an unknown median empty and treats missing numbers as zero', () => {
    const summary = parseOnboardingFunnel({ started: '3', medianSecondsToFirstResume: null })
    expect(summary.started).toBe(3)
    expect(summary.medianSecondsToFirstResume).toBeNull()
    expect(summary.signups).toBe(0)
    expect(summary.steps).toEqual([])
    expect(parseOnboardingFunnel(null).started).toBe(0)
  })
})
