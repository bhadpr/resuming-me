import type { Activity } from './activities'
import {
  currentQuietRun,
  freshStartCovering,
  isShowedUpStatus,
  listAccountComebacks,
  rankResumable,
  tinyTimerMinutes,
  type ComebackHit,
  type FreshStartRange,
} from './comeback.ts'
import { addDays } from './dates.ts'
import { getDayStatus, type ActivityPause } from './dayStatus.ts'
import type { LogEntry } from './logs'
import type { Metric } from './metrics'
import type { MetricEntry } from './metricEntries'
import { findPatterns, type Pattern } from './patterns.ts'

export type ReviewSchedule = {
  weekday: number
  hour: number
  minute: number
}

export const DEFAULT_REVIEW_SCHEDULE: ReviewSchedule = {
  weekday: 0,
  hour: 18,
  minute: 0,
}

export const REVIEW_WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

export type ReviewSlip = {
  activityId: string
  name: string
  quietDays: number
  shrinkTo: number | null
  shrinkUnit: string | null
}

export type WeeklyReview = {
  weekStart: string
  weekEnd: string
  showedUpDays: number
  headline: string
  comebackLine: string
  comebacks: ComebackHit[]
  steadiestName: string | null
  slipped: ReviewSlip[]
  pattern: Pattern | null
  focus: { id: string; name: string }[]
  firstWeek: boolean
}

export function nextFocusWeekStart(reviewedWeekStart: string): string {
  return addDays(reviewedWeekStart, 7)
}

/** True when today falls in the week the focus was chosen for. */
export function focusApplies(focusWeekStart: string | null, today: string): boolean {
  if (!focusWeekStart) return false
  return mondayOnOrBefore(today) === focusWeekStart
}

export function mondayOnOrBefore(date: string): string {
  const day = new Date(`${date}T12:00:00Z`).getUTCDay()
  const delta = day === 0 ? 6 : day - 1
  return addDays(date, -delta)
}

export function zonedClock(
  now: Date,
  timeZone: string,
): { date: string; weekday: number; minutes: number } {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  })
  const parts = Object.fromEntries(fmt.formatToParts(now).map((part) => [part.type, part.value]))
  const weekday = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(parts.weekday ?? '')
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    weekday: weekday < 0 ? 0 : weekday,
    minutes: Number(parts.hour) * 60 + Number(parts.minute),
  }
}

/** The review card stays up for 48 hours after the scheduled local time. */
export function activeReviewWindow(opts: {
  now: Date
  timeZone: string
  schedule?: ReviewSchedule
  reviewsOff?: boolean
}): { weekStart: string; weekEnd: string } | null {
  if (opts.reviewsOff) return null
  const schedule = opts.schedule ?? DEFAULT_REVIEW_SCHEDULE
  const zoned = zonedClock(opts.now, opts.timeZone)
  const scheduled = schedule.hour * 60 + schedule.minute
  let daysBack = (zoned.weekday - schedule.weekday + 7) % 7
  if (daysBack === 0 && zoned.minutes < scheduled) daysBack = 7
  const elapsed = daysBack * 24 * 60 + (zoned.minutes - scheduled)
  if (elapsed < 0 || elapsed > 48 * 60) return null
  const reviewDate = addDays(zoned.date, -daysBack)
  const weekStart = mondayOnOrBefore(reviewDate)
  return { weekStart, weekEnd: addDays(weekStart, 6) }
}

export function shrinkOffer(
  activity: Pick<Activity, 'tracking_mode' | 'target_value' | 'target_unit' | 'type'>,
): { value: number; unit: string } | null {
  if (activity.type === 'deadline' || activity.type === 'weekly_n') return null
  if (activity.tracking_mode === 'timer') {
    const minutes = tinyTimerMinutes({ ...activity, type: 'daily' })
    const current =
      activity.target_unit === 'seconds'
        ? Math.round((activity.target_value ?? 0) / 60)
        : (activity.target_value ?? 0)
    if (current > 5) return { value: 5, unit: 'minutes' }
    if (minutes != null && current > minutes) return { value: minutes, unit: 'minutes' }
    return null
  }
  if (activity.tracking_mode === 'count') {
    const current = activity.target_value ?? 0
    if (current > 2) return { value: 2, unit: activity.target_unit ?? '' }
  }
  return null
}

function showedUpOn(
  activity: Activity,
  entries: LogEntry[],
  date: string,
  today: string,
  opts: { restDates?: ReadonlySet<string>; pauses?: readonly ActivityPause[] },
): boolean {
  return isShowedUpStatus(
    getDayStatus({
      activity,
      entriesForDay: entries.filter((entry) => entry.activity_id === activity.id),
      date,
      today,
      timezone: 'UTC',
      restDates: opts.restDates,
      pauses: opts.pauses,
    }).status,
  )
}

