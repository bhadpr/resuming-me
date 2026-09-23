import type { Activity } from './activities'
import type { LogEntry } from './logs'
import { coveragePhrase, freshStartCovering, type FreshStartRange } from './comeback'
import { addDays, endOfMonth, endOfWeekSunday, parseLocalDate, startOfMonth, startOfWeekMonday, todayLocalDate } from './dates'
import {
  getDayStatus,
  isUserSkipped,
  showedUp,
  type ActivityPause,
  type DayStatus,
} from './dayStatus'

export type DayStatusOpts = {
  restDates?: ReadonlySet<string>
  pauses?: readonly ActivityPause[]
  /** From onboarding, used until there are 5 logged days. */
  slipAnswer?: readonly string[]
  freshStarts?: readonly FreshStartRange[]
  showEverything?: boolean
}

export type InsightsWindow = 'week' | 'month'

export type ActivityChartWindowDays = 7 | 30 | 90

export const INSIGHTS_WINDOW_DAYS: Record<InsightsWindow, number> = {
  week: 7,
  month: 30,
}

export interface ActivityInsight {
  activityId: string
  name: string
  emoji: string
  type: Activity['type']
  scheduled: number
  postponed: number
  met: number
  /** done + partial */
  showedUp: number
  /** postponed / scheduled, 0 if nothing scheduled */
  postponementRate: number
}

export interface DayCount {
  key: string
  label: string
  count: number
}

export interface InsightsResult {
  window: InsightsWindow
  from: string
  to: string
  activities: ActivityInsight[]
  completedScheduled: number
  showedUpScheduled: number
  totalScheduled: number
  mostPostponed: ActivityInsight[]
  dayOfWeekSkips: DayCount[]
  peakSkipDay: DayCount | null
  sessionTimeBuckets: DayCount[]
  peakSessionBucket: DayCount | null
  summary: string
}

/** Chart status — includes partial/missed from getDayStatus. */
export type ActivityDayStatus = DayStatus | 'met' | 'postponed'

export interface ActivitySeriesPoint {
  key: string
  /** Short axis label */
  label: string
  date: string
  status: DayStatus
  /** Chart height basis: minutes for timer, completions for count/checkbox */
  value: number
  unit: string
}

const DOW_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function eachDateInclusive(from: string, to: string): string[] {
  const out: string[] = []
  let cursor = from
  while (cursor <= to) {
    out.push(cursor)
    cursor = addDays(cursor, 1)
  }
  return out
}

export function windowRange(
  window: InsightsWindow,
  today = todayLocalDate(),
): { from: string; to: string } {
  const days = INSIGHTS_WINDOW_DAYS[window]
  return { from: addDays(today, -(days - 1)), to: today }
}

function shortDateLabel(date: string): string {
  const d = parseLocalDate(date)
  return `${d.getMonth() + 1}/${d.getDate()}`
}

function dayLabel(date: string, window: InsightsWindow): string {
  if (window === 'week') return DOW_LABELS[parseLocalDate(date).getDay()]
  return shortDateLabel(date)
}

export interface ActivitySeriesStats {
  windowDays: ActivityChartWindowDays
  done: number
  partial: number
  skipped: number
  open: number
  min: number | null
  max: number | null
  avg: number | null
  unit: string
}

export function computeActivitySeriesStats(
  points: ActivitySeriesPoint[],
  windowDays: ActivityChartWindowDays,
): ActivitySeriesStats {
  const done = points.filter((p) => p.status === 'done').length
  const partial = points.filter((p) => p.status === 'partial').length
  const skipped = points.filter((p) => p.status === 'skipped').length
  const open = points.filter(
    (p) =>
      p.status === 'open' ||
      p.status === 'missed' ||
      p.status === 'rest' ||
      p.status === 'paused',
  ).length
  const unit = points[0]?.unit ?? ''
  const logged = points.filter((p) => p.value > 0).map((p) => p.value)

  if (logged.length === 0) {
    return {
      windowDays,
      done,
      partial,
      skipped,
      open,
      min: null,
      max: null,
      avg: null,
      unit,
    }
  }

  const min = Math.min(...logged)
  const max = Math.max(...logged)
  const avg = logged.reduce((a, b) => a + b, 0) / logged.length

  return { windowDays, done, partial, skipped, open, min, max, avg, unit }
}

/**
 * Day-by-day (or week-by-week for weekly_n) series for the Insights window chart.
 */
