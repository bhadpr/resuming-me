import type { Activity } from './activities'
import type { LogEntry } from './logs'
import type { MetricEntry } from './metricEntries'
import { addDays, daysBetween, todayLocalDate } from './dates'
import { countComebacks } from './comebacks'

export interface ActivityStats {
  comebacksLast30: number
  postponementsAllTime: number
  postponementsLast30: number
  averageSessionSeconds: number | null
  sessionCount: number
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
    comebacksLast30: countComebacks(activity, entries, today, 30),
    postponementsAllTime,
    postponementsLast30,
    averageSessionSeconds,
    sessionCount: sessions.length,
  }
}

export type MetricWindowDays = 7 | 30 | 90

export interface MetricTrendStats {
  windowDays: MetricWindowDays
  /** `secondary` is the lower number of a pair such as blood pressure. */
  values: Array<{ date: string; value: number; secondary: number | null }>
  min: number | null
  max: number | null
  avg: number | null
  /** Last value minus first value in window (null if <2 points). */
  delta: number | null
  /** The same four numbers for the lower number of a pair. Null when no day has one. */
  secondaryMin: number | null
  secondaryMax: number | null
  secondaryAvg: number | null
  secondaryDelta: number | null
}

export function computeMetricTrendStats(
  entries: MetricEntry[],
  windowDays: MetricWindowDays,
  today = todayLocalDate(),
): MetricTrendStats {
  const from = addDays(today, -(windowDays - 1))
  const values = entries
    .filter((e) => e.date >= from && e.date <= today)
    .map((e) => ({
      date: e.date,
      value: Number(e.value),
      secondary: e.secondary_value == null ? null : Number(e.secondary_value),
    }))
    .sort((a, b) => a.date.localeCompare(b.date))

  if (values.length === 0) {
    return {
      windowDays,
      values,
      min: null,
      max: null,
      avg: null,
      delta: null,
      secondaryMin: null,
      secondaryMax: null,
      secondaryAvg: null,
      secondaryDelta: null,
    }
  }

  const first = summarize(values.map((v) => v.value))
  const second = summarize(
    values.filter((v) => v.secondary != null).map((v) => v.secondary as number),
  )

  return {
    windowDays,
    values,
    min: first.min,
    max: first.max,
    avg: first.avg,
    delta: first.delta,
    secondaryMin: second.min,
    secondaryMax: second.max,
    secondaryAvg: second.avg,
    secondaryDelta: second.delta,
  }
}

function summarize(nums: number[]): {
  min: number | null
  max: number | null
  avg: number | null
  delta: number | null
} {
  if (nums.length === 0) return { min: null, max: null, avg: null, delta: null }
  return {
    min: Math.min(...nums),
    max: Math.max(...nums),
    avg: nums.reduce((a, b) => a + b, 0) / nums.length,
    delta: nums.length >= 2 ? nums[nums.length - 1] - nums[0] : null,
  }
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
    return entry.note ? `Put off — ${entry.note}` : 'Put off'
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