export function buildWeeklyReview(opts: {
  activities: Activity[]
  entries: LogEntry[]
  metrics?: Metric[]
  metricEntries?: MetricEntry[]
  today: string
  weekStart: string
  restDates?: ReadonlySet<string>
  pauses?: readonly ActivityPause[]
  freshStarts?: readonly FreshStartRange[]
  showEverything?: boolean
  slipAnswer?: string | null
}): WeeklyReview {
  const weekEnd = addDays(opts.weekStart, 6)
  const last = weekEnd < opts.today ? weekEnd : opts.today
  const dayOpts = {
    restDates: opts.restDates,
    pauses: opts.pauses,
    freshStarts: opts.freshStarts,
    showEverything: opts.showEverything,
  }
  const active = opts.activities.filter((activity) => !activity.archived && activity.type !== 'deadline')
  let showedUpDays = 0
  for (let date = opts.weekStart; date <= last; date = addDays(date, 1)) {
    if (!opts.showEverything && freshStartCovering(date, opts.freshStarts ?? [])) continue
    const living = active.filter((activity) => activity.created_at.slice(0, 10) <= date)
    if (living.some((activity) => showedUpOn(activity, opts.entries, date, opts.today, dayOpts))) {
      showedUpDays += 1
    }
  }

  const comebacks = listAccountComebacks(opts.activities, opts.entries, opts.today, 21, dayOpts).filter(
    (hit) => hit.date >= opts.weekStart && hit.date <= weekEnd,
  )
  const comebackLine =
    comebacks.length === 0
      ? 'No comebacks this week.'
      : `${comebacks.length} comeback${comebacks.length === 1 ? '' : 's'} — ${comebacks
          .map((hit) => `${hit.name} after ${hit.gapDays} quiet days`)
          .join(', ')}.`

  let steadiestName: string | null = null
  let steadiestRate = -1
  for (const activity of active) {
    let scheduled = 0
    let showed = 0
    const created = activity.created_at.slice(0, 10)
    for (let date = opts.weekStart; date <= last; date = addDays(date, 1)) {
      if (date < created) continue
      if (!opts.showEverything && freshStartCovering(date, opts.freshStarts ?? [])) continue
      const status = getDayStatus({
        activity,
        entriesForDay: opts.entries.filter((entry) => entry.activity_id === activity.id),
        date,
        today: opts.today,
        timezone: 'UTC',
        restDates: opts.restDates,
        pauses: opts.pauses,
      }).status
      if (status === 'rest' || status === 'paused' || status === 'skipped' || status === 'open') continue
      scheduled += 1
      if (isShowedUpStatus(status)) showed += 1
    }
    if (scheduled === 0) continue
    const score = showed / scheduled
    if (score > steadiestRate) {
      steadiestRate = score
      steadiestName = activity.name
    }
  }

  const slipped = active
    .map((activity) => {
      const quietDays = currentQuietRun(activity, opts.entries, opts.today, dayOpts)
      const offer = shrinkOffer(activity)
      return {
        activityId: activity.id,
        name: activity.name,
        quietDays,
        shrinkTo: offer?.value ?? null,
        shrinkUnit: offer?.unit ?? null,
      }
    })
    .filter((row) => row.quietDays >= 2)
    .sort((a, b) => b.quietDays - a.quietDays)
    .slice(0, 2)

  const earliest = active.reduce<string | null>((min, activity) => {
    const created = activity.created_at.slice(0, 10)
    return min == null || created < min ? created : min
  }, null)

  const pattern = findPatterns({
    activities: opts.activities,
    entries: opts.entries,
    metrics: opts.metrics,
    metricEntries: opts.metricEntries,
    today: opts.today,
    slipAnswer: opts.slipAnswer,
    ...dayOpts,
  })[0] ?? null

  const focus = rankResumable(opts.activities, opts.entries, opts.today, {
    ...dayOpts,
    preferredTimes: opts.slipAnswer ? [opts.slipAnswer] : [],
  })
    .slice(0, 3)
    .map((activity) => ({ id: activity.id, name: activity.name }))

  return {
    weekStart: opts.weekStart,
    weekEnd,
    showedUpDays,
    headline:
      showedUpDays === 0
        ? 'Quiet week. It happens.'
        : `You showed up ${showedUpDays} day${showedUpDays === 1 ? '' : 's'} this week.`,
    comebackLine,
    comebacks,
    steadiestName,
    slipped,
    pattern,
    focus,
    firstWeek: earliest != null && earliest >= opts.weekStart,
  }
}
