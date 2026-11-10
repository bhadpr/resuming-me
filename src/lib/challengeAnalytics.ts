import { ANALYTICS_WINDOW_DAYS, type AnalyticsWindow } from './analytics'
import { asCount, asList, fetchAnalyticsSummary } from './adminRpc'

export interface ChallengeSummary {
  started: number
  walking: number
  meditation: number
  race: number
  together: number
  joined: number
  people: number
  withMember: number
  reached3: number
  stillGoing: number
  ended: number
  endedEarly: number
  perDay: Array<{ day: string; started: number; joined: number }>
}

/** Counts only. Titles, account ids, steps, and minutes stay out of this summary. */
export function parseChallengeSummary(data: unknown): ChallengeSummary {
  const row = data && typeof data === 'object' && !Array.isArray(data) ? (data as Record<string, unknown>) : {}
  return {
    started: asCount(row.started),
    walking: asCount(row.walking),
    meditation: asCount(row.meditation),
    race: asCount(row.race),
    together: asCount(row.together),
    joined: asCount(row.joined),
    people: asCount(row.people),
    withMember: asCount(row.withMember),
    reached3: asCount(row.reached3),
    stillGoing: asCount(row.stillGoing),
    ended: asCount(row.ended),
    endedEarly: asCount(row.endedEarly),
    perDay: asList(row.perDay)
      .filter((entry) => typeof entry.day === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(entry.day))
      .map((entry) => ({
        day: entry.day as string,
        started: asCount(entry.started),
        joined: asCount(entry.joined),
      }))
      .sort((a, b) => a.day.localeCompare(b.day)),
  }
}

export async function fetchChallengeSummary(window: AnalyticsWindow): Promise<ChallengeSummary> {
  return parseChallengeSummary(
    await fetchAnalyticsSummary('challenge_analytics_summary', ANALYTICS_WINDOW_DAYS[window]),
  )
}
