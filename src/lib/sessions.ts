import { createSupabaseClient } from './supabase'
import {
  enqueueSession,
  loadSessionQueue,
  removeQueuedSession,
  type QueuedSession,
} from './timerStorage'
import type { LogEntry } from './logs'
import type { SessionSource } from '../types/database'

function newId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return `local-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

export interface SessionWriteInput {
  userId: string
  activityId: string
  date: string
  durationSeconds: number
  startedAt?: string | null
  source: SessionSource
  /** Optional client-generated id for offline dedupe. */
  id?: string
}

/** Optimistic local row shape before/without server confirm. */
export function toLocalSessionEntry(input: SessionWriteInput & { id: string }): LogEntry {
  return {
    id: input.id,
    user_id: input.userId,
    activity_id: input.activityId,
    type: 'session',
    source: input.source,
    started_at: input.startedAt ?? null,
    duration_seconds: input.durationSeconds,
    date: input.date,
    note: null,
    created_at: new Date().toISOString(),
    updated_at: null,
  }
}

async function insertSessionRemote(input: SessionWriteInput & { id: string }): Promise<LogEntry> {
  const client = createSupabaseClient()
  const { data, error } = await client
    .from('log_entries')
    .insert({
      id: input.id,
      user_id: input.userId,
      activity_id: input.activityId,
      type: 'session',
      source: input.source,
      started_at: input.startedAt ?? null,
      duration_seconds: input.durationSeconds,
      date: input.date,
    })
    .select('*')
    .single()

  if (error) throw error
  return data
}

/**
 * Write a session immediately when online; otherwise queue locally.
 * Always returns a LogEntry suitable for optimistic UI.
 */
export async function writeSessionEntry(input: SessionWriteInput): Promise<{
  entry: LogEntry
  queued: boolean
}> {
  const id = input.id ?? newId()
  const local = toLocalSessionEntry({ ...input, id })

  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    enqueueSession({
      id,
      userId: input.userId,
      activityId: input.activityId,
      date: input.date,
      durationSeconds: input.durationSeconds,
      startedAt: input.startedAt ?? null,
      source: input.source,
      createdAt: local.created_at,
    })
    return { entry: local, queued: true }
  }

  try {
    const entry = await insertSessionRemote({ ...input, id })
    return { entry, queued: false }
  } catch {
    enqueueSession({
      id,
      userId: input.userId,
      activityId: input.activityId,
      date: input.date,
      durationSeconds: input.durationSeconds,
      startedAt: input.startedAt ?? null,
      source: input.source,
      createdAt: local.created_at,
    })
    return { entry: local, queued: true }
  }
}

export async function flushSessionQueue(): Promise<LogEntry[]> {
  const queue = loadSessionQueue()
  if (queue.length === 0) return []

  const synced: LogEntry[] = []
  for (const item of queue) {
    try {
      const entry = await insertSessionRemote({
        id: item.id,
        userId: item.userId,
        activityId: item.activityId,
        date: item.date,
        durationSeconds: item.durationSeconds,
        startedAt: item.startedAt,
        source: item.source,
      })
      removeQueuedSession(item.id)
      synced.push(entry)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      // Already synced earlier — drop from queue
      if (/duplicate|unique/i.test(message)) {
        removeQueuedSession(item.id)
        continue
      }
      // Keep in queue; try again later
      break
    }
  }
  return synced
}

export function queuedSessionsAsLogEntries(): LogEntry[] {
  return loadSessionQueue().map((item: QueuedSession) =>
    toLocalSessionEntry({
      id: item.id,
      userId: item.userId,
      activityId: item.activityId,
      date: item.date,
      durationSeconds: item.durationSeconds,
      startedAt: item.startedAt,
      source: item.source,
    }),
  )
}
