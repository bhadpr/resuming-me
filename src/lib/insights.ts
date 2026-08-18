import type { Activity } from './activities'
import type { LogEntry } from './logs'
import { addDays, endOfMonth, parseLocalDate, startOfMonth, todayLocalDate } from './dates'
import { dailyTargetMet, monthlyTargetMet, weeklyTargetMet } from './rollover'
import { endOfWeekSunday, startOfWeekMonday } from './dates'
import { sumSessionSeconds } from './timer'

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
  totalScheduled: number
  mostPostponed: ActivityInsight[]
  dayOfWeekSkips: DayCount[]
  peakSkipDay: DayCount | null
  sessionTimeBuckets: DayCount[]
  peakSessionBucket: DayCount | null
  summary: string
}

export type ActivityDayStatus = 'met' | 'postponed' | 'open'

export interface ActivitySeriesPoint {
  key: string
  /** Short axis label */
  label: string
  date: string
  status: ActivityDayStatus
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
  const done = points.filter((p) => p.status === 'met').length
  const skipped = points.filter((p) => p.status === 'postponed').length
  const open = points.filter((p) => p.status === 'open').length
  const unit = points[0]?.unit ?? ''
  const logged = points.filter((p) => p.value > 0).map((p) => p.value)

  if (logged.length === 0) {
    return { windowDays, done, skipped, open, min: null, max: null, avg: null, unit }
  }

  const min = Math.min(...logged)
  const max = Math.max(...logged)
  const avg = logged.reduce((a, b) => a + b, 0) / logged.length

  return { windowDays, done, skipped, open, min, max, avg, unit }
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
  return buildActivityInsightSeriesInRange(activity, entries, from, to, window)
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
  return buildActivityInsightSeriesInRange(activity, entries, from, to, labelWindow)
}

