import type { Activity } from './activities'
import type { LogEntry } from './logs'
import {
  endOfMonth,
  endOfWeekSunday,
  startOfMonth,
  startOfWeekMonday,
} from './dates'
import {
  countQualifyingSessions,
  sumSessionSeconds,
  targetToSeconds,
} from './timer'

export type DayStatus =
  | 'done'
  | 'partial'
  | 'skipped'
  | 'rest'
  | 'paused'
  | 'missed'
  | 'open'

export type DayStatusActivity = Pick<
  Activity,
  | 'id'
  | 'type'
  | 'tracking_mode'
  | 'target_value'
  | 'target_unit'
  | 'weekly_target'
  | 'deadline'
  | 'archived'
>

export type DayStatusEntry = Pick<
  LogEntry,
  'activity_id' | 'type' | 'date' | 'duration_seconds' | 'source'
>

export type ActivityPause = {
  activityId: string
  from: string
  until: string | null
}

export type GetDayStatusInput = {
  activity: DayStatusActivity
  /** Entries that fall on this day (or the period for weekly/monthly). */
  entriesForDay: DayStatusEntry[]
  date: string
  today: string
  /** Reserved for callers; day strings are already timezone-local. */
  timezone: string
  /** P1-04: rest_days. Empty until then. */
  restDates?: ReadonlySet<string>
  /** P1-04: activity_pauses. Empty until then. */
  pauses?: readonly ActivityPause[]
}

export type DayStatusResult = {
  status: DayStatus
  /** Minutes (timer), count, or 1/0 for checkbox/deadline. */
  value: number
  target: number
}

/** Auto-backfilled put-offs (P1-04 will set source='auto'; null is treated as auto for now). */
export function isAutoPostponed(entry: DayStatusEntry): boolean {
  if (entry.type !== 'postponed') return false
  return entry.source === 'auto' || entry.source == null
}

export function isUserSkipped(entry: DayStatusEntry): boolean {
  if (entry.type !== 'postponed') return false
  return entry.source !== 'auto' && entry.source != null
}

function periodEntries(
  entries: DayStatusEntry[],
  activityId: string,
  from: string,
  to: string,
): DayStatusEntry[] {
  return entries.filter(
    (e) => e.activity_id === activityId && e.date >= from && e.date <= to,
  )
}

function progressAndTarget(
  activity: DayStatusActivity,
  entries: DayStatusEntry[],
  date: string,
): { value: number; target: number; met: boolean } {
  if (activity.type === 'deadline') {
    const done = entries.some(
      (e) => e.activity_id === activity.id && e.type === 'completed',
    )
    return { value: done ? 1 : 0, target: 1, met: done }
  }

  if (activity.type === 'weekly_n') {
    const from = startOfWeekMonday(date)
    const to = endOfWeekSunday(date)
    const target = activity.weekly_target ?? 1
    if (activity.tracking_mode === 'timer') {
      const value = countQualifyingSessions(
        entries as LogEntry[],
        activity.id,
        from,
        to,
        Math.max(1, targetToSeconds(activity as Activity)),
      )
      return { value, target, met: value >= target }
    }
    const value = entries.filter(
      (e) =>
        e.activity_id === activity.id &&
        e.type === 'completed' &&
        e.date >= from &&
        e.date <= to,
    ).length
    return { value, target, met: value >= target }
  }

  if (activity.type === 'monthly') {
    const from = startOfMonth(date)
    const to = endOfMonth(date)
    const value = entries.filter(
      (e) =>
        e.activity_id === activity.id &&
        e.type === 'completed' &&
        e.date >= from &&
        e.date <= to,
    ).length
    return { value, target: 1, met: value >= 1 }
  }

  // daily
  if (activity.tracking_mode === 'timer') {
    const seconds = sumSessionSeconds(
      entries as LogEntry[],
      activity.id,
      date,
      date,
    )
    const target = targetToSeconds(activity as Activity)
    const value =
      activity.target_unit === 'seconds'
        ? seconds
        : Math.round((seconds / 60) * 10) / 10
    const targetDisplay =
      activity.target_unit === 'seconds' ? target : (activity.target_value ?? 0)
    return {
      value,
      target: targetDisplay,
      met: target > 0 && seconds >= target,
    }
  }

  if (activity.tracking_mode === 'checkbox') {
    const value = entries.filter(
      (e) =>
        e.activity_id === activity.id &&
        e.type === 'completed' &&
        e.date === date,
    ).length
    return { value: value > 0 ? 1 : 0, target: 1, met: value >= 1 }
  }

  // count
  const target = activity.target_value ?? 1
  const value = entries.filter(
    (e) =>
      e.activity_id === activity.id &&
      e.type === 'completed' &&
      e.date === date,
  ).length
  return { value, target, met: value >= target }
}

