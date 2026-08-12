import type { LogEntry } from './logs'
import type { Activity } from './activities'

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
