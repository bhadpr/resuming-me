import type { Activity } from './activities'
import type { LogEntry } from './logs'
import type { MetricEntry } from './metricEntries'
import {
  addDays,
  daysBetween,
  endOfMonth,
  endOfWeekSunday,
  startOfMonth,
  startOfWeekMonday,
  todayLocalDate,
} from './dates'
import { sumSessionSeconds, targetToSeconds } from './timer'

export interface ActivityStats {
  currentStreak: number
  postponementsAllTime: number
  postponementsLast30: number
  averageSessionSeconds: number | null
  sessionCount: number
}

function dayMet(
  activity: Activity,
  entries: LogEntry[],
  date: string,
): boolean {
  if (activity.tracking_mode === 'timer') {
    const seconds = sumSessionSeconds(entries, activity.id, date, date)
    return seconds >= targetToSeconds(activity)
  }
  if (activity.type === 'weekly_n') {
    // Not used for weekly day checks
    return false
  }
  const target =
    activity.tracking_mode === 'checkbox' ? 1 : (activity.target_value ?? 1)
  const count = entries.filter(
    (e) =>
      e.activity_id === activity.id &&
      e.type === 'completed' &&
      e.date === date,
  ).length
  return count >= target
}

function weekMet(
  activity: Activity,
  entries: LogEntry[],
  weekStart: string,
): boolean {
  const weekEnd = endOfWeekSunday(weekStart)
  const target = activity.weekly_target ?? 1

  if (activity.tracking_mode === 'timer') {
    const minSeconds = Math.max(1, targetToSeconds(activity))
    const qualifying = entries.filter(
      (e) =>
        e.activity_id === activity.id &&
        e.type === 'session' &&
        e.date >= weekStart &&
        e.date <= weekEnd &&
        (e.duration_seconds ?? 0) >= minSeconds,
    ).length
    return qualifying >= target
  }

  const count = entries.filter(
    (e) =>
      e.activity_id === activity.id &&
      e.type === 'completed' &&
      e.date >= weekStart &&
      e.date <= weekEnd,
  ).length
  return count >= target
}

function monthMet(
  activity: Activity,
  entries: LogEntry[],
  monthStart: string,
): boolean {
  const monthEnd = endOfMonth(monthStart)
  const count = entries.filter(
    (e) =>
      e.activity_id === activity.id &&
      e.type === 'completed' &&
      e.date >= monthStart &&
      e.date <= monthEnd,
  ).length
  return count >= 1
}

function hadPostponementOnDate(
  entries: LogEntry[],
  activityId: string,
  date: string,
): boolean {
  return entries.some(
    (e) =>
      e.activity_id === activityId && e.type === 'postponed' && e.date === date,
  )
}

/**
 * Current streak of consecutive met periods.
 * A postponed entry for that period breaks the streak.
 */
export function computeCurrentStreak(
  activity: Activity,
  entries: LogEntry[],
  today = todayLocalDate(),
): number {
  if (activity.type === 'deadline') return 0

  if (activity.type === 'weekly_n') {
    let streak = 0
    let weekStart = startOfWeekMonday(today)
    // Include current week only if already met; otherwise start from previous week
    if (!weekMet(activity, entries, weekStart)) {
      weekStart = addDays(weekStart, -7)
    }
    while (streak < 104) {
      const weekEnd = endOfWeekSunday(weekStart)
      const postponed = entries.some(
        (e) =>
          e.activity_id === activity.id &&
          e.type === 'postponed' &&
          e.date >= weekStart &&
          e.date <= weekEnd,
      )
      if (postponed || !weekMet(activity, entries, weekStart)) break
      streak += 1
      weekStart = addDays(weekStart, -7)
    }
    return streak
  }

  if (activity.type === 'monthly') {
    let streak = 0
    let monthStart = startOfMonth(today)
    if (!monthMet(activity, entries, monthStart)) {
      monthStart = startOfMonth(addDays(monthStart, -1))
    }
    while (streak < 24) {
      const monthEnd = endOfMonth(monthStart)
      const postponed = entries.some(
        (e) =>
          e.activity_id === activity.id &&
          e.type === 'postponed' &&
          e.date >= monthStart &&
          e.date <= monthEnd,
      )
      if (postponed || !monthMet(activity, entries, monthStart)) break
      streak += 1
      monthStart = startOfMonth(addDays(monthStart, -1))
    }
    return streak
  }

  // daily
  let streak = 0
  let cursor = today
  if (!dayMet(activity, entries, cursor)) {
    cursor = addDays(today, -1)
  }
  while (streak < 365) {
    if (hadPostponementOnDate(entries, activity.id, cursor)) break
    if (!dayMet(activity, entries, cursor)) break
    streak += 1
    cursor = addDays(cursor, -1)
  }
  return streak
}