function isPausedOnDate(
  activityId: string,
  date: string,
  pauses: readonly ActivityPause[] | undefined,
): boolean {
  if (!pauses || pauses.length === 0) return false
  return pauses.some((p) => {
    if (p.activityId !== activityId) return false
    if (date < p.from) return false
    if (p.until == null) return true
    return date <= p.until
  })
}

/**
 * Single source of truth for a day's status for an activity.
 * Callers must pass entries for the relevant period (day, week, or month).
 */
export function getDayStatus(input: GetDayStatusInput): DayStatusResult {
  const { activity, date, today } = input
  const entries = periodEntries(
    input.entriesForDay,
    activity.id,
    // For weekly/monthly the caller may pass the period start as `date`
    // and a wider entry list; filter uses full list below for progress.
    activity.type === 'weekly_n'
      ? startOfWeekMonday(date)
      : activity.type === 'monthly'
        ? startOfMonth(date)
        : date,
    activity.type === 'weekly_n'
      ? endOfWeekSunday(date)
      : activity.type === 'monthly'
        ? endOfMonth(date)
        : date,
  )

  // Prefer full list for progress (weekly/monthly need all period rows).
  const progressEntries = input.entriesForDay.filter(
    (e) => e.activity_id === activity.id,
  )

  if (input.restDates?.has(date)) {
    const { value, target } = progressAndTarget(activity, progressEntries, date)
    return { status: 'rest', value, target }
  }

  if (isPausedOnDate(activity.id, date, input.pauses)) {
    const { value, target } = progressAndTarget(activity, progressEntries, date)
    return { status: 'paused', value, target }
  }

  const postponed = entries.filter((e) => e.type === 'postponed')
  const userSkip = postponed.some(isUserSkipped)
  const onlyAuto =
    postponed.length > 0 && postponed.every(isAutoPostponed) && !userSkip

  if (userSkip) {
    const { value, target } = progressAndTarget(activity, progressEntries, date)
    return { status: 'skipped', value, target }
  }

  const { value, target, met } = progressAndTarget(
    activity,
    progressEntries,
    date,
  )

  if (met) {
    return { status: 'done', value, target }
  }

  // Progress from sessions/completions (ignore auto postponed-only days).
  const hasProgress =
    activity.tracking_mode === 'timer'
      ? progressEntries.some(
          (e) =>
            e.type === 'session' &&
            (activity.type === 'daily'
              ? e.date === date
              : activity.type === 'weekly_n'
                ? e.date >= startOfWeekMonday(date) &&
                  e.date <= endOfWeekSunday(date)
                : true) &&
            (e.duration_seconds ?? 0) > 0,
        )
      : value > 0

  if (hasProgress) {
    return { status: 'partial', value, target }
  }

  // Auto put-offs read as missed (neutral), not skipped.
  if (onlyAuto) {
    return { status: 'missed', value, target }
  }

  if (activity.type === 'deadline') {
    if (activity.deadline && today > activity.deadline && !met) {
      return { status: 'missed', value, target }
    }
    return { status: 'open', value, target }
  }

  if (activity.type === 'weekly_n') {
    const weekEnd = endOfWeekSunday(date)
    if (weekEnd < today) {
      return { status: 'missed', value, target }
    }
    return { status: 'open', value, target }
  }

  if (activity.type === 'monthly') {
    const monthEnd = endOfMonth(date)
    if (monthEnd < today) {
      return { status: 'missed', value, target }
    }
    return { status: 'open', value, target }
  }

  if (date < today) {
    return { status: 'missed', value, target }
  }

  return { status: 'open', value, target }
}

/** True when the person showed up (done or partial). */
export function showedUp(status: DayStatus): boolean {
  return status === 'done' || status === 'partial'
}

/** Map chart/legacy labels. */
export function toLegacyChartStatus(
  status: DayStatus,
): 'met' | 'postponed' | 'open' | 'partial' | 'missed' | 'rest' | 'paused' {
  if (status === 'done') return 'met'
  if (status === 'skipped') return 'postponed'
  return status
}
