import type { Activity } from './activities'
import {
  currentQuietRun,
  freshStartCovering,
  isQuietStatus,
  isShowedUpStatus,
  type FreshStartRange,
} from './comeback.ts'
import { addDays } from './dates.ts'
import { getDayStatus, type ActivityPause, type DayStatus } from './dayStatus.ts'
import type { LogEntry } from './logs'
import type { Metric } from './metrics'
import type { MetricEntry } from './metricEntries'

export type PatternKind =
  | 'weekday'
  | 'timeOfDay'
  | 'activityGap'
  | 'numberLink'
  | 'sizeEffect'
  | 'restEffect'
  | 'slip'

export type Pattern = {
  kind: PatternKind
  text: string
  confidence: number
  evidenceCount: number
  earlyGuess: boolean
  activityId?: string
}

const CAUSAL = /\b(because|causes|makes you)\b/i
const WEEKDAY = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const LOOKBACK_DAYS = 56

export function patternTextIsCausal(text: string): boolean {
  return CAUSAL.test(text)
}

type DayOpts = {
  restDates?: ReadonlySet<string>
  pauses?: readonly ActivityPause[]
  freshStarts?: readonly FreshStartRange[]
  showEverything?: boolean
}

function hidden(date: string, opts?: DayOpts): boolean {
  if (opts?.showEverything) return false
  return freshStartCovering(date, opts?.freshStarts ?? []) != null
}

function statusOn(
  activity: Activity,
  entries: LogEntry[],
  date: string,
  today: string,
  opts?: DayOpts,
): DayStatus {
  return getDayStatus({
    activity,
    entriesForDay: entries.filter((entry) => entry.activity_id === activity.id),
    date,
    today,
    timezone: 'UTC',
    restDates: opts?.restDates,
    pauses: opts?.pauses,
  }).status
}

function rate(hits: number, total: number): number {
  if (total === 0) return 0
  return hits / total
}

export function weekdayPattern(
  activities: Activity[],
  entries: LogEntry[],
  today: string,
  opts?: DayOpts,
): Pattern | null {
  const counts = WEEKDAY.map(() => ({ missed: 0, scheduled: 0 }))
  const from = addDays(today, -(LOOKBACK_DAYS - 1))
  for (const activity of activities) {
    if (activity.archived || activity.type === 'deadline') continue
    const created = activity.created_at.slice(0, 10)
    for (let date = from > created ? from : created; date < today; date = addDays(date, 1)) {
      if (hidden(date, opts)) continue
      const status = statusOn(activity, entries, date, today, opts)
      if (status === 'rest' || status === 'paused' || status === 'skipped' || status === 'open') {
        continue
      }
      const dow = new Date(`${date}T12:00:00Z`).getUTCDay()
      counts[dow].scheduled += 1
      if (isQuietStatus(status)) counts[dow].missed += 1
    }
  }
  const ranked = counts
    .map((row, index) => ({
      index,
      ...row,
      slip: rate(row.missed, row.scheduled),
    }))
    .filter((row) => row.scheduled > 0)
    .sort((a, b) => b.slip - a.slip || b.scheduled - a.scheduled)
  const worst = ranked[0]
  const best = ranked[ranked.length - 1]
  if (!worst || !best || worst.index === best.index) return null
  const gap = worst.slip - best.slip
  if (gap < 0.2) return null
  const name = WEEKDAY[worst.index]
  if (worst.scheduled < 5) {
    if (worst.scheduled < 2) return null
    return {
      kind: 'weekday',
      text: `Do ${name}s slip more than other days? Early guess.`,
      confidence: worst.scheduled / 5,
      evidenceCount: worst.scheduled,
      earlyGuess: true,
    }
  }
  return {
    kind: 'weekday',
    text: `${name}s slip the most. You miss them more often than ${WEEKDAY[best.index]}s.`,
    confidence: gap,
    evidenceCount: worst.scheduled,
    earlyGuess: false,
  }
}

const BUCKETS = [
  { id: 'morning', label: 'in the morning', from: 5, to: 12 },
  { id: 'afternoon', label: 'in the afternoon', from: 12, to: 17 },
  { id: 'evening', label: 'in the evening', from: 17, to: 22 },
  { id: 'night', label: 'at night', from: 22, to: 29 },
] as const

function bucketFor(hour: number): (typeof BUCKETS)[number] {
  const h = ((hour % 24) + 24) % 24
  return BUCKETS.find((bucket) => h >= bucket.from && h < bucket.to) ?? BUCKETS[3]
}

