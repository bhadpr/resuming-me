import type { LogEntry } from './logs'
import type { Activity } from './activities'
import { t } from './i18n'

/** Convert activity target to seconds (timer mode). */
export function targetToSeconds(activity: Activity): number {
  const value = activity.target_value ?? 0
  if (activity.target_unit === 'seconds') return value
  // default minutes
  return value * 60
}

export function sumSessionSeconds(
  entries: LogEntry[],
  activityId: string,
  from: string,
  to: string,
): number {
  return entries
    .filter(
      (e) =>
        e.activity_id === activityId &&
        e.type === 'session' &&
        e.date >= from &&
        e.date <= to,
    )
    .reduce((sum, e) => sum + (e.duration_seconds ?? 0), 0)
}

export function sessionEntriesInWindow(
  entries: LogEntry[],
  activityId: string,
  from: string,
  to: string,
): LogEntry[] {
  return entries.filter(
    (e) =>
      e.activity_id === activityId &&
      e.type === 'session' &&
      e.date >= from &&
      e.date <= to,
  )
}

/** The session Undo should remove: the latest one in the window. */
export function latestSessionEntry(
  entries: LogEntry[],
  activityId: string,
  from: string,
  to: string,
): LogEntry | null {
  const sessions = sessionEntriesInWindow(entries, activityId, from, to)
  if (sessions.length === 0) return null
  return [...sessions].sort((a, b) => {
    const aKey = a.started_at || a.created_at
    const bKey = b.started_at || b.created_at
    return aKey < bKey ? 1 : aKey > bKey ? -1 : 0
  })[0]
}

/** Weekly timer: each session meeting the per-session duration target counts as 1. */
export function countQualifyingSessions(
  entries: LogEntry[],
  activityId: string,
  from: string,
  to: string,
  minSeconds: number,
): number {
  return sessionEntriesInWindow(entries, activityId, from, to).filter(
    (e) => (e.duration_seconds ?? 0) >= minSeconds,
  ).length
}

export function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds))
  const hours = Math.floor(s / 3600)
  const minutes = Math.floor((s % 3600) / 60)
  const seconds = s % 60
  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
  }
  return `${minutes}:${String(seconds).padStart(2, '0')}`
}

export function formatSecondsAsTargetUnit(
  seconds: number,
  unit: string | null,
): string {
  if (unit === 'seconds') return `${Math.round(seconds)}s`
  const minutes = seconds / 60
  if (minutes < 10) return `${minutes.toFixed(1)} min`
  return `${Math.round(minutes)} min`
}

function minutesText(minutes: number, round: (value: number) => number): string {
  if (minutes >= 10) return String(round(minutes))
  const tenths = round(minutes * 10) / 10
  return Number.isInteger(tenths) ? String(tenths) : tenths.toFixed(1)
}

/** "2 min" before starting, "1.5 of 2 min" partway, and the time done once the goal is met. */
export function sessionProgressLabel(
  seconds: number,
  targetSeconds: number,
  unit: string | null,
): string {
  const done = Math.max(0, seconds)
  const sec = t('unit.sec')
  const min = t('unit.min')
  if (unit === 'seconds') {
    const goal = Math.round(targetSeconds)
    if (done <= 0) return `${goal} ${sec}`
    if (done >= targetSeconds) return `${Math.round(done)} ${sec}`
    return t('today.progressOf', { value: Math.floor(done), target: `${goal} ${sec}` })
  }
  const goal = minutesText(targetSeconds / 60, Math.round)
  if (done <= 0) return `${goal} ${min}`
  if (done >= targetSeconds) return `${minutesText(done / 60, Math.round)} ${min}`
  if (done < 60) return t('today.progressOf', { value: `${Math.floor(done)} ${sec}`, target: `${goal} ${min}` })
  return t('today.progressOf', { value: minutesText(done / 60, Math.floor), target: `${goal} ${min}` })
}

export function computeElapsedSeconds(params: {
  status: 'running' | 'paused'
  accumulatedSeconds: number
  segmentStartedAt: string | null
  nowMs?: number
}): number {
  const now = params.nowMs ?? Date.now()
  if (params.status === 'paused' || !params.segmentStartedAt) {
    return params.accumulatedSeconds
  }
  const segment = Math.max(
    0,
    Math.floor((now - new Date(params.segmentStartedAt).getTime()) / 1000),
  )
  return params.accumulatedSeconds + segment
}

export function isTimerTargetMet(
  summedSeconds: number,
  activity: Activity,
): boolean {
  return summedSeconds >= targetToSeconds(activity)
}
