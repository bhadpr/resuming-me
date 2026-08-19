import type { Activity } from './activities'
import type { LogEntry } from './logs'
import {
  addDays,
  daysBetween,
  endOfMonth,
  endOfWeekSunday,
  startOfMonth,
  startOfWeekMonday,
  todayLocalDate,
} from './dates'
import {
  countQualifyingSessions,
  formatSecondsAsTargetUnit,
  sumSessionSeconds,
  targetToSeconds,
} from './timer'

export type TodayActionKind = 'checkbox' | 'count' | 'timer' | 'deadline'

export interface ActivityTodayProgress {
  activity: Activity
  actionKind: TodayActionKind
  /**
   * Progress toward current period target.
   * Checkbox/count/deadline: completion count.
   * Daily timer: seconds accumulated.
   * Weekly timer: qualifying session count.
   */
  current: number
  target: number
  done: boolean
  /** For deadline activities. */
  daysRemaining: number | null
  overdue: boolean
  /** True when the previous day/week was logged postponed. */
  recentlyPostponed: boolean
  /** Longer = more overdue-feeling; used for sorting. */
  postponementStreak: number
  /** Label for the progress row. */
  progressLabel: string
  /** Entries that count toward current period progress. */
  periodCompletedEntries: LogEntry[]
}

function isDueOnToday(activity: Activity): boolean {
  if (activity.archived) return false
  if (activity.type === 'daily') return true
  if (activity.type === 'weekly_n') return true
  if (activity.type === 'monthly') return true
  if (activity.type === 'deadline') {
    return true
  }
  return false
}

export function getActionKind(activity: Activity): TodayActionKind {
  if (activity.type === 'deadline') {
    if (activity.tracking_mode === 'checkbox') return 'checkbox'
    return 'deadline'
  }
  if (activity.tracking_mode === 'timer') return 'timer'
  if (activity.tracking_mode === 'checkbox') return 'checkbox'
  return 'count'
}

function periodWindow(
  activity: Activity,
  today: string,
): { from: string; to: string } {
  if (activity.type === 'weekly_n') {
    return { from: startOfWeekMonday(today), to: endOfWeekSunday(today) }
  }
  if (activity.type === 'monthly') {
    return { from: startOfMonth(today), to: endOfMonth(today) }
  }
  return { from: today, to: today }
}

function periodTarget(activity: Activity): number {
  if (activity.type === 'deadline') return 1
  if (activity.type === 'monthly') return 1
  if (activity.tracking_mode === 'timer') {
    if (activity.type === 'weekly_n') return activity.weekly_target ?? 1
    return targetToSeconds(activity)
  }
  if (activity.type === 'weekly_n') return activity.weekly_target ?? 1
  if (activity.tracking_mode === 'checkbox') return 1
  return activity.target_value ?? 1
}

export function completedCountInWindow(
  entries: LogEntry[],
  activityId: string,
  from: string,
  to: string,
): LogEntry[] {
  return entries.filter(
    (e) =>
      e.activity_id === activityId &&
      e.type === 'completed' &&
      e.date >= from &&
      e.date <= to,
  )
}

export function hasActivityCompletion(
  entries: LogEntry[],
  activityId: string,
): boolean {
  return entries.some(
    (e) => e.activity_id === activityId && e.type === 'completed',
  )
}

/** Completed deadline tasks stay on Today through the due date, then drop off. */
export function shouldShowDeadlineOnToday(
  activity: Activity,
  done: boolean,
  today: string,
): boolean {
  if (activity.type !== 'deadline' || !done) return true
  if (!activity.deadline) return false
  return today <= activity.deadline
}

export function computePostponementStreak(
  activity: Activity,
  postponedEntries: LogEntry[],
  today: string,
): number {
  const postponedDates = new Set(
    postponedEntries
      .filter((e) => e.activity_id === activity.id && e.type === 'postponed')
      .map((e) => e.date),
  )

  if (postponedDates.size === 0) {
    return 0
  }

  let streak = 0
  if (activity.type === 'weekly_n') {
    let cursor = addDays(startOfWeekMonday(today), -1)
    while (streak < 52) {
      const weekStart = startOfWeekMonday(cursor)
      const hit = [...postponedDates].some(
        (d) => d >= weekStart && d <= endOfWeekSunday(weekStart),
      )
      if (!hit) break
      streak += 1
      cursor = addDays(weekStart, -1)
    }
    return streak
  }

  if (activity.type === 'monthly') {
    let cursor = addDays(startOfMonth(today), -1)
    while (streak < 24) {
      const monthStart = startOfMonth(cursor)
      const monthEnd = endOfMonth(cursor)
      const hit = [...postponedDates].some(
        (d) => d >= monthStart && d <= monthEnd,
      )
      if (!hit) break
      streak += 1
      cursor = addDays(monthStart, -1)
    }
    return streak
  }

  let cursor = addDays(today, -1)
  while (streak < 365) {
    if (!postponedDates.has(cursor)) break
    streak += 1
    cursor = addDays(cursor, -1)
  }
  return streak
}

export function daysSinceLastCompletion(
  activity: Activity,
  entries: LogEntry[],
  today: string,
): number {
  const relevant = entries
    .filter(
      (e) =>
        e.activity_id === activity.id &&
        (e.type === 'completed' || e.type === 'session'),
    )
    .map((e) => e.date)
    .sort()
    .reverse()

  if (relevant.length > 0) {
    return Math.max(0, daysBetween(relevant[0], today))
  }

  const created = activity.created_at.slice(0, 10)
  return Math.max(0, daysBetween(created, today))
}

