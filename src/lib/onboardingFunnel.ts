import { ANALYTICS_WINDOW_DAYS, type AnalyticsWindow } from './analytics'
import { asCount, asList, asRatio, asRecord, fetchAnalyticsSummary } from './adminRpc'

export type OnboardingFunnel = {
  started: number
  steps: { step: number; people: number }[]
  timerStarted: number
  timerCompleted: number
  timerSkipped: number
  reminderSet: number
  reminderNone: number
  signinShown: number
  signups: number
  /** Median seconds from onboarding_started to the first resume, or null. */
  medianSecondsToFirstResume: number | null
  /** People with a signup who also logged on day 2, 3, or 7. */
  loggedDay2: number
  loggedDay3: number
  loggedDay7: number
  signupCohort: number
}

/** Turns the database totals (onboarding_funnel_summary) into the cards on the Analytics screen. */
export function parseOnboardingFunnel(data: unknown): OnboardingFunnel {
  const row = asRecord(data)
  return {
    started: asCount(row.started),
    steps: asList(row.steps).map((step) => ({ step: asCount(step.step), people: asCount(step.people) })),
    timerStarted: asCount(row.timerStarted),
    timerCompleted: asCount(row.timerCompleted),
    timerSkipped: asCount(row.timerSkipped),
    reminderSet: asCount(row.reminderSet),
    reminderNone: asCount(row.reminderNone),
    signinShown: asCount(row.signinShown),
    signups: asCount(row.signups),
    medianSecondsToFirstResume: asRatio(row.medianSecondsToFirstResume),
    loggedDay2: asCount(row.loggedDay2),
    loggedDay3: asCount(row.loggedDay3),
    loggedDay7: asCount(row.loggedDay7),
    signupCohort: asCount(row.signupCohort),
  }
}

/** Admin cards for the onboarding funnel and first-week logging, counted in the database. */
export async function fetchOnboardingFunnel(window: AnalyticsWindow): Promise<OnboardingFunnel> {
  return parseOnboardingFunnel(
    await fetchAnalyticsSummary('onboarding_funnel_summary', ANALYTICS_WINDOW_DAYS[window]),
  )
}
