import type { Activity } from './activities'
import { rankResumable, tinyTimerMinutes, type FreshStartRange } from './comeback'
import { addDays } from './dates'
import type { ActivityPause } from './dayStatus'
import type { LogEntry } from './logs'

export type MomentKind = 'birthday' | 'month' | 'monday' | 'pause'

export type Moment = {
  id: string
  kind: MomentKind
  line: string
  activityId: string
  activityName: string
  minutes: number | null
}

function monthDay(date: string): string {
  return date.slice(5)
}

export function pickMoment(opts: {
  today: string
  birthday: string | null
  seen: readonly string[]
  activities: Activity[]
  entries: LogEntry[]
  pauses?: readonly ActivityPause[]
  restDates?: ReadonlySet<string>
  freshStarts?: readonly FreshStartRange[]
  showEverything?: boolean
  /** Welcome-back is already on screen. */
  welcomeBackVisible?: boolean
}): Moment | null {
  if (opts.welcomeBackVisible) return null
  const ranked = rankResumable(opts.activities, opts.entries, opts.today, {
    restDates: opts.restDates,
    pauses: opts.pauses,
    freshStarts: opts.freshStarts,
    showEverything: opts.showEverything,
  })
  const suggestion = ranked[0]
  if (!suggestion) return null
  const minutes = tinyTimerMinutes(suggestion)
  const seen = new Set(opts.seen)
  const dow = new Date(`${opts.today}T12:00:00Z`).getUTCDay()

  const candidates: Moment[] = []
  if (opts.birthday && monthDay(opts.birthday) === monthDay(opts.today)) {
    candidates.push({
      id: `birthday:${opts.today.slice(0, 4)}`,
      kind: 'birthday',
      line: 'Happy birthday. One small thing today?',
      activityId: suggestion.id,
      activityName: suggestion.name,
      minutes,
    })
  }
  if (opts.today.endsWith('-01')) {
    candidates.push({
      id: `month:${opts.today.slice(0, 7)}`,
      kind: 'month',
      line: 'New month. Pick one thing to resume.',
      activityId: suggestion.id,
      activityName: suggestion.name,
      minutes,
    })
  }
  if (dow === 1) {
    candidates.push({
      id: `monday:${opts.today}`,
      kind: 'monday',
      line: 'New week. Pick one thing to resume.',
      activityId: suggestion.id,
      activityName: suggestion.name,
      minutes,
    })
  }
  for (const pause of opts.pauses ?? []) {
    if (!pause.until) continue
    const ended = pause.until < opts.today && pause.until >= addDays(opts.today, -1)
    const length = Math.round(
      (Date.parse(`${pause.until}T12:00:00Z`) - Date.parse(`${pause.from}T12:00:00Z`)) / 86_400_000,
    )
    if (!ended || length < 3) continue
    const activity = opts.activities.find((row) => row.id === pause.activityId && !row.archived)
    if (!activity) continue
    candidates.push({
      id: `pause:${pause.activityId}:${pause.until}`,
      kind: 'pause',
      line:
        (tinyTimerMinutes(activity) ?? minutes) != null
          ? `Your pause on ${activity.name} ended. Ease back in with ${tinyTimerMinutes(activity) ?? minutes} minutes?`
          : `Your pause on ${activity.name} ended. Ease back in?`,
      activityId: activity.id,
      activityName: activity.name,
      minutes: tinyTimerMinutes(activity) ?? minutes,
    })
  }

  return candidates.find((moment) => !seen.has(moment.id)) ?? null
}
