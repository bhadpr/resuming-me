export type JourneyEvent = {
  name: string
  props?: unknown
  created_at?: string
  anon_id?: string | null
  user_id?: string | null
}

function prop(props: unknown, key: string): unknown {
  if (!props || typeof props !== 'object' || Array.isArray(props)) return undefined
  return (props as Record<string, unknown>)[key]
}

function personKey(event: JourneyEvent): string | null {
  return event.anon_id || event.user_id || null
}

function unique(events: JourneyEvent[], match: (event: JourneyEvent) => boolean): number {
  const ids = new Set<string>()
  for (const event of events) {
    if (!match(event)) continue
    const key = personKey(event)
    if (key) ids.add(key)
  }
  return ids.size
}

export type GuestJourney = {
  landing: number
  intentStarted: number
  setupStarted: number
  habitsPicked: number
  firstLog: number
  signInShown: number
  signups: number
}

/** Unsigned journey, counted by anonymous id. Includes people who later create an account. */
export function summarizeGuestJourney(events: JourneyEvent[]): GuestJourney {
  return {
    landing: unique(events, (event) => event.name === 'landing_viewed'),
    intentStarted: unique(events, (event) => event.name === 'intent_journey_started'),
    setupStarted: unique(events, (event) => event.name === 'onboarding_started'),
    habitsPicked: unique(events, (event) => {
      if (event.name !== 'onboarding_step_completed') return false
      const step = prop(event.props, 'step')
      return step === 1 || step === '1'
    }),
    firstLog: unique(events, (event) => {
      if (event.name !== 'log_created') return false
      const signedIn = prop(event.props, 'signed_in')
      if (signedIn === false) return true
      return signedIn == null && !event.user_id
    }),
    signInShown: unique(events, (event) => event.name === 'signin_shown'),
    signups: unique(events, (event) => event.name === 'signup_completed'),
  }
}

export type CreateCounts = {
  habitsCatalog: number
  habitsCustom: number
  vitalsCatalog: number
  vitalsCustom: number
  topHabits: { id: string; count: number }[]
  topVitals: { id: string; count: number }[]
}

const VITAL_IDS = new Set([
  'weight',
  'steps',
  'water',
  'sleep_hours',
  'fasting',
  'protein',
  'blood_pressure',
  'heart_rate',
])

function bump(map: Map<string, number>, id: string): void {
  map.set(id, (map.get(id) ?? 0) + 1)
}

function top(map: Map<string, number>): { id: string; count: number }[] {
  return [...map.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 8)
    .map(([id, count]) => ({ id, count }))
}

/** Catalog vs custom creates. Ignores events that have no template code yet. */
export function summarizeCreates(events: JourneyEvent[]): CreateCounts {
  const habits = new Map<string, number>()
  const vitals = new Map<string, number>()
  let habitsCatalog = 0
  let habitsCustom = 0
  let vitalsCatalog = 0
  let vitalsCustom = 0

  for (const event of events) {
    if (event.name !== 'activity_created' && event.name !== 'metric_created') continue
    const raw = prop(event.props, 'template_id')
    if (typeof raw !== 'string' || raw.length === 0) continue
    const custom = raw === 'custom'
    const vital = event.name === 'metric_created' || VITAL_IDS.has(raw)
    if (vital) {
      if (custom) vitalsCustom += 1
      else {
        vitalsCatalog += 1
        bump(vitals, raw)
      }
    } else if (custom) {
      habitsCustom += 1
    } else {
      habitsCatalog += 1
      bump(habits, raw)
    }
  }

  return {
    habitsCatalog,
    habitsCustom,
    vitalsCatalog,
    vitalsCustom,
    topHabits: top(habits),
    topVitals: top(vitals),
  }
}
