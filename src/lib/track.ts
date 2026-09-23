import { Capacitor } from '@capacitor/core'
import { createSupabaseClient, isSupabaseConfigured } from './supabase'
import type { Database, Json } from '../types/database'

export type EventProps = Record<string, string | number | boolean | null>

export type TrackedEventName =
  | 'landing_viewed'
  | 'signin_clicked'
  | 'signup_completed'
  | 'signin_method_clicked'
  | 'signin_shown'
  | 'onboarding_started'
  | 'onboarding_step_completed'
  | 'onboarding_timer_started'
  | 'onboarding_timer_completed'
  | 'onboarding_timer_skipped'
  | 'onboarding_reminder_set'
  | 'activity_created'
  | 'log_created'
  | 'log_undone'
  | 'smaller_opened'
  | 'smaller_chosen'
  | 'skip_today'
  | 'activity_paused'
  | 'rest_day'
  | 'comeback'
  | 'insights_viewed'
  | 'app_opened'

type EventInsert = Database['public']['Tables']['events']['Insert']

const ANON_KEY = 'resuming-visitor-id'
const QUEUE_KEY = 'resuming.offlineEventsQueue'
const LAST_OPEN_KEY = 'resuming-last-app-open'
const FLUSH_MS = 10_000
const MAX_QUEUE = 200
const APP_VERSION = '0.1.0'

type QueuedEvent = {
  id: string
  name: string
  props: EventProps
  path: string | null
  app_version: string
  platform: string
  anon_id: string
  user_id: string | null
  created_at: string
}

let memoryBuffer: QueuedEvent[] = []
let flushTimer: ReturnType<typeof setTimeout> | null = null
let flushing = false
let listenersAttached = false

function canUseStorage(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined'
}

