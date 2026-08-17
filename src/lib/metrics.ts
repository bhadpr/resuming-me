import { createSupabaseClient } from './supabase'
import type { Database } from '../types/database'

export type Metric = Database['public']['Tables']['metrics']['Row']

export interface MetricInput {
  name: string
  emoji: string
  unit: string
}

export const STARTER_METRICS: MetricInput[] = [
  { name: 'Weight', emoji: '⚖️', unit: 'lbs' },
  { name: 'Sleep', emoji: '💤', unit: 'hrs' },
]

export function validateMetricInput(input: MetricInput): string | null {
  if (!input.name.trim()) return 'Name is required'
  if (!input.emoji.trim()) return 'Pick an emoji'
  if (!input.unit.trim()) return 'Unit is required'
  return null
}

export async function listMetrics(includeArchived = false): Promise<Metric[]> {
  const client = createSupabaseClient()
  let query = client
    .from('metrics')
    .select('*')
    .order('created_at', { ascending: false })

  if (!includeArchived) {
    query = query.eq('archived', false)
  }

  const { data, error } = await query
  if (error) throw error
  return data ?? []
}

export async function createMetric(
  userId: string,
  input: MetricInput,
): Promise<Metric> {
  const validationError = validateMetricInput(input)
  if (validationError) throw new Error(validationError)

  const client = createSupabaseClient()
  const { data, error } = await client
    .from('metrics')
    .insert({
      user_id: userId,
      name: input.name.trim(),
      emoji: input.emoji.trim(),
      unit: input.unit.trim(),
      archived: false,
    })
    .select('*')
    .single()

  if (error) throw error
  return data
}

export async function updateMetric(
  existing: Metric,
  input: MetricInput,
): Promise<Metric> {
  const validationError = validateMetricInput(input)
  if (validationError) throw new Error(validationError)

  const client = createSupabaseClient()
  const { data, error } = await client
    .from('metrics')
    .update({
      name: input.name.trim(),
      emoji: input.emoji.trim(),
      unit: input.unit.trim(),
    })
    .eq('id', existing.id)
    .select('*')
    .single()

  if (error) throw error
  return data
}

export async function archiveMetric(id: string): Promise<void> {
  const client = createSupabaseClient()
  const { error } = await client.from('metrics').update({ archived: true }).eq('id', id)
  if (error) throw error
}

export async function unarchiveMetric(id: string): Promise<void> {
  const client = createSupabaseClient()
  const { error } = await client.from('metrics').update({ archived: false }).eq('id', id)
  if (error) throw error
}

export async function deleteMetric(id: string): Promise<void> {
  const client = createSupabaseClient()
  const { error } = await client.from('metrics').delete().eq('id', id)
  if (error) throw error
}

export function describeMetric(metric: Metric): string {
  return `Logged in ${metric.unit}`
}
