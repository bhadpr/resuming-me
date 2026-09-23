export type FunnelEvent = {
  name: string
  props?: unknown
  created_at: string
  anon_id?: string | null
  user_id?: string | null
}

function prop(props: unknown, key: string): unknown {
  if (!props || typeof props !== 'object' || Array.isArray(props)) return undefined
  return (props as Record<string, unknown>)[key]
}

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

function personKey(event: FunnelEvent): string {
  return event.anon_id || event.user_id || event.created_at
}

function unique(events: FunnelEvent[], name: string): number {
  const ids = new Set<string>()
  for (const event of events) {
    if (event.name === name) ids.add(personKey(event))
  }
  return ids.size
}

function median(values: number[]): number | null {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  if (sorted.length % 2 === 1) return sorted[mid] ?? null
  const left = sorted[mid - 1] ?? 0
  const right = sorted[mid] ?? 0
  return Math.round((left + right) / 2)
}

function utcDay(iso: string): string {
  return iso.slice(0, 10)
}

function daySpan(fromIso: string, toIso: string): number {
  const from = Date.parse(`${utcDay(fromIso)}T00:00:00Z`)
  const to = Date.parse(`${utcDay(toIso)}T00:00:00Z`)
  if (!Number.isFinite(from) || !Number.isFinite(to)) return -1
  return Math.round((to - from) / 86_400_000)
}

/** Admin cards for the onboarding funnel and first-week logging. */
export function summarizeOnboardingFunnel(events: FunnelEvent[]): OnboardingFunnel {
  const steps = [1, 2, 3, 4, 5, 6, 7, 8].map((step) => {
    const ids = new Set<string>()
    for (const event of events) {
      if (event.name !== 'onboarding_step_completed') continue
      const raw = prop(event.props, 'step')
      const value = typeof raw === 'number' ? raw : Number(raw)
      if (value === step) ids.add(personKey(event))
    }
    return { step, people: ids.size }
  })

  const startedAt = new Map<string, number>()
  for (const event of events) {
    if (event.name !== 'onboarding_started') continue
    const key = personKey(event)
    const at = Date.parse(event.created_at)
    const prev = startedAt.get(key)
    if (!Number.isFinite(at)) continue
    if (prev == null || at < prev) startedAt.set(key, at)
  }

  const resumedAt = new Map<string, number>()
  for (const event of events) {
    if (event.name !== 'onboarding_timer_completed' && event.name !== 'log_created') continue
    const key = personKey(event)
    const at = Date.parse(event.created_at)
    const prev = resumedAt.get(key)
    if (!Number.isFinite(at)) continue
    if (prev == null || at < prev) resumedAt.set(key, at)
  }

  const durations: number[] = []
  for (const [key, start] of startedAt) {
    const done = resumedAt.get(key)
    if (done == null || done < start) continue
    durations.push(Math.round((done - start) / 1000))
  }

  let reminderSet = 0
  let reminderNone = 0
  const reminderPeople = new Set<string>()
  for (const event of events) {
    if (event.name !== 'onboarding_reminder_set') continue
    const key = personKey(event)
    if (reminderPeople.has(key)) continue
    reminderPeople.add(key)
    const time = prop(event.props, 'time')
    if (time === 'none' || time == null) reminderNone += 1
    else reminderSet += 1
  }

  const signups = events.filter((event) => event.name === 'signup_completed' && event.user_id)
  const cohort = new Set(signups.map((event) => event.user_id as string))
  const firstSignup = new Map<string, string>()
  for (const event of signups) {
    const id = event.user_id as string
    const prev = firstSignup.get(id)
    if (!prev || event.created_at < prev) firstSignup.set(id, event.created_at)
  }

  const logged = { 2: new Set<string>(), 3: new Set<string>(), 7: new Set<string>() }
  for (const event of events) {
    if (event.name !== 'log_created' || !event.user_id) continue
    const signup = firstSignup.get(event.user_id)
    if (!signup) continue
    const span = daySpan(signup, event.created_at)
    if (span === 2 || span === 3 || span === 7) logged[span].add(event.user_id)
  }

  return {
    started: unique(events, 'onboarding_started'),
    steps,
    timerStarted: unique(events, 'onboarding_timer_started'),
    timerCompleted: unique(events, 'onboarding_timer_completed'),
    timerSkipped: unique(events, 'onboarding_timer_skipped'),
    reminderSet,
    reminderNone,
    signinShown: unique(events, 'signin_shown'),
    signups: cohort.size,
    medianSecondsToFirstResume: median(durations),
    loggedDay2: logged[2].size,
    loggedDay3: logged[3].size,
    loggedDay7: logged[7].size,
    signupCohort: cohort.size,
  }
}
