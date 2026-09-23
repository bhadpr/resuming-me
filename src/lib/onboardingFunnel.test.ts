import { describe, expect, it } from 'vitest'
import { summarizeOnboardingFunnel } from './onboardingFunnel'

describe('onboarding funnel', () => {
  it('counts people, median time to resume, and day 2 logs', () => {
    const summary = summarizeOnboardingFunnel([
      { name: 'onboarding_started', anon_id: 'a', created_at: '2026-09-01T10:00:00Z', props: {} },
      { name: 'onboarding_started', anon_id: 'b', created_at: '2026-09-01T11:00:00Z', props: {} },
      {
        name: 'onboarding_step_completed',
        anon_id: 'a',
        created_at: '2026-09-01T10:01:00Z',
        props: { step: 1 },
      },
      {
        name: 'onboarding_timer_completed',
        anon_id: 'a',
        created_at: '2026-09-01T10:02:00Z',
        props: { seconds: 120 },
      },
      {
        name: 'onboarding_timer_completed',
        anon_id: 'b',
        created_at: '2026-09-01T11:04:00Z',
        props: { seconds: 90 },
      },
      {
        name: 'signup_completed',
        anon_id: 'a',
        user_id: 'user-a',
        created_at: '2026-09-01T10:05:00Z',
        props: {},
      },
      {
        name: 'log_created',
        anon_id: 'a',
        user_id: 'user-a',
        created_at: '2026-09-03T10:00:00Z',
        props: {},
      },
    ])

    expect(summary.started).toBe(2)
    expect(summary.steps[0]?.people).toBe(1)
    expect(summary.timerCompleted).toBe(2)
    expect(summary.medianSecondsToFirstResume).toBe(180)
    expect(summary.signups).toBe(1)
    expect(summary.loggedDay2).toBe(1)
    expect(summary.loggedDay7).toBe(0)
  })
})