function buildActivityInsightSeriesInRange(
  activity: Activity,
  entries: LogEntry[],
  from: string,
  to: string,
  labelWindow: InsightsWindow,
): ActivitySeriesPoint[] {
  const created = activity.created_at.slice(0, 10)

  if (activity.type === 'weekly_n') {
    const points: ActivitySeriesPoint[] = []
    let weekStart = startOfWeekMonday(from)
    while (weekStart <= to) {
      const weekEnd = endOfWeekSunday(weekStart)
      if (weekEnd >= created) {
        const postponed = hasPostponedOn(entries, activity.id, weekEnd)
        const met = !postponed && weeklyTargetMet(activity, entries, weekStart)
        const completions = entries.filter(
          (e) =>
            e.activity_id === activity.id &&
            e.type === 'completed' &&
            e.date >= weekStart &&
            e.date <= weekEnd,
        ).length
        const sessionMinutes = Math.round(
          sumSessionSeconds(entries, activity.id, weekStart, weekEnd) / 60,
        )
        const isTimer = activity.tracking_mode === 'timer'
        points.push({
          key: weekStart,
          label: shortDateLabel(weekStart),
          date: weekStart,
          status: postponed ? 'postponed' : met ? 'met' : 'open',
          value: isTimer ? sessionMinutes : completions,
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
        const postponed = hasPostponedOn(entries, activity.id, monthEnd)
        const met = !postponed && monthlyTargetMet(activity, entries, monthStart)
        const completions = entries.filter(
          (e) =>
            e.activity_id === activity.id &&
            e.type === 'completed' &&
            e.date >= monthStart &&
            e.date <= monthEnd,
        ).length
        points.push({
          key: monthStart,
          label: shortDateLabel(monthStart),
          date: monthStart,
          status: postponed ? 'postponed' : met ? 'met' : 'open',
          value: completions,
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
    const postponed = hasPostponedOn(entries, activity.id, date)
    const met = !postponed && dailyTargetMet(activity, entries, date)
    const minutes = Math.round(sumSessionSeconds(entries, activity.id, date, date) / 60)
    const completions = entries.filter(
      (e) =>
        e.activity_id === activity.id &&
        e.type === 'completed' &&
        e.date === date,
    ).length
    return {
      key: date,
      label: dayLabel(date, labelWindow),
      date,
      status: postponed ? 'postponed' : met ? 'met' : 'open',
      value: isTimer ? minutes : completions,
      unit: isTimer ? 'min' : 'done',
    }
  })
}

function hasPostponedOn(
  entries: LogEntry[],
  activityId: string,
  date: string,
): boolean {
  return entries.some(
    (e) =>
      e.activity_id === activityId && e.type === 'postponed' && e.date === date,
  )
}

function analyzeDaily(
  activity: Activity,
  entries: LogEntry[],
  from: string,
  to: string,
): Pick<ActivityInsight, 'scheduled' | 'postponed' | 'met'> {
  const created = activity.created_at.slice(0, 10)
  const start = created > from ? created : from
  let scheduled = 0
  let postponed = 0
  let met = 0

  for (const date of eachDateInclusive(start, to)) {
    scheduled += 1
    if (hasPostponedOn(entries, activity.id, date)) {
      postponed += 1
    } else if (dailyTargetMet(activity, entries, date)) {
      met += 1
    }
  }

  return { scheduled, postponed, met }
}

function analyzeWeekly(
  activity: Activity,
  entries: LogEntry[],
  from: string,
  to: string,
): Pick<ActivityInsight, 'scheduled' | 'postponed' | 'met'> {
  const created = activity.created_at.slice(0, 10)
  let scheduled = 0
  let postponed = 0
  let met = 0

  // Walk week starts that overlap [from, to]
  let weekStart = startOfWeekMonday(from)
  while (weekStart <= to) {
    const weekEnd = endOfWeekSunday(weekStart)
    if (weekEnd >= created && weekStart <= to) {
      // Count week if it has started relative to activity creation
      if (weekEnd >= created) {
        scheduled += 1
        if (hasPostponedOn(entries, activity.id, weekEnd)) {
          postponed += 1
        } else if (weeklyTargetMet(activity, entries, weekStart)) {
          met += 1
        }
      }
    }
    weekStart = addDays(weekStart, 7)
  }

  return { scheduled, postponed, met }
}

function analyzeMonthly(
  activity: Activity,
  entries: LogEntry[],
  from: string,
  to: string,
): Pick<ActivityInsight, 'scheduled' | 'postponed' | 'met'> {
  const created = activity.created_at.slice(0, 10)
  let scheduled = 0
  let postponed = 0
  let met = 0

  let monthStart = startOfMonth(from)
  while (monthStart <= to) {
    const monthEnd = endOfMonth(monthStart)
    if (monthEnd >= created) {
      scheduled += 1
      if (hasPostponedOn(entries, activity.id, monthEnd)) {
        postponed += 1
      } else if (monthlyTargetMet(activity, entries, monthStart)) {
        met += 1
      }
    }
    monthStart = startOfMonth(addDays(monthEnd, 1))
  }

  return { scheduled, postponed, met }
}

function buildDayOfWeekSkips(entries: LogEntry[], from: string, to: string): DayCount[] {
  const counts = [0, 0, 0, 0, 0, 0, 0]
  for (const e of entries) {
    if (e.type !== 'postponed') continue
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

function hourBucket(hour: number): string {
  if (hour >= 5 && hour < 12) return 'morning'
  if (hour >= 12 && hour < 17) return 'afternoon'
  if (hour >= 17 && hour < 21) return 'evening'
  return 'night'
}

const BUCKET_ORDER = ['morning', 'afternoon', 'evening', 'night'] as const

function buildSessionTimeBuckets(
  entries: LogEntry[],
  from: string,
  to: string,
): DayCount[] {
  const counts: Record<string, number> = {
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

  return BUCKET_ORDER.map((label) => ({
    key: label,
    label,
    count: counts[label],
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

  let text = `${completed} of ${total} done ${period}.`
  if (top.length === 1) {
    text += ` ${top[0]} is the one you keep putting off.`
  } else if (top.length >= 2) {
    text += ` ${top[0]} and ${top[1]} are the ones you keep putting off.`
  } else {
    text += ` Nothing put off in this window.`
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
        ? analyzeWeekly(activity, entries, from, to)
        : activity.type === 'monthly'
          ? analyzeMonthly(activity, entries, from, to)
          : analyzeDaily(activity, entries, from, to)
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
    totalScheduled,
    mostPostponed,
    dayOfWeekSkips,
    peakSkipDay: peak(dayOfWeekSkips),
    sessionTimeBuckets,
    peakSessionBucket: peak(sessionTimeBuckets),
    summary: buildSummary(
      window,
      completedScheduled,
      totalScheduled,
      mostPostponed,
    ),
  }
}

export function formatPercent(rate: number): string {
  return `${Math.round(rate * 100)}%`
}