export function buildTodayProgress(
  activities: Activity[],
  entries: LogEntry[],
  postponedEntries: LogEntry[],
  today = todayLocalDate(),
): ActivityTodayProgress[] {
  const active = activities.filter((a) => isDueOnToday(a))

  const rows: ActivityTodayProgress[] = active.map((activity) => {
    const actionKind = getActionKind(activity)
    const { from, to } = periodWindow(activity, today)
    const periodCompletedEntries =
      activity.type === 'deadline'
        ? entries.filter(
            (e) =>
              e.activity_id === activity.id && e.type === 'completed',
          )
        : completedCountInWindow(entries, activity.id, from, to)

    let current = periodCompletedEntries.length
    const target = periodTarget(activity)
    let daysRemaining: number | null = null
    let overdue = false
    let done = current >= target
    let progressLabel = `${current}/${target}`

    if (actionKind === 'timer') {
      if (activity.type === 'weekly_n') {
        const minSeconds = targetToSeconds(activity)
        current = countQualifyingSessions(
          entries,
          activity.id,
          from,
          to,
          Math.max(1, minSeconds),
        )
        done = current >= target
        progressLabel = `${current}/${target} sessions this week`
      } else {
        current = sumSessionSeconds(entries, activity.id, from, to)
        done = target > 0 && current >= target
        progressLabel = `${formatSecondsAsTargetUnit(current, activity.target_unit)} / ${activity.target_value ?? 0} ${activity.target_unit ?? 'minutes'}`
      }
    } else if (activity.type === 'deadline') {
      daysRemaining = activity.deadline
        ? daysBetween(today, activity.deadline)
        : null
      done = hasActivityCompletion(entries, activity.id)
      current = done ? 1 : 0
      overdue = daysRemaining != null && daysRemaining < 0 && !done
      if (done) {
        if (daysRemaining != null && daysRemaining > 0) {
          progressLabel = `Completed · ${daysRemaining}d until due`
        } else if (daysRemaining === 0) {
          progressLabel = 'Completed · due today'
        } else {
          progressLabel = 'Completed'
        }
      } else if (overdue) progressLabel = `Overdue by ${Math.abs(daysRemaining ?? 0)}d`
      else if (daysRemaining === 0) progressLabel = 'Due today'
      else progressLabel = `${daysRemaining}d left`
    } else if (activity.type === 'weekly_n') {
      progressLabel = `${current}/${target} this week`
    } else if (activity.type === 'monthly') {
      progressLabel = done ? 'Done this month' : 'Not yet this month'
    } else if (actionKind === 'checkbox') {
      progressLabel = done ? 'Done today' : 'Not yet'
    }

    const postponementStreak = computePostponementStreak(
      activity,
      postponedEntries,
      today,
    )
    const fallbackOverdue = daysSinceLastCompletion(activity, entries, today)
    const sortKey =
      postponementStreak > 0
        ? postponementStreak * 1000 + fallbackOverdue
        : fallbackOverdue

    return {
      activity,
      actionKind,
      current,
      target,
      done,
      daysRemaining,
      overdue,
      recentlyPostponed: postponementStreak > 0,
      postponementStreak: sortKey,
      progressLabel,
      periodCompletedEntries,
    }
  })

  // Keep a stable order so starting or completing an activity does not reshuffle Today.
  return rows.filter((r) => shouldShowDeadlineOnToday(r.activity, r.done, today))
}

/**
 * One next action for Today. Priority: live/paused timer, overdue deadline,
 * recently postponed, then most-overdue-feeling open row.
 */
export function pickHeroRow(
  rows: ActivityTodayProgress[],
  timerActivityId: string | null,
): ActivityTodayProgress | null {
  if (timerActivityId) {
    const live = rows.find((row) => row.activity.id === timerActivityId)
    if (live) return live
  }

  const open = rows.filter((row) => !row.done)
  if (open.length === 0) return null

  const overdue = open.find((row) => row.overdue)
  if (overdue) return overdue

  const postponed = open
    .filter((row) => row.recentlyPostponed)
    .sort((a, b) => b.postponementStreak - a.postponementStreak)
  if (postponed[0]) return postponed[0]

  return [...open].sort((a, b) => b.postponementStreak - a.postponementStreak)[0]
}

/** Empty Today: first-run setup vs already tracking but nothing due. */
export type TodayEmptyKind = 'setup' | 'clear'

export function todayEmptyKind(opts: {
  hasActivities: boolean
  dueCount: number
}): TodayEmptyKind | null {
  if (opts.dueCount > 0) return null
  return opts.hasActivities ? 'clear' : 'setup'
}

export function partitionTodayRows(
  rows: ActivityTodayProgress[],
  timerActivityId: string | null,
  preferredHeroId?: string | null,
): {
  hero: ActivityTodayProgress | null
  alsoDue: ActivityTodayProgress[]
  done: ActivityTodayProgress[]
} {
  let hero: ActivityTodayProgress | null = null
  if (timerActivityId) {
    hero = rows.find((row) => row.activity.id === timerActivityId) ?? null
  }
  if (!hero && preferredHeroId) {
    const preferred = rows.find(
      (row) => row.activity.id === preferredHeroId && !row.done,
    )
    if (preferred) hero = preferred
  }
  if (!hero) hero = pickHeroRow(rows, timerActivityId)
  const done = rows.filter((row) => row.done && row.activity.id !== hero?.activity.id)
  const alsoDue = rows.filter(
    (row) => !row.done && row.activity.id !== hero?.activity.id,
  )
  return { hero, alsoDue, done }
}
