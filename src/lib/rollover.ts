import type { Activity } from './activities'
import type { LogEntry } from './logs'
import {
  addDays,
  endOfWeekSunday,
  startOfWeekMonday,
} from './dates'
import { sumSessionSeconds, targetToSeconds } from './timer'

/** YYYY-MM-DD for an instant in a specific IANA timezone. */
export function localDateInTimeZone(utc: Date, timeZone: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(utc)
}

/** Local weekday 0=Sun..6=Sat in timezone. */
export function localWeekdayInTimeZone(utc: Date, timeZone: string): number {
  const day = new Intl.DateTimeFormat('en-US', {
    timeZone,
    weekday: 'short',
  }).format(utc)
  const map: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  }
  return map[day] ?? 0
}

export function hasPostponedEntry(
  entries: LogEntry[],
  activityId: string,
  date: string,
): boolean {
  return entries.some(
    (e) =>
      e.activity_id === activityId && e.type === 'postponed' && e.date === date,
  )
}

export function hasCompletedEntry(
  entries: LogEntry[],
  activityId: string,
  date: string,
): boolean {
  return entries.some(
    (e) =>
      e.activity_id === activityId && e.type === 'completed' && e.date === date,
  )
}

/** Whether a daily activity met its target on `date`. */
export function dailyTargetMet(
  activity: Activity,
  entries: LogEntry[],
  date: string,
): boolean {
  if (activity.type !== 'daily' || activity.archived) return true

  if (activity.tracking_mode === 'timer') {
    return sumSessionSeconds(entries, activity.id, date, date) >= targetToSeconds(activity)
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

/** Whether a weekly_n activity met its target in Mon–Sun window. */
export function weeklyTargetMet(
  activity: Activity,
  entries: LogEntry[],
  weekStart: string,
): boolean {
  if (activity.type !== 'weekly_n' || activity.archived) return true

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

export interface PostponementPlan {
  activityId: string
  userId: string
  date: string
  reason: 'daily' | 'weekly'
}

export interface RolloverPlanInput {
  userId: string
  timezone: string
  nowUtc: Date
  activities: Activity[]
  entries: LogEntry[]
  /** How many closed days to backfill (default 14). */
  lookbackDays?: number
}

/**
 * Decide which postponed entries to write for a user given "now" in UTC
 * and their timezone. Idempotent vs existing postponed rows in `entries`.
 */
export function planRollover(input: RolloverPlanInput): PostponementPlan[] {
  const {
    userId,
    timezone,
    nowUtc,
    activities,
    entries,
    lookbackDays = 14,
  } = input

  const localToday = localDateInTimeZone(nowUtc, timezone)
  const plans: PostponementPlan[] = []
  const active = activities.filter((a) => !a.archived)

  // Daily: closed days = yesterday back through lookback
  const yesterday = addDays(localToday, -1)
  for (let i = 0; i < lookbackDays; i++) {
    const closedDay = addDays(yesterday, -i)
    for (const activity of active) {
      if (activity.type !== 'daily') continue
      // Don't postpone before the activity existed
      const createdDay = activity.created_at.slice(0, 10)
      if (closedDay < createdDay) continue
      if (hasPostponedEntry(entries, activity.id, closedDay)) continue
      if (dailyTargetMet(activity, entries, closedDay)) continue
      plans.push({
        activityId: activity.id,
        userId,
        date: closedDay,
        reason: 'daily',
      })
    }
  }

  // Weekly: when local today is Monday (or always check last closed week),
  // roll weeks that ended on or before yesterday.
  const lastClosedWeekEnd = yesterday
  // Walk back lookback/7 weeks
  const weeksToCheck = Math.max(1, Math.ceil(lookbackDays / 7))
  for (let w = 0; w < weeksToCheck; w++) {
    const weekEnd = addDays(lastClosedWeekEnd, -w * 7)
    // Normalize to Sunday of that week
    const weekStart = startOfWeekMonday(weekEnd)
    const sunday = endOfWeekSunday(weekStart)
    // Only roll a week once it's fully closed (sunday <= yesterday)
    if (sunday > yesterday) continue

    for (const activity of active) {
      if (activity.type !== 'weekly_n') continue
      const createdDay = activity.created_at.slice(0, 10)
      if (sunday < createdDay) continue
      // Store postponed on the week's Sunday for weekly cadence
      if (hasPostponedEntry(entries, activity.id, sunday)) continue
      if (weeklyTargetMet(activity, entries, weekStart)) continue
      plans.push({
        activityId: activity.id,
        userId,
        date: sunday,
        reason: 'weekly',
      })
    }
  }

  return plans
}

export function isDeadlineOverdue(
  activity: Activity,
  entries: LogEntry[],
  today: string,
): boolean {
  if (activity.type !== 'deadline' || activity.archived || !activity.deadline) {
    return false
  }
  if (activity.deadline >= today) return false
  return !entries.some(
    (e) =>
      e.activity_id === activity.id && e.type === 'completed',
  )
}