export function timeOfDayPattern(hours: readonly number[]): Pattern | null {
  if (hours.length < 2) return null
  const counts = new Map<string, number>()
  for (const hour of hours) {
    const bucket = bucketFor(hour)
    counts.set(bucket.id, (counts.get(bucket.id) ?? 0) + 1)
  }
  const ranked = [...counts.entries()].sort((a, b) => b[1] - a[1])
  const top = ranked[0]
  const second = ranked[1]?.[1] ?? 0
  if (!top) return null
  const share = top[1] / hours.length
  const nextShare = second / hours.length
  if (share - nextShare < 0.2) return null
  const label = BUCKETS.find((bucket) => bucket.id === top[0])?.label ?? 'then'
  if (hours.length < 5) {
    return {
      kind: 'timeOfDay',
      text: `You may show up ${label}. Early guess.`,
      confidence: hours.length / 5,
      evidenceCount: hours.length,
      earlyGuess: true,
    }
  }
  return {
    kind: 'timeOfDay',
    text: `You usually show up ${label}.`,
    confidence: share - nextShare,
    evidenceCount: hours.length,
    earlyGuess: false,
  }
}

export function activityGapPattern(
  gaps: readonly { activityId: string; name: string; quietDays: number }[],
): Pattern | null {
  const top = [...gaps].sort((a, b) => b.quietDays - a.quietDays)[0]
  if (!top || top.quietDays < 1) return null
  const days = top.quietDays === 1 ? 'day' : 'days'
  return {
    kind: 'activityGap',
    text: `${top.name} has been quiet for ${top.quietDays} ${days}.`,
    confidence: Math.min(1, top.quietDays / 7),
    evidenceCount: top.quietDays,
    earlyGuess: false,
    activityId: top.activityId,
  }
}

export function numberLinkPattern(
  days: readonly { value: number; showedUp: boolean }[],
  lowBelow = 6,
): Pattern | null {
  if (days.length < 10) return null
  const low = days.filter((day) => day.value < lowBelow)
  const rest = days.filter((day) => day.value >= lowBelow)
  if (low.length === 0 || rest.length === 0) return null
  const lowRate = rate(low.filter((day) => day.showedUp).length, low.length)
  const restRate = rate(rest.filter((day) => day.showedUp).length, rest.length)
  if (Math.abs(restRate - lowRate) < 0.2) return null
  const half =
    restRate > 0 && lowRate / restRate >= 0.4 && lowRate / restRate <= 0.6
  const text = half
    ? 'On days after less than 6 hours of sleep, you showed up about half as often.'
    : lowRate < restRate
      ? 'On days you logged under 6 hours of sleep, you showed up less often than on other days.'
      : 'On days you logged under 6 hours of sleep, you showed up more often than on other days.'
  return {
    kind: 'numberLink',
    text,
    confidence: Math.abs(restRate - lowRate),
    evidenceCount: days.length,
    earlyGuess: false,
  }
}

export function sizeEffectPattern(
  days: readonly { target: number; showedUp: boolean }[],
): Pattern | null {
  if (days.length < 10) return null
  const targets = [...new Set(days.map((day) => day.target))].sort((a, b) => a - b)
  if (targets.length < 2) return null
  const smallTarget = targets[0]
  const largeTarget = targets[targets.length - 1]
  const small = days.filter((day) => day.target === smallTarget)
  const large = days.filter((day) => day.target === largeTarget)
  if (small.length === 0 || large.length === 0) return null
  const smallRate = rate(small.filter((day) => day.showedUp).length, small.length)
  const largeRate = rate(large.filter((day) => day.showedUp).length, large.length)
  if (smallRate - largeRate < 0.2) return null
  return {
    kind: 'sizeEffect',
    text: 'Days with a smaller target were finished more often than days with a larger one.',
    confidence: smallRate - largeRate,
    evidenceCount: days.length,
    earlyGuess: false,
  }
}

export function restEffectPattern(
  days: readonly { afterRest: boolean; showedUp: boolean }[],
): Pattern | null {
  const after = days.filter((day) => day.afterRest)
  const other = days.filter((day) => !day.afterRest)
  if (after.length < 8 || other.length === 0) return null
  const afterRate = rate(after.filter((day) => day.showedUp).length, after.length)
  const otherRate = rate(other.filter((day) => day.showedUp).length, other.length)
  if (Math.abs(afterRate - otherRate) < 0.2) return null
  const text =
    afterRate > otherRate
      ? 'The day after a rest day, you showed up more often.'
      : 'The day after a rest day, you showed up less often.'
  return {
    kind: 'restEffect',
    text,
    confidence: Math.abs(afterRate - otherRate),
    evidenceCount: after.length,
    earlyGuess: false,
  }
}

