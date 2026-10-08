import type { RecordType } from '@devmaxime/capacitor-health-connect'
import { phoneStepsSupported } from './healthSteps'
import type { LogEntry } from './logs'

export const DISTANCE_TEMPLATE_IDS = new Set(['walk', 'running'])
export const DISTANCE_ACCESS_CHANGED = 'resuming-distance-access'

const CACHE_KEY = 'resuming-session-distance'
const DECLINED_KEY = 'resuming-distance-declined'
const CACHE_LIMIT = 300
/** Watches and fitness apps sync into Health Connect late; only trust totals after this. */
const SETTLE_MS = 2 * 60 * 60 * 1000
/** A saved time this far past start + duration is a late offline sync, not a paused timer. */
const MAX_PAUSE_MS = 3 * 60 * 60 * 1000
/** Below this the phone is guessing. */
const MIN_METERS = 50

/** The plugin's types list only some records; the native side accepts any Health Connect record name. */
const DISTANCE = 'Distance' as RecordType

export type DistanceAccess = 'unknown' | 'granted' | 'needs-permission' | 'declined' | 'unavailable'

export type DistanceSession = Pick<
  LogEntry,
  'id' | 'type' | 'started_at' | 'duration_seconds' | 'created_at'
>

export function tracksDistance(templateId: string | null | undefined): boolean {
  return templateId != null && DISTANCE_TEMPLATE_IDS.has(templateId)
}

/** Wall-clock span of a timed session, including any time the timer sat paused. */
export function sessionWindow(entry: DistanceSession): { start: Date; end: Date } | null {
  if (entry.type !== 'session' || !entry.started_at || !entry.duration_seconds) return null
  const start = Date.parse(entry.started_at)
  if (Number.isNaN(start)) return null
  const minEnd = start + entry.duration_seconds * 1000
  const saved = Date.parse(entry.created_at)
  const end = saved >= minEnd && saved <= minEnd + MAX_PAUSE_MS ? saved : minEnd
  return { start: new Date(start), end: new Date(end) }
}

export function formatDistance(meters: number): string | null {
  if (!(meters >= MIN_METERS)) return null
  if (meters < 1000) return `${Math.round(meters / 10) * 10} m`
  const km = meters / 1000
  return `${km < 10 ? km.toFixed(1) : Math.round(km)} km`
}

async function healthConnect() {
  const { HealthConnect } = await import('@devmaxime/capacitor-health-connect')
  return HealthConnect
}

let accessCheck: Promise<DistanceAccess> | null = null

export function distanceAccess(): Promise<DistanceAccess> {
  if (!phoneStepsSupported()) return Promise.resolve('unavailable')
  accessCheck ??= (async (): Promise<DistanceAccess> => {
    try {
      const health = await healthConnect()
      const { availability } = await health.checkAvailability()
      if (availability !== 'Available') return 'unavailable'
      const granted = await health.getGrantedPermissions()
      if (granted.read.includes(DISTANCE)) return 'granted'
      return localStorage.getItem(DECLINED_KEY) ? 'declined' : 'needs-permission'
    } catch {
      return 'unavailable'
    }
  })()
  return accessCheck
}

/** Forget the cached answer, e.g. when the user may have changed it in Health Connect. */
export function recheckDistanceAccess(): void {
  accessCheck = null
}

export async function requestDistanceAccess(): Promise<DistanceAccess> {
  let access: DistanceAccess
  try {
    const health = await healthConnect()
    const next = await health.requestPermissions({ read: [DISTANCE], write: [] })
    access = next.read.includes(DISTANCE) ? 'granted' : 'declined'
  } catch {
    access = 'unavailable'
  }
  if (access === 'declined') localStorage.setItem(DECLINED_KEY, '1')
  if (access === 'granted') localStorage.removeItem(DECLINED_KEY)
  accessCheck = Promise.resolve(access)
  window.dispatchEvent(new Event(DISTANCE_ACCESS_CHANGED))
  return access
}

function loadCache(): Record<string, number> {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    const parsed: unknown = raw ? JSON.parse(raw) : null
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, number>) : {}
  } catch {
    return {}
  }
}

function saveCached(id: string, meters: number): void {
  const cache = loadCache()
  cache[id] = meters
  const ids = Object.keys(cache)
  for (const old of ids.slice(0, Math.max(0, ids.length - CACHE_LIMIT))) delete cache[old]
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache))
  } catch {
    // Storage full: we just read it again next time.
  }
}

/** Metres Health Connect recorded during this session, or null when it can't say. */
export async function readSessionDistance(entry: DistanceSession): Promise<number | null> {
  const span = sessionWindow(entry)
  if (!span) return null
  const cached = loadCache()[entry.id]
  if (typeof cached === 'number') return cached
  try {
    const health = await healthConnect()
    const result = await health.aggregateRecords({
      type: 'Distance',
      start: span.start.toISOString(),
      end: span.end.toISOString(),
      groupBy: 'day',
    })
    const meters = result.aggregates.reduce((sum, row) => sum + (Number(row.value) || 0), 0)
    if (Date.now() - span.end.getTime() > SETTLE_MS) saveCached(entry.id, meters)
    return meters
  } catch {
    return null
  }
}