export function buildActivityInsightSeries(
  activity: Activity,
  entries: LogEntry[],
  window: InsightsWindow,
  today = todayLocalDate(),
  opts?: DayStatusOpts,
): ActivitySeriesPoint[] {
  const { from, to } = windowRange(window, today)
  return buildActivityInsightSeriesInRange(
    activity,
    entries,
    from,
    to,
    window,
    today,
    opts,
  )
}

/** Activity detail chart — supports 7 / 30 / 90 day windows. */
export function buildActivityInsightSeriesForDays(
  activity: Activity,
  entries: LogEntry[],
  windowDays: ActivityChartWindowDays,
  today = todayLocalDate(),
  opts?: DayStatusOpts,
): ActivitySeriesPoint[] {
  if (activity.type === 'deadline') return []
  const from = addDays(today, -(windowDays - 1))
  const to = today
  const labelWindow: InsightsWindow = windowDays === 7 ? 'week' : 'month'
  return buildActivityInsightSeriesInRange(
    activity,
    entries,
    from,
    to,
    labelWindow,
    today,
    opts,
  )
}

function statusForPeriod(
  activity: Activity,
  entries: LogEntry[],
  date: string,
  today: string,
  opts?: DayStatusOpts,
): { status: DayStatus; value: number; target: number } {
  return getDayStatus({
    activity,
    entriesForDay: entries,
    date,
    today,
    timezone: 'UTC',
    restDates: opts?.restDates,
    pauses: opts?.pauses,
  })
}

function buildActivityInsightSeriesInRange(
  activity: Activity,
  entries: LogEntry[],
  from: string,
  to: string,
  labelWindow: InsightsWindow,
  today = to,
  opts?: DayStatusOpts,
): ActivitySeriesPoint[] {
  const created = activity.created_at.slice(0, 10)

  if (activity.type === 'weekly_n') {
    const points: ActivitySeriesPoint[] = []
    let weekStart = startOfWeekMonday(from)
    while (weekStart <= to) {
      const weekEnd = endOfWeekSunday(weekStart)
      if (weekEnd >= created) {
        const { status, value } = statusForPeriod(
          activity,
          entries,
          weekStart,
          today,
          opts,
        )
        const isTimer = activity.tracking_mode === 'timer'
        points.push({
          key: weekStart,
          label: shortDateLabel(weekStart),
          date: weekStart,
          status,
          value: isTimer
            ? Math.round(
                entries
                  .filter(
                    (e) =>
                      e.activity_id === activity.id &&
                      e.type === 'session' &&
                      e.date >= weekStart &&
                      e.date <= weekEnd,
                  )
                  .reduce((s, e) => s + (e.duration_seconds ?? 0), 0) / 60,
              )
            : value,
          unit: isTimer ? 'min' : '×',
        })
      }
      weekStart = addDays(weekStart, 7)
    }
    return points
  }

  if (activity.type === 'monthly') {
    const points: ActivitySeriesPoint[] = []
    let monthStart = startOfMonth(from)
    while (monthStart <= to) {
      const monthEnd = endOfMonth(monthStart)
      if (monthEnd >= created) {
        const { status, value } = statusForPeriod(
          activity,
          entries,
          monthStart,
          today,
          opts,
        )
        points.push({
          key: monthStart,
          label: shortDateLabel(monthStart),
          date: monthStart,
          status,
          value,
          unit: '×',
        })
      }
      monthStart = startOfMonth(addDays(monthEnd, 1))
    }
    return points
  }

  // daily
  const start = created > from ? created : from
  const isTimer = activity.tracking_mode === 'timer'
  return eachDateInclusive(start, to).map((date) => {
    const { status, value } = statusForPeriod(
      activity,
      entries,
      date,
      today,
      opts,
    )
    return {
      key: date,
      label: dayLabel(date, labelWindow),
      date,
      status,
      value,
      unit: isTimer ? 'min' : 'done',
    }
  })
}

function analyzePeriod(
  activity: Activity,
  entries: LogEntry[],
  dates: string[],
  today: string,
  opts?: DayStatusOpts,
): Pick<ActivityInsight, 'scheduled' | 'postponed' | 'met' | 'showedUp'> {
  let scheduled = 0
  let postponed = 0
  let met = 0
  let showed = 0

  for (const date of dates) {
    if (!opts?.showEverything && freshStartCovering(date, opts?.freshStarts ?? [])) continue
    const { status } = statusForPeriod(activity, entries, date, today, opts)
    if (status === 'rest' || status === 'paused') continue
    scheduled += 1
    if (status === 'skipped') postponed += 1
    if (status === 'done') met += 1
    if (showedUp(status)) showed += 1
  }

  return { scheduled, postponed, met, showedUp: showed }
}