function newId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return `e-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

export function getOrCreateAnonId(): string {
  if (!canUseStorage()) return `anon-${Date.now()}`
  try {
    const existing = localStorage.getItem(ANON_KEY)
    if (existing && existing.length >= 8) return existing
    const id = newId()
    localStorage.setItem(ANON_KEY, id)
    return id
  } catch {
    return `anon-${Date.now()}`
  }
}

function detectPlatform(): string {
  if (typeof window === 'undefined') return 'unknown'
  try {
    if (Capacitor.isNativePlatform()) {
      return Capacitor.getPlatform()
    }
  } catch {
    /* ignore */
  }
  return 'web'
}

function truncate(value: string | null | undefined, max: number): string | null {
  if (!value) return null
  return value.length <= max ? value : value.slice(0, max)
}

/**
 * Pure helper: strip forbidden / non-scalar props before queueing.
 * Exported for tests; track() always runs this.
 */
export function sanitizeEventProps(props?: EventProps): EventProps {
  if (!props) return {}
  const out: EventProps = {}
  for (const [key, value] of Object.entries(props)) {
    if (value === undefined) continue
    // Never allow free-text fields that could hold PII.
    if (key === 'name' || key === 'note' || key === 'notes' || key === 'title') continue
    if (
      typeof value === 'string' ||
      typeof value === 'number' ||
      typeof value === 'boolean' ||
      value === null
    ) {
      out[key] = typeof value === 'string' ? (truncate(value, 200) as string) : value
    }
  }
  return out
}

function sanitizeProps(props?: EventProps): EventProps {
  return sanitizeEventProps(props)
}

function loadPersistedQueue(): QueuedEvent[] {
  if (!canUseStorage()) return []
  try {
    const raw = localStorage.getItem(QUEUE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as QueuedEvent[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function savePersistedQueue(queue: QueuedEvent[]): void {
  if (!canUseStorage()) return
  try {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(queue.slice(-MAX_QUEUE)))
  } catch {
    /* ignore quota */
  }
}

function mergePending(): QueuedEvent[] {
  const persisted = loadPersistedQueue()
  if (persisted.length === 0) return [...memoryBuffer]
  const ids = new Set(persisted.map((e) => e.id))
  return [...persisted, ...memoryBuffer.filter((e) => !ids.has(e.id))]
}

function scheduleFlush(): void {
  ensureListeners()
  if (flushTimer != null) return
  flushTimer = setTimeout(() => {
    flushTimer = null
    void flushEvents()
  }, FLUSH_MS)
}

function ensureListeners(): void {
  if (listenersAttached || typeof document === 'undefined') return
  listenersAttached = true

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      void flushEvents()
    } else if (document.visibilityState === 'visible') {
      trackAppOpened()
    }
  })

  window.addEventListener('online', () => {
    void flushEvents()
  })

  // First open of this JS lifetime.
  trackAppOpened()
}

function daysSinceLastOpen(now = Date.now()): number | null {
  if (!canUseStorage()) return null
  try {
    const raw = localStorage.getItem(LAST_OPEN_KEY)
    if (!raw) return null
    const prev = Number(raw)
    if (!Number.isFinite(prev) || prev <= 0) return null
    const ms = now - prev
    if (ms < 0) return 0
    return Math.floor(ms / 86_400_000)
  } catch {
    return null
  }
}

function markAppOpened(now = Date.now()): void {
  if (!canUseStorage()) return
  try {
    localStorage.setItem(LAST_OPEN_KEY, String(now))
  } catch {
    /* ignore */
  }
}

/** Record app_opened at most once per visibility return / cold start. */
let lastAppOpenedAt = 0

export function trackAppOpened(): void {
  const now = Date.now()
  // Debounce rapid visibility flips (e.g. React Strict Mode).
  if (now - lastAppOpenedAt < 2000) return
  lastAppOpenedAt = now
  const days = daysSinceLastOpen(now)
  markAppOpened(now)
  track('app_opened', { days_since_last_open: days ?? 0 })
}

/**
 * Fire-and-forget product analytics. Batches every 10s or on visibilitychange.
 * Queues offline; never throws or blocks the UI.
 */
export function track(name: TrackedEventName | string, props?: EventProps): void {
  if (typeof window === 'undefined') return
  ensureListeners()

  const event: QueuedEvent = {
    id: newId(),
    name: truncate(name, 80) ?? 'unknown',
    props: sanitizeProps(props),
    path: truncate(
      typeof window !== 'undefined' ? window.location.pathname || '/' : '/',
      500,
    ),
    app_version: APP_VERSION,
    platform: detectPlatform(),
    anon_id: getOrCreateAnonId(),
    user_id: null,
    created_at: new Date().toISOString(),
  }

  memoryBuffer.push(event)
  if (memoryBuffer.length > MAX_QUEUE) {
    memoryBuffer = memoryBuffer.slice(-MAX_QUEUE)
  }

  // Persist immediately so a crash before flush does not lose events.
  if (canUseStorage()) {
    const merged = mergePending()
    savePersistedQueue(merged)
    memoryBuffer = []
  }

  scheduleFlush()
}

/** Attach flush listeners and record the initial app_opened. Safe to call once from main. */
export function initTracking(): void {
  if (typeof window === 'undefined') return
  ensureListeners()
}

export async function flushEvents(): Promise<void> {
  if (flushing) return
  if (!isSupabaseConfigured()) return
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return

  const pending = mergePending()
  if (pending.length === 0) return

  flushing = true
  memoryBuffer = []

  try {
    const client = createSupabaseClient()
    const { data: sessionData } = await client.auth.getSession()
    const userId = sessionData.session?.user?.id ?? null

    const rows: EventInsert[] = pending.map((e) => ({
      id: e.id,
      created_at: e.created_at,
      user_id: e.user_id ?? userId,
      anon_id: e.anon_id,
      name: e.name,
      props: e.props as Json,
      path: e.path,
      app_version: e.app_version,
      platform: e.platform,
    }))

    const { error } = await client.from('events').insert(rows)
    if (error) {
      // Keep queue for retry.
      savePersistedQueue(pending)
      console.warn('events not recorded', error.message)
      return
    }
    savePersistedQueue([])
  } catch (err) {
    savePersistedQueue(pending)
    console.warn('events flush failed', err)
  } finally {
    flushing = false
  }
}

/** Map smaller-choice minutes to a safe enum prop (no free text). */
export function smallerChoiceProp(
  minutes: number | null,
): '2_min' | '1_min' | 'just_started' {
  if (minutes === 2) return '2_min'
  if (minutes === 1) return '1_min'
  return 'just_started'
}

/** Days since last win for comeback tracking; null if under threshold. */
export function comebackGapDays(
  lastWinDate: string | null,
  today: string,
  threshold = 3,
): number | null {
  if (!lastWinDate) return null
  const from = Date.parse(`${lastWinDate}T12:00:00`)
  const to = Date.parse(`${today}T12:00:00`)
  if (!Number.isFinite(from) || !Number.isFinite(to)) return null
  const gap = Math.round((to - from) / 86_400_000)
  if (gap < threshold) return null
  return gap
}

/** Test helpers */
export function _resetTrackStateForTests(): void {
  memoryBuffer = []
  flushing = false
  lastAppOpenedAt = 0
  if (flushTimer != null) {
    clearTimeout(flushTimer)
    flushTimer = null
  }
  if (canUseStorage()) {
    try {
      localStorage.removeItem(QUEUE_KEY)
    } catch {
      /* ignore */
    }
  }
}

export function _peekQueueForTests(): QueuedEvent[] {
  return mergePending()
}
