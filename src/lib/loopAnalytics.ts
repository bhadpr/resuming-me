import { asCount, asList, asRatio, asRecord, fetchAnalyticsSummary } from './adminRpc'

export type ComebackLoopSummary = {
  comebacksPerActiveUser: number | null
  returnedWithCard: number
  returnedWithoutCard: number
  reviewOpenRate: number | null
  reviewActionRate: number | null
  caveat: string
}

export type CohortRow = {
  weekStart: string
  size: number
  week2: number | null
  week4: number | null
  week8: number | null
}

export type LoopAnalytics = { loop: ComebackLoopSummary; cohorts: CohortRow[] }

function rate(part: number, whole: number): number | null {
  return whole > 0 ? part / whole : null
}

/**
 * Turns the database totals (loop_analytics_summary) into the comeback-loop and cohort cards.
 * A cohort week is left empty (null) until that week has ended. Each person counts once, in the
 * week of their first sign-up event.
 */
export function parseLoopAnalytics(data: unknown): LoopAnalytics {
  const row = asRecord(data)
  return {
    loop: {
      comebacksPerActiveUser: rate(asCount(row.comebacks), asCount(row.activeUsers)),
      returnedWithCard: asCount(row.returnedWithCard),
      returnedWithoutCard: asCount(row.returnedWithoutCard),
      reviewOpenRate: rate(asCount(row.reviewsOpened), asCount(row.reviewsGenerated)),
      reviewActionRate: rate(asCount(row.actedUsers), asCount(row.openedUsers)),
      caveat: 'This compares people who came back. It is not a controlled test.',
    },
    cohorts: asList(row.cohorts).map((cohort) => ({
      weekStart: String(cohort.weekStart ?? ''),
      size: asCount(cohort.size),
      week2: asRatio(cohort.week2),
      week4: asRatio(cohort.week4),
      week8: asRatio(cohort.week8),
    })),
  }
}

/** Comeback loop and signup-week cohorts for the last `days` days, counted in the database. */
export async function fetchLoopAnalytics(days = 90): Promise<LoopAnalytics> {
  return parseLoopAnalytics(await fetchAnalyticsSummary('loop_analytics_summary', days))
}