export function slipPlaceholder(slipAnswer: string | null | undefined): Pattern | null {
  const slip = slipAnswer?.trim()
  if (!slip || /^not sure$/i.test(slip)) return null
  return {
    kind: 'slip',
    text: `You mentioned ${slip.toLowerCase()} as when things slip. Early guess.`,
    confidence: 0.1,
    evidenceCount: 0,
    earlyGuess: true,
  }
}

export function selectPatterns(patterns: readonly Pattern[], limit = 2): Pattern[] {
  const real = patterns.filter((pattern) => pattern.kind !== 'slip')
  const pool = real.length > 0 ? real : patterns
  return [...pool]
    .sort((a, b) => b.confidence - a.confidence || b.evidenceCount - a.evidenceCount)
    .slice(0, limit)
}

function sessionHour(entry: LogEntry): number | null {
  const stamp = entry.started_at ?? entry.created_at
  if (!stamp) return null
  const date = new Date(stamp)
  if (Number.isNaN(date.getTime())) return null
  return date.getHours()
}

export function findPatterns(opts: {
  activities: Activity[]
  entries: LogEntry[]
  metrics?: Metric[]
  metricEntries?: MetricEntry[]
  today: string
  slipAnswer?: string | null
  restDates?: ReadonlySet<string>
  pauses?: readonly ActivityPause[]
  freshStarts?: readonly FreshStartRange[]
  showEverything?: boolean
  sizedDays?: readonly { target: number; showedUp: boolean }[]
}): Pattern[] {
  const dayOpts: DayOpts = opts
  const weekday = weekdayPattern(opts.activities, opts.entries, opts.today, dayOpts)
  const hours = opts.entries
    .filter((entry) => entry.type === 'session' && (entry.duration_seconds ?? 0) > 0)
    .map(sessionHour)
    .filter((hour): hour is number => hour != null)
  const time = timeOfDayPattern(hours)
  const gaps = opts.activities
    .filter((activity) => !activity.archived && activity.type !== 'deadline')
    .map((activity) => ({
      activityId: activity.id,
      name: activity.name,
      quietDays: currentQuietRun(activity, opts.entries, opts.today, dayOpts),
    }))
  const gap = activityGapPattern(gaps)
  const sleep = (opts.metrics ?? []).find(
    (metric) => /sleep/i.test(metric.name) || /^(hrs|hours)$/i.test(metric.unit),
  )
  const sleepDays =
    sleep == null
      ? []
      : (opts.metricEntries ?? [])
          .filter((entry) => entry.metric_id === sleep.id)
          .map((entry) => {
            const living = opts.activities.filter(
              (activity) =>
                !activity.archived &&
                activity.type !== 'deadline' &&
                activity.created_at.slice(0, 10) <= entry.date,
            )
            if (living.length === 0 || hidden(entry.date, dayOpts)) return null
            const showedUp = living.some((activity) =>
              isShowedUpStatus(statusOn(activity, opts.entries, entry.date, opts.today, dayOpts)),
            )
            return { value: entry.value, showedUp }
          })
          .filter((day): day is { value: number; showedUp: boolean } => day != null)
  const linked = numberLinkPattern(sleepDays)
  const sized = sizeEffectPattern(opts.sizedDays ?? [])
  const restDays: { afterRest: boolean; showedUp: boolean }[] = []
  if (opts.restDates && opts.restDates.size > 0) {
    const active = opts.activities.filter((activity) => !activity.archived && activity.type !== 'deadline')
    const from = addDays(opts.today, -(LOOKBACK_DAYS - 1))
    for (let date = from; date < opts.today; date = addDays(date, 1)) {
      if (hidden(date, dayOpts)) continue
      const living = active.filter((activity) => activity.created_at.slice(0, 10) <= date)
      if (living.length === 0) continue
      const showedUp = living.some((activity) =>
        isShowedUpStatus(statusOn(activity, opts.entries, date, opts.today, dayOpts)),
      )
      const missed = living.some((activity) =>
        isQuietStatus(statusOn(activity, opts.entries, date, opts.today, dayOpts)),
      )
      if (!showedUp && !missed) continue
      restDays.push({ afterRest: opts.restDates.has(addDays(date, -1)), showedUp })
    }
  }
  const rested = restEffectPattern(restDays)
  const found = [weekday, time, gap, linked, sized, rested].filter(
    (pattern): pattern is Pattern => pattern != null,
  )
  if (found.length === 0) {
    const slip = slipPlaceholder(opts.slipAnswer)
    return slip ? [slip] : []
  }
  return selectPatterns(found)
}
