import { addDays, daysBetween, todayLocalDate } from './dates'
import type { Activity } from './activities'
import type { LogEntry } from './logs'
import type { ActivityTodayProgress } from './today'
import { targetToSeconds } from './timer'
import {
  DIGEST_TITLE,
  type DailyDigestPrefs,
  type DigestNotification,
} from './dailyDigest'

export const QUIET_DAYS_THRESHOLD = 5
export const SMALLER_TODAY_MINUTES = 2
export const EASY_WIN_STORAGE_KEY = 'resuming-easy-wins'
export const REENTRY_NOTIFICATION_ID = 7198
export const REENTRY_NOTIFICATION_BODY =
  "Still here when you're ready. One small thing is enough."

function isWinEntry(entry: Pick<LogEntry, 'type' | 'duration_seconds'>): boolean {
  if (entry.type === 'completed') return true
  // Ignore accidental 1-second stops so a Start tap cannot count as "done".
  if (entry.type === 'session') return (entry.duration_seconds ?? 0) >= 15
  return false
}

function activityCreatedDate(createdAt: string): string {
  if (/^\d{4}-\d{2}-\d{2}/.test(createdAt)) return createdAt.slice(0, 10)
  return todayLocalDate(new Date(createdAt))
}

/** Latest date an active activity was actually done (completed or a timer session). */
export function lastActivityWinDate(
  entries: Array<Pick<LogEntry, 'activity_id' | 'type' | 'date' | 'duration_seconds'>>,
  activeIds: Set<string>,
): string | null {
  let latest: string | null = null
  for (const entry of entries) {
    if (!activeIds.has(entry.activity_id)) continue
    if (!isWinEntry(entry)) continue
    if (!latest || entry.date > latest) latest = entry.date
  }
  return latest
}

export function trackingStartDate(
  activities: Array<Pick<Activity, 'archived' | 'created_at'>>,
): string | null {
  let earliest: string | null = null
  for (const activity of activities) {
    if (activity.archived) continue
    const created = activityCreatedDate(activity.created_at)
    if (!earliest || created < earliest) earliest = created
  }
  return earliest
}

/**
 * True when the person has active activities and has not completed
 * anything for at least 5 days. New setups stay quiet until then.
 */
export function isQuietReentry(opts: {
  activities: Array<Pick<Activity, 'id' | 'archived' | 'created_at'>>
  entries: Array<Pick<LogEntry, 'activity_id' | 'type' | 'date' | 'duration_seconds'>>
  today: string
}): boolean {
  const active = opts.activities.filter((activity) => !activity.archived)
  if (active.length === 0) return false

  const activeIds = new Set(active.map((activity) => activity.id))
  const lastWin = lastActivityWinDate(opts.entries, activeIds)
  const started = trackingStartDate(opts.activities)
  if (!started) return false

  const from = lastWin ?? started
  return daysBetween(from, opts.today) >= QUIET_DAYS_THRESHOLD
}

/** Quiet one-liner for Insights during a slump. Null when not in a 5-day gap. */
export function buildQuietInsightLine(opts: {
  activities: Array<Pick<Activity, 'id' | 'archived' | 'created_at'>>
  entries: Array<Pick<LogEntry, 'activity_id' | 'type' | 'date' | 'duration_seconds'>>
  today: string
  rows: ActivityTodayProgress[]
}): string | null {
  if (!isQuietReentry(opts)) return null
  const suggested = pickEasiestReentryRow(opts.rows)
  if (suggested) {
    return `Last 5 days were quiet. ${suggested.activity.name} is an easy place to pick up.`
  }
  return "Last 5 days were quiet. One small thing is enough when you're ready."
}

function quietStreakStart(opts: {
  activities: Array<Pick<Activity, 'id' | 'archived' | 'created_at'>>
  entries: Array<Pick<LogEntry, 'activity_id' | 'type' | 'date' | 'duration_seconds'>>
}): string | null {
  const active = opts.activities.filter((activity) => !activity.archived)
  if (active.length === 0) return null
  const activeIds = new Set(active.map((activity) => activity.id))
  const lastWin = lastActivityWinDate(opts.entries, activeIds)
  return lastWin ?? trackingStartDate(opts.activities)
}

function digestDateTime(date: string, hour: number, minute: number): Date {
  const [year, month, day] = date.split('-').map(Number)
  return new Date(year, month - 1, day, hour, minute, 0, 0)
}

/**
 * One phone-level ping at the daily reminder time on quiet day 5.
 * Armed while the app is open so it can still fire if the app is closed.
 * If that slot already passed for this streak, we back off (no extra days).
 */