function analyzeDaily(
  activity: Activity,
  entries: LogEntry[],
  from: string,
  to: string,
  today: string,
  opts?: DayStatusOpts,
): Pick<ActivityInsight, 'scheduled' | 'postponed' | 'met' | 'showedUp'> {
  const created = activity.created_at.slice(0, 10)
  const start = created > from ? created : from
  return analyzePeriod(
    activity,
    entries,
    eachDateInclusive(start, to),
    today,
    opts,
  )
}

function analyzeWeekly(
  activity: Activity,
  entries: LogEntry[],
  from: string,
  to: string,
  today: string,
  opts?: DayStatusOpts,
): Pick<ActivityInsight, 'scheduled' | 'postponed' | 'met' | 'showedUp'> {
  const created = activity.created_at.slice(0, 10)
  const dates: string[] = []
  let weekStart = startOfWeekMonday(from)
  while (weekStart <= to) {
    const weekEnd = endOfWeekSunday(weekStart)
    if (weekEnd >= created) dates.push(weekStart)
    weekStart = addDays(weekStart, 7)
  }
  return analyzePeriod(activity, entries, dates, today, opts)
}

function analyzeMonthly(
  activity: Activity,
  entries: LogEntry[],
  from: string,
  to: string,
  today: string,
  opts?: DayStatusOpts,
): Pick<ActivityInsight, 'scheduled' | 'postponed' | 'met' | 'showedUp'> {
  const created = activity.created_at.slice(0, 10)
  const dates: string[] = []
  let monthStart = startOfMonth(from)
  while (monthStart <= to) {
    const monthEnd = endOfMonth(monthStart)
    if (monthEnd >= created) dates.push(monthStart)
    monthStart = startOfMonth(addDays(monthEnd, 1))
  }
  return analyzePeriod(activity, entries, dates, today, opts)
}

function buildDayOfWeekSkips(entries: LogEntry[], from: string, to: string): DayCount[] {
  const counts = [0, 0, 0, 0, 0, 0, 0]
  for (const e of entries) {
    if (!isUserSkipped(e)) continue
    if (e.date < from || e.date > to) continue
    const dow = parseLocalDate(e.date).getDay()
    counts[dow] += 1
  }
  return DOW_LABELS.map((label, key) => ({
    key: String(key),
    label,
    count: counts[key],
  }))
}

type TimeBucketKey = 'morning' | 'afternoon' | 'evening' | 'night'

const TIME_BUCKET_LABELS: Record<TimeBucketKey, string> = {
  morning: 'Morning',
  afternoon: 'Afternoon',
  evening: 'Evening',
  night: 'Night',
}

function hourBucket(hour: number): TimeBucketKey {
  if (hour >= 5 && hour < 12) return 'morning'
  if (hour >= 12 && hour < 17) return 'afternoon'
  if (hour >= 17 && hour < 21) return 'evening'
  return 'night'
}

const BUCKET_ORDER: TimeBucketKey[] = [
  'morning',
  'afternoon',
  'evening',
  'night',
]

function buildSessionTimeBuckets(
  entries: LogEntry[],
  from: string,
  to: string,
): DayCount[] {
  const counts: Record<TimeBucketKey, number> = {
    morning: 0,
    afternoon: 0,
    evening: 0,
    night: 0,
  }

  for (const e of entries) {
    if (e.type !== 'session' && e.type !== 'completed') continue
    if (e.date < from || e.date > to) continue
    const iso = e.started_at ?? e.created_at
    if (!iso) continue
    const hour = new Date(iso).getHours()
    counts[hourBucket(hour)] += 1
  }

  return BUCKET_ORDER.map((key) => ({
    key,
    label: TIME_BUCKET_LABELS[key],
    count: counts[key],
  }))
}

function peak(counts: DayCount[]): DayCount | null {
  const sorted = [...counts].sort((a, b) => b.count - a.count)
  if (!sorted[0] || sorted[0].count === 0) return null
  return sorted[0]
}

function loggedDayCount(entries: LogEntry[]): number {
  const days = new Set<string>()
  for (const entry of entries) {
    if (entry.type === 'session' || entry.type === 'completed') days.add(entry.date)
  }
  return days.size
}

/** Highest show-up rate, then fewer skips. */
export function mostResumableActivity(
  activities: readonly ActivityInsight[],
): ActivityInsight | null {
  const ranked = activities.filter((activity) => activity.scheduled > 0)
  if (ranked.length === 0) return null
  ranked.sort((a, b) => {
    const rateA = a.showedUp / a.scheduled
    const rateB = b.showedUp / b.scheduled
    if (rateB !== rateA) return rateB - rateA
    if (a.postponed !== b.postponed) return a.postponed - b.postponed
    return a.name.localeCompare(b.name)
  })
  return ranked[0] ?? null
}

