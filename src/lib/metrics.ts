import { createSupabaseClient } from './supabase'
import type { Database } from '../types/database'

export type Metric = Database['public']['Tables']['metrics']['Row']

export interface MetricInput {
  name: string
  emoji: string
  unit: string
}

export const STARTER_METRICS: MetricInput[] = [
  { name: 'Weight', emoji: '⚖️', unit: 'kg' },
  { name: 'Daily Steps', emoji: '👣', unit: 'steps' },
  { name: 'Blood Pressure', emoji: '❤️', unit: 'mmHg' },
  { name: 'Heart Rate', emoji: '💓', unit: 'bpm' },
  { name: 'Water', emoji: '💧', unit: 'glasses' },
  { name: 'Sleep', emoji: '😴', unit: 'hours' },
  { name: 'Protein', emoji: '🍽️', unit: 'g' },
  { name: 'Fasting', emoji: '🌙', unit: 'hours' },
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

export function isBloodPressure(metric: { name: string }): boolean {
  return metric.name.trim().toLowerCase() === 'blood pressure'
}

export function formatMetricReading(
  value: number,
  unit: string,
  secondary?: number | null,
): string {
  if (secondary != null) return `${value}/${secondary} ${unit}`
  return `${value} ${unit}`
}

export function describeMetric(metric: Metric): string {
  if (isBloodPressure(metric)) return 'Upper and lower, in mmHg'
  return `Logged in ${metric.unit}`
}
