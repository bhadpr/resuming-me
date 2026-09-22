import type { Activity } from './activities'
import type { LogEntry } from './logs'
import { addDays, endOfMonth, parseLocalDate, startOfMonth, todayLocalDate } from './dates'
import { endOfWeekSunday, startOfWeekMonday } from './dates'
import {
  getDayStatus,
  isUserSkipped,
  showedUp,
  type DayStatus,
} from './dayStatus'

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
): ActivitySeriesPoint[] {
  const { from, to } = windowRange(window, today)
  return buildActivityInsightSeriesInRange(activity, entries, from, to, window, today)
}

/** Activity detail chart — supports 7 / 30 / 90 day windows. */
export function buildActivityInsightSeriesForDays(
  activity: Activity,
  entries: LogEntry[],
  windowDays: ActivityChartWindowDays,
  today = todayLocalDate(),
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
  )
}

function statusForPeriod(
  activity: Activity,
  entries: LogEntry[],
  date: string,
  today: string,
): { status: DayStatus; value: number; target: number } {
  return getDayStatus({
    activity,
    entriesForDay: entries,
    date,
    today,
    timezone: 'UTC',
  })
}

function buildActivityInsightSeriesInRange(
  activity: Activity,
  entries: LogEntry[],
  from: string,
  to: string,
  labelWindow: InsightsWindow,
  today = to,
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
    const { status, value } = statusForPeriod(activity, entries, date, today)
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
): Pick<ActivityInsight, 'scheduled' | 'postponed' | 'met' | 'showedUp'> {
  let scheduled = 0
  let postponed = 0
  let met = 0
  let showed = 0

  for (const date of dates) {
    scheduled += 1
    const { status } = statusForPeriod(activity, entries, date, today)
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
): Pick<ActivityInsight, 'scheduled' | 'postponed' | 'met' | 'showedUp'> {
  const created = activity.created_at.slice(0, 10)
  const start = created > from ? created : from
  return analyzePeriod(activity, entries, eachDateInclusive(start, to), today)
}

function analyzeWeekly(
  activity: Activity,
  entries: LogEntry[],
  from: string,
  to: string,
  today: string,
): Pick<ActivityInsight, 'scheduled' | 'postponed' | 'met' | 'showedUp'> {
  const created = activity.created_at.slice(0, 10)
  const dates: string[] = []
  let weekStart = startOfWeekMonday(from)
  while (weekStart <= to) {
    const weekEnd = endOfWeekSunday(weekStart)
    if (weekEnd >= created) dates.push(weekStart)
    weekStart = addDays(weekStart, 7)
  }
  return analyzePeriod(activity, entries, dates, today)
}

function analyzeMonthly(
  activity: Activity,
  entries: LogEntry[],
  from: string,
  to: string,
  today: string,
): Pick<ActivityInsight, 'scheduled' | 'postponed' | 'met' | 'showedUp'> {
  const created = activity.created_at.slice(0, 10)
  const dates: string[] = []
  let monthStart = startOfMonth(from)
  while (monthStart <= to) {
    const monthEnd = endOfMonth(monthStart)
    if (monthEnd >= created) dates.push(monthStart)
    monthStart = startOfMonth(addDays(monthEnd, 1))
  }
  return analyzePeriod(activity, entries, dates, today)
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

function buildSummary(
  window: InsightsWindow,
  completed: number,
  showed: number,
  total: number,
  mostPostponed: ActivityInsight[],
): string {
  const period = window === 'week' ? 'this week' : 'this month'
  if (total === 0) {
    return `No repeating activities ${period} yet. Log a few days and Insights will fill in.`
  }

  const top = mostPostponed
    .filter((a) => a.postponed > 0)
    .slice(0, 2)
    .map((a) => a.name)

  let text = `${completed} of ${total} done ${period}`
  if (showed > completed) {
    text += ` · ${showed} showed up`
  }
  text += '.'
  if (top.length === 1) {
    text += ` ${top[0]} is the one you keep putting off.`
  } else if (top.length >= 2) {
    text += ` ${top[0]} and ${top[1]} are the ones you keep putting off.`
  }
  return text
}

export function computeInsights(
  activities: Activity[],
  entries: LogEntry[],
  window: InsightsWindow,
  today = todayLocalDate(),
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
        ? analyzeWeekly(activity, entries, from, to, today)
        : activity.type === 'monthly'
          ? analyzeMonthly(activity, entries, from, to, today)
          : analyzeDaily(activity, entries, from, to, today)
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
    summary: buildSummary(
      window,
      completedScheduled,
      showedUpScheduled,
      totalScheduled,
      mostPostponed,
    ),
  }
}

export function formatPercent(rate: number): string {
  return `${Math.round(rate * 100)}%`
}