export function computeActivityStats(
  activity: Activity,
  entries: LogEntry[],
  today = todayLocalDate(),
): ActivityStats {
  const mine = entries.filter((e) => e.activity_id === activity.id)
  const postponementsAllTime = mine.filter((e) => e.type === 'postponed').length
  const cutoff = addDays(today, -29)
  const postponementsLast30 = mine.filter(
    (e) => e.type === 'postponed' && e.date >= cutoff && e.date <= today,
  ).length

  const sessions = mine.filter(
    (e) => e.type === 'session' && e.duration_seconds != null,
  )
  const averageSessionSeconds =
    sessions.length === 0
      ? null
      : sessions.reduce((sum, e) => sum + (e.duration_seconds ?? 0), 0) /
        sessions.length

  return {
    currentStreak: computeCurrentStreak(activity, entries, today),
    postponementsAllTime,
    postponementsLast30,
    averageSessionSeconds,
    sessionCount: sessions.length,
  }
}

export type MetricWindowDays = 7 | 30 | 90

export interface MetricTrendStats {
  windowDays: MetricWindowDays
  values: Array<{ date: string; value: number }>
  min: number | null
  max: number | null
  avg: number | null
  /** Last value minus first value in window (null if <2 points). */
  delta: number | null
}

export function computeMetricTrendStats(
  entries: MetricEntry[],
  windowDays: MetricWindowDays,
  today = todayLocalDate(),
): MetricTrendStats {
  const from = addDays(today, -(windowDays - 1))
  const values = entries
    .filter((e) => e.date >= from && e.date <= today)
    .map((e) => ({ date: e.date, value: Number(e.value) }))
    .sort((a, b) => a.date.localeCompare(b.date))

  if (values.length === 0) {
    return {
      windowDays,
      values,
      min: null,
      max: null,
      avg: null,
      delta: null,
    }
  }

  const nums = values.map((v) => v.value)
  const min = Math.min(...nums)
  const max = Math.max(...nums)
  const avg = nums.reduce((a, b) => a + b, 0) / nums.length
  const delta = values.length >= 2 ? values[values.length - 1].value - values[0].value : null

  return { windowDays, values, min, max, avg, delta }
}

export function describeLogEntry(entry: LogEntry): string {
  if (entry.type === 'session') {
    const mins = ((entry.duration_seconds ?? 0) / 60).toFixed(
      (entry.duration_seconds ?? 0) % 60 === 0 ? 0 : 1,
    )
    const source = entry.source === 'manual' ? 'manual' : 'timer'
    return `${mins} min (${source})`
  }
  if (entry.type === 'completed') return 'Completed'
  if (entry.type === 'postponed') {
    return entry.note ? `Postponed — ${entry.note}` : 'Postponed'
  }
  return entry.type
}

export function formatAvgSession(seconds: number | null): string {
  if (seconds == null) return '—'
  const mins = seconds / 60
  if (mins < 10) return `${mins.toFixed(1)} min`
  return `${Math.round(mins)} min`
}

/** Span helper for tests / UI. */
export function daysInRangeInclusive(from: string, to: string): number {
  return daysBetween(from, to) + 1
}