export function buildReentryNotification(opts: {
  activities: Array<Pick<Activity, 'id' | 'archived' | 'created_at'>>
  entries: Array<Pick<LogEntry, 'activity_id' | 'type' | 'date' | 'duration_seconds'>>
  today: string
  prefs: DailyDigestPrefs
  now?: Date
}): DigestNotification | null {
  if (!opts.prefs.enabled) return null
  const from = quietStreakStart(opts)
  if (!from) return null

  const dueDate = addDays(from, QUIET_DAYS_THRESHOLD)
  const at = digestDateTime(dueDate, opts.prefs.hour, opts.prefs.minute)
  const now = opts.now ?? new Date()
  if (at.getTime() <= now.getTime()) return null

  return {
    id: REENTRY_NOTIFICATION_ID,
    title: DIGEST_TITLE,
    body: REENTRY_NOTIFICATION_BODY,
    at,
  }
}

function easeScore(row: ActivityTodayProgress): number {
  if (row.done) return Number.POSITIVE_INFINITY

  if (row.actionKind === 'timer' && row.activity.type !== 'weekly_n') {
    return targetToSeconds(row.activity)
  }
  if (row.actionKind === 'checkbox') return 1_000_000
  if (row.actionKind === 'count') {
    return 2_000_000 + Math.max(1, row.target - row.current)
  }
  if (row.actionKind === 'timer') {
    return 3_000_000 + Math.max(1, row.target - row.current)
  }
  return 4_000_000 + Math.max(0, row.daysRemaining ?? 0)
}

/** Open activity that is the smallest ask — shortest timer, then checkbox, then count. */
export function pickEasiestReentryRow(
  rows: ActivityTodayProgress[],
): ActivityTodayProgress | null {
  const open = rows.filter((row) => !row.done)
  if (open.length === 0) return null
  return [...open].sort((a, b) => {
    const diff = easeScore(a) - easeScore(b)
    if (diff !== 0) return diff
    return a.activity.name.localeCompare(b.activity.name)
  })[0]
}

export function canShrinkToday(row: ActivityTodayProgress): boolean {
  if (row.done) return false
  if (row.actionKind !== 'timer') return false
  if (row.activity.type === 'weekly_n') return false
  return targetToSeconds(row.activity) > SMALLER_TODAY_MINUTES * 60
}

export function reentrySuggestLine(row: ActivityTodayProgress): string {
  const name = row.activity.name
  if (row.actionKind === 'timer' && row.activity.type !== 'weekly_n') {
    const unit = row.activity.target_unit === 'seconds' ? 's' : 'min'
    const value = row.activity.target_value ?? 0
    return `Try ${name} · ${value} ${unit}`
  }
  if (row.actionKind === 'count') return `Try ${name} · +1`
  return `Try ${name}`
}

export function reentryPrimaryLabel(row: ActivityTodayProgress): string {
  if (row.actionKind === 'checkbox') return 'Done'
  if (row.actionKind === 'count') return '+1'
  if (row.actionKind === 'deadline') return 'Complete'
  return 'Start'
}

export function applyEasyWins(
  rows: ActivityTodayProgress[],
  easyWinIds: Set<string>,
): ActivityTodayProgress[] {
  if (easyWinIds.size === 0) return rows
  return rows.map((row) => {
    if (!easyWinIds.has(row.activity.id) || row.done) return row
    // Deleting today's session should undo the smaller-today shortcut.
    if (row.current <= 0) return row
    return {
      ...row,
      done: true,
      progressLabel: 'Enough for today',
    }
  })
}

export function loadEasyWinIds(today: string): Set<string> {
  try {
    const raw = localStorage.getItem(EASY_WIN_STORAGE_KEY)
    if (!raw) return new Set()
    const parsed = JSON.parse(raw) as { date?: string; ids?: unknown }
    if (parsed.date !== today || !Array.isArray(parsed.ids)) return new Set()
    return new Set(parsed.ids.filter((id): id is string => typeof id === 'string'))
  } catch {
    return new Set()
  }
}

export function addEasyWinId(today: string, activityId: string): void {
  const ids = loadEasyWinIds(today)
  ids.add(activityId)
  writeEasyWinIds(today, ids)
}

export function removeEasyWinId(today: string, activityId: string): void {
  const ids = loadEasyWinIds(today)
  if (!ids.delete(activityId)) return
  writeEasyWinIds(today, ids)
}

function writeEasyWinIds(today: string, ids: Set<string>): void {
  try {
    if (ids.size === 0) {
      localStorage.removeItem(EASY_WIN_STORAGE_KEY)
      return
    }
    localStorage.setItem(
      EASY_WIN_STORAGE_KEY,
      JSON.stringify({ date: today, ids: [...ids] }),
    )
  } catch {
    /* ignore */
  }
}
