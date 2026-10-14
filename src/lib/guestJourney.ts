import { ANALYTICS_WINDOW_DAYS, type AnalyticsWindow } from './analytics'
import { asCount, asList, asRecord, fetchAnalyticsSummary } from './adminRpc'

export type GuestJourney = {
  landing: number
  intentStarted: number
  setupStarted: number
  habitsPicked: number
  firstLog: number
  signInShown: number
  signups: number
}

export type CreateCounts = {
  habitsCatalog: number
  habitsCustom: number
  vitalsCatalog: number
  vitalsCustom: number
  topHabits: { id: string; count: number }[]
  topVitals: { id: string; count: number }[]
}

export type GuestJourneySummary = { journey: GuestJourney; creates: CreateCounts }

function topList(value: unknown): { id: string; count: number }[] {
  return asList(value).map((row) => ({ id: String(row.id ?? ''), count: asCount(row.count) }))
}

/** Turns the database totals (guest_journey_summary) into the journey and create cards. */
export function parseGuestJourney(data: unknown): GuestJourneySummary {
  const root = asRecord(data)
  const journey = asRecord(root.journey)
  const creates = asRecord(root.creates)
  return {
    journey: {
      landing: asCount(journey.landing),
      intentStarted: asCount(journey.intentStarted),
      setupStarted: asCount(journey.setupStarted),
      habitsPicked: asCount(journey.habitsPicked),
      firstLog: asCount(journey.firstLog),
      signInShown: asCount(journey.signInShown),
      signups: asCount(journey.signups),
    },
    creates: {
      habitsCatalog: asCount(creates.habitsCatalog),
      habitsCustom: asCount(creates.habitsCustom),
      vitalsCatalog: asCount(creates.vitalsCatalog),
      vitalsCustom: asCount(creates.vitalsCustom),
      topHabits: topList(creates.topHabits),
      topVitals: topList(creates.topVitals),
    },
  }
}

/**
 * Unsigned journey, counted by anonymous id (includes people who later create an account), and
 * catalog vs custom creates. Counted in the database.
 */
export async function fetchGuestJourney(window: AnalyticsWindow): Promise<GuestJourneySummary> {
  return parseGuestJourney(await fetchAnalyticsSummary('guest_journey_summary', ANALYTICS_WINDOW_DAYS[window]))
}