function formatSlip(slip: readonly string[]): string {
  if (slip.length === 1) return slip[0] ?? ''
  return `${slip[0]} and ${slip[1]}`
}

/**
 * Lead with what is easiest to resume.
 * Do not open with "0 of …" or a failure percentage.
 * Slip answers stand in until five distinct logged days.
 */
function buildSummary(
  window: InsightsWindow,
  total: number,
  activities: ActivityInsight[],
  entries: LogEntry[],
  slipAnswer?: readonly string[],
): string {
  const period = window === 'week' ? 'this week' : 'this month'
  if (total === 0) {
    return `No repeating activities ${period} yet. Log a few days and Insights will fill in.`
  }

  const loggedDays = loggedDayCount(entries)
  const slip = (slipAnswer ?? []).filter(Boolean).slice(0, 2)
  const useSlip = loggedDays < 5 && slip.length > 0
  const easiest = mostResumableActivity(activities)
  const slipsMost = [...activities]
    .filter((activity) => activity.postponed > 0)
    .sort((a, b) => b.postponed - a.postponed)[0]

  const parts: string[] = []
  if (useSlip) {
    parts.push(`You said it usually slips ${formatSlip(slip)}.`)
  }
  if (easiest && easiest.showedUp > 0) {
    parts.push(`${easiest.name} looks easiest to pick back up.`)
  } else if (easiest) {
    parts.push(`${easiest.name} is a small enough place to start.`)
  }
  if (!useSlip && slipsMost && slipsMost.name !== easiest?.name) {
    parts.push(`${slipsMost.name} is the one that slips most.`)
  }
  if (parts.length === 0) {
    return `Log a few days ${period} and Insights will fill in.`
  }
  return parts.join(' ')
}

export function computeInsights(
  activities: Activity[],
  entries: LogEntry[],
  window: InsightsWindow,
  today = todayLocalDate(),
  opts?: DayStatusOpts,
): InsightsResult {
  const { from, to } = windowRange(window, today)
  const trackable = activities.filter(
    (a) =>
      !a.archived &&
      (a.type === 'daily' || a.type === 'weekly_n' || a.type === 'monthly'),
  )

  const activityInsights: ActivityInsight[] = trackable.map((activity) => {
    const stats =
      activity.type === 'weekly_n'
        ? analyzeWeekly(activity, entries, from, to, today, opts)
        : activity.type === 'monthly'
          ? analyzeMonthly(activity, entries, from, to, today, opts)
          : analyzeDaily(activity, entries, from, to, today, opts)
    const postponementRate =
      stats.scheduled === 0 ? 0 : stats.postponed / stats.scheduled
    return {
      activityId: activity.id,
      name: activity.name,
      emoji: activity.emoji,
      type: activity.type,
      ...stats,
      postponementRate,
    }
  })

  activityInsights.sort((a, b) => {
    if (b.postponementRate !== a.postponementRate) {
      return b.postponementRate - a.postponementRate
    }
    return b.postponed - a.postponed
  })

  const totalScheduled = activityInsights.reduce((s, a) => s + a.scheduled, 0)
  const completedScheduled = activityInsights.reduce((s, a) => s + a.met, 0)
  const showedUpScheduled = activityInsights.reduce((s, a) => s + a.showedUp, 0)
  const mostPostponed = [...activityInsights].sort(
    (a, b) => b.postponed - a.postponed || b.postponementRate - a.postponementRate,
  )

  const dayOfWeekSkips = buildDayOfWeekSkips(entries, from, to)
  const sessionTimeBuckets = buildSessionTimeBuckets(entries, from, to)

  return {
    window,
    from,
    to,
    activities: activityInsights,
    completedScheduled,
    showedUpScheduled,
    totalScheduled,
    mostPostponed,
    dayOfWeekSkips,
    peakSkipDay: peak(dayOfWeekSkips),
    sessionTimeBuckets,
    peakSessionBucket: peak(sessionTimeBuckets),
    summary: [
      buildSummary(
        window,
        totalScheduled,
        activityInsights,
        entries,
        opts?.slipAnswer,
      ),
      coveragePhrase(opts?.freshStarts ?? [], from, to, opts?.showEverything),
    ]
      .filter(Boolean)
      .join(' '),
  }
}

export function formatPercent(rate: number): string {
  return `${Math.round(rate * 100)}%`
}
