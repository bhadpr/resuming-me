import type { Activity } from './activities'
import type { LogEntry } from './logs'
import type { Metric } from './metrics'
import type { MetricEntry } from './metricEntries'

export const TODAY_CACHE_KEY = 'resuming-today-cache'

export interface TodayCachePayload {
  userId: string
  date: string
  activities: Activity[]
  metrics: Metric[]
  logEntries: LogEntry[]
  postponedEntries: LogEntry[]
  metricEntriesToday: MetricEntry[]
  savedAt: string
}

function canUseStorage(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined'
}

export function readTodayCache(
  userId: string,
  date: string,
): TodayCachePayload | null {
  if (!canUseStorage()) return null
  try {
    const raw = window.localStorage.getItem(TODAY_CACHE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as TodayCachePayload
    if (
      !parsed ||
      parsed.userId !== userId ||
      parsed.date !== date ||
      !Array.isArray(parsed.activities) ||
      !Array.isArray(parsed.metrics) ||
      !Array.isArray(parsed.logEntries) ||
      !Array.isArray(parsed.postponedEntries) ||
      !Array.isArray(parsed.metricEntriesToday)
    ) {
      return null
    }
    return parsed
  } catch {
    return null
  }
}

export function writeTodayCache(
  payload: Omit<TodayCachePayload, 'savedAt'> & { savedAt?: string },
): void {
  if (!canUseStorage()) return
  try {
    const full: TodayCachePayload = {
      ...payload,
      savedAt: payload.savedAt ?? new Date().toISOString(),
    }
    window.localStorage.setItem(TODAY_CACHE_KEY, JSON.stringify(full))
  } catch {
    /* quota / private mode */
  }
}

export function clearTodayCache(): void {
  if (!canUseStorage()) return
  try {
    window.localStorage.removeItem(TODAY_CACHE_KEY)
  } catch {
    /* ignore */
  }
}
