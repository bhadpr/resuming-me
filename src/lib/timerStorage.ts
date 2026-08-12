import type { SessionSource } from '../types/database'

const TIMER_KEY = 'resuming.activeTimer'
const QUEUE_KEY = 'resuming.offlineSessionQueue'

export interface ActiveTimerState {
  activityId: string
  date: string
  status: 'running' | 'paused'
  /** Seconds accumulated from completed segments within this session. */
  accumulatedSeconds: number
  /** ISO timestamp when the current running segment started; null when paused. */
  segmentStartedAt: string | null
  /** ISO timestamp of the original Start for this session. */
  sessionStartedAt: string
}

export interface QueuedSession {
  id: string
  userId: string
  activityId: string
  date: string
  durationSeconds: number
  startedAt: string | null
  source: SessionSource
  createdAt: string
}

function canUseStorage(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined'
}

export function loadActiveTimer(): ActiveTimerState | null {
  if (!canUseStorage()) return null
  try {
    const raw = window.localStorage.getItem(TIMER_KEY)
    if (!raw) return null
    return JSON.parse(raw) as ActiveTimerState
  } catch {
    return null
  }
}

/** True when persisted timer should not block Today actions. */
export function isActiveTimerStale(
  state: ActiveTimerState,
  today: string,
  activeActivityIds: readonly string[],
): boolean {
  if (state.date !== today) return true
  if (!activeActivityIds.includes(state.activityId)) return true
  return false
}

export function loadActiveTimerIfValid(
  today: string,
  activeActivityIds: readonly string[],
): ActiveTimerState | null {
  const stored = loadActiveTimer()
  if (!stored) return null
  if (isActiveTimerStale(stored, today, activeActivityIds)) {
    clearActiveTimer()
    return null
  }
  return stored
}

export function saveActiveTimer(state: ActiveTimerState): void {
  if (!canUseStorage()) return
  window.localStorage.setItem(TIMER_KEY, JSON.stringify(state))
}

export function clearActiveTimer(): void {
  if (!canUseStorage()) return
  window.localStorage.removeItem(TIMER_KEY)
}

export function loadSessionQueue(): QueuedSession[] {
  if (!canUseStorage()) return []
  try {
    const raw = window.localStorage.getItem(QUEUE_KEY)
    if (!raw) return []
    return JSON.parse(raw) as QueuedSession[]
  } catch {
    return []
  }
}

export function saveSessionQueue(queue: QueuedSession[]): void {
  if (!canUseStorage()) return
  window.localStorage.setItem(QUEUE_KEY, JSON.stringify(queue))
}

export function enqueueSession(item: QueuedSession): void {
  const queue = loadSessionQueue()
  if (queue.some((q) => q.id === item.id)) return
  queue.push(item)
  saveSessionQueue(queue)
}

export function removeQueuedSession(id: string): void {
  saveSessionQueue(loadSessionQueue().filter((q) => q.id !== id))
}
