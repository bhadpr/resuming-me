import { createSupabaseClient } from './supabase'
import type { Database } from '../types/database'

export type MetricEntry = Database['public']['Tables']['metric_entries']['Row']

export async function listMetricEntriesForDate(date: string): Promise<MetricEntry[]> {
  const client = createSupabaseClient()
  const { data, error } = await client
    .from('metric_entries')
    .select('*')
    .eq('date', date)

  if (error) throw error
  return data ?? []
}

export async function listMetricEntriesForMetric(
  metricId: string,
  fromDate?: string,
): Promise<MetricEntry[]> {
  const client = createSupabaseClient()
  let query = client
    .from('metric_entries')
    .select('*')
    .eq('metric_id', metricId)
    .order('date', { ascending: true })

  if (fromDate) {
    query = query.gte('date', fromDate)
  }

  const { data, error } = await query
  if (error) throw error
  return data ?? []
}

/** Insert or overwrite today's value for a metric (unique on metric_id + date). */
export async function upsertMetricEntry(params: {
  userId: string
  metricId: string
  date: string
  value: number
}): Promise<MetricEntry> {
  const client = createSupabaseClient()

  const { data: existing } = await client
    .from('metric_entries')
    .select('*')
    .eq('metric_id', params.metricId)
    .eq('date', params.date)
    .maybeSingle()

  if (existing) {
    const { data, error } = await client
      .from('metric_entries')
      .update({ value: params.value })
      .eq('id', existing.id)
      .select('*')
      .single()
    if (error) throw error
    return data
  }

  const { data, error } = await client
    .from('metric_entries')
    .insert({
      user_id: params.userId,
      metric_id: params.metricId,
      date: params.date,
      value: params.value,
    })
    .select('*')
    .single()

  if (error) throw error
  return data
}
