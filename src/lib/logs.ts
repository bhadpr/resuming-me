import { createSupabaseClient } from './supabase'
import type { Database } from '../types/database'

export type LogEntry = Database['public']['Tables']['log_entries']['Row']

export async function listLogEntriesForRange(
  fromDate: string,
  toDate: string,
): Promise<LogEntry[]> {
  const client = createSupabaseClient()
  const { data, error } = await client
    .from('log_entries')
    .select('*')
    .gte('date', fromDate)
    .lte('date', toDate)
    .order('date', { ascending: false })

  if (error) throw error
  return data ?? []
}

export async function listLogEntriesForActivities(
  activityIds: string[],
  fromDate: string,
  toDate: string,
): Promise<LogEntry[]> {
  if (activityIds.length === 0) return []

  const client = createSupabaseClient()
  const { data, error } = await client
    .from('log_entries')
    .select('*')
    .in('activity_id', activityIds)
    .gte('date', fromDate)
    .lte('date', toDate)
    .order('created_at', { ascending: false })

  if (error) throw error
  return data ?? []
}

/** Recent postponed entries used for overdue sorting (last ~90 days). */
export async function listRecentPostponed(
  activityIds: string[],
  fromDate: string,
): Promise<LogEntry[]> {
  if (activityIds.length === 0) return []

  const client = createSupabaseClient()
  const { data, error } = await client
    .from('log_entries')
    .select('*')
    .in('activity_id', activityIds)
    .eq('type', 'postponed')
    .gte('date', fromDate)
    .order('date', { ascending: false })

  if (error) throw error
  return data ?? []
}

export async function insertCompletedEntry(params: {
  userId: string
  activityId: string
  date: string
  note?: string | null
}): Promise<LogEntry> {
  const client = createSupabaseClient()
  const { data, error } = await client
    .from('log_entries')
    .insert({
      user_id: params.userId,
      activity_id: params.activityId,
      type: 'completed',
      date: params.date,
      note: params.note ?? null,
      source: null,
      started_at: null,
      duration_seconds: null,
    })
    .select('*')
    .single()

  if (error) throw error
  return data
}

export async function listLogEntriesForActivity(
  activityId: string,
): Promise<LogEntry[]> {
  const client = createSupabaseClient()
  const { data, error } = await client
    .from('log_entries')
    .select('*')
    .eq('activity_id', activityId)
    .order('date', { ascending: false })
    .order('created_at', { ascending: false })

  if (error) throw error
  return data ?? []
}

export async function updateLogEntry(
  id: string,
  updates: {
    date?: string
    duration_seconds?: number | null
    note?: string | null
  },
): Promise<LogEntry> {
  const client = createSupabaseClient()
  const { data, error } = await client
    .from('log_entries')
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select('*')
    .single()

  if (error) throw error
  return data
}

export async function deleteLogEntry(id: string): Promise<void> {
  const client = createSupabaseClient()
  const { error } = await client.from('log_entries').delete().eq('id', id)
  if (error) throw error
}

export async function deleteCompletedEntriesForActivity(
  activityId: string,
): Promise<void> {
  const client = createSupabaseClient()
  const { error } = await client
    .from('log_entries')
    .delete()
    .eq('activity_id', activityId)
    .eq('type', 'completed')

  if (error) throw error
}

export async function deleteCompletedEntriesForDate(
  activityId: string,
  date: string,
): Promise<void> {
  const client = createSupabaseClient()
  const { error } = await client
    .from('log_entries')
    .delete()
    .eq('activity_id', activityId)
    .eq('date', date)
    .eq('type', 'completed')

  if (error) throw error
}
