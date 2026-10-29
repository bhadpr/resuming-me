import { requireAccountId } from './accountId'
import { describeError } from './describeError'
import { createSupabaseClient } from './supabase'
import type { Database } from '../types/database'
import { habitTemplateId } from '../data/habitArt'
import { t } from './i18n'
import { standardVitalTarget } from './onboardingFlow'
import { setVitalNote, vitalNote, vitalTarget } from './vitalTargets'
import { vitalKey } from './vitalKey'

export type Metric = Database['public']['Tables']['metrics']['Row']

export interface MetricInput {
  name: string
  emoji: string
  unit: string
  templateId?: string | null
  nameOverridden?: boolean
  /** The person's own line for this vital. */
  description?: string | null
}

export function cleanVitalDescription(value: string | null | undefined): string | null {
  const next = value?.replace(/\s+/g, ' ').trim().slice(0, 80) ?? ''
  return next || null
}

function columnMissing(error: { message?: string; code?: string } | null): boolean {
  if (!error) return false
  return error.code === 'PGRST204' || /schema cache|does not exist/i.test(error.message ?? '')
}

export const STARTER_METRICS: MetricInput[] = [
  { name: 'Weight', emoji: '⚖️', unit: 'kg' },
  { name: 'Daily Steps', emoji: '👣', unit: 'steps' },
  { name: 'Blood Pressure', emoji: '❤️', unit: 'mmHg' },
  { name: 'Heart Rate', emoji: '💓', unit: 'bpm' },
  { name: 'Water', emoji: '💧', unit: 'glasses' },
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
  _userId: string,
  input: MetricInput,
): Promise<Metric> {
  const validationError = validateMetricInput(input)
  if (validationError) throw new Error(validationError)

  const client = createSupabaseClient()
  const ownerId = await requireAccountId()
  const description =
    input.description === undefined ? undefined : cleanVitalDescription(input.description)
  const key = vitalKey({ templateId: input.templateId, name: input.name })
  if (key) {
    const { data: existingRows } = await client
      .from('metrics')
      .select('*')
      .eq('user_id', ownerId)
      .eq('archived', false)
    const match = (existingRows ?? []).find((row) => vitalKey(row) === key)
    if (match) return updateMetric(match, input)
  }

  const base = {
    user_id: ownerId,
    name: input.name.trim(),
    emoji: input.emoji.trim(),
    unit: input.unit.trim(),
    archived: false,
    template_id: input.templateId ?? null,
    name_overridden: input.nameOverridden ?? false,
  }
  const row = {
    ...base,
    ...(description === undefined ? {} : { description }),
  }
  let { data, error } = await client.from('metrics').insert(row).select('*').single()
  if (error && columnMissing(error)) {
    const retry = await client.from('metrics').insert(base).select('*').single()
    data = retry.data
    error = retry.error
  }

  if (error) throw new Error(describeError(error, 'Save failed'))
  if (!data) throw new Error('Save failed')
  if (description) setVitalNote(data.id, description)
  return description === undefined ? data : { ...data, description: data.description ?? description }
}

export async function updateMetric(
  existing: Metric,
  input: MetricInput,
): Promise<Metric> {
  const validationError = validateMetricInput(input)
  if (validationError) throw new Error(validationError)

  const client = createSupabaseClient()
  const description =
    input.description === undefined ? undefined : cleanVitalDescription(input.description)
  const base = {
    name: input.name.trim(),
    emoji: input.emoji.trim(),
    unit: input.unit.trim(),
    template_id: input.templateId ?? existing.template_id ?? null,
    name_overridden: input.nameOverridden ?? existing.name_overridden ?? false,
  }
  let { data, error } = await client
    .from('metrics')
    .update(description === undefined ? base : { ...base, description })
    .eq('id', existing.id)
    .select('*')
    .single()
  if (error && columnMissing(error)) {
    const retry = await client.from('metrics').update(base).eq('id', existing.id).select('*').single()
    data = retry.data
    error = retry.error
  }

  if (error) throw error
  if (!data) throw new Error('Save failed')
  if (description !== undefined) setVitalNote(existing.id, description)
  return description === undefined ? data : { ...data, description: data.description ?? description }
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
  const note = cleanVitalDescription(metric.description) ?? vitalNote(metric.id)
  if (note) return note
  const target = metric.target_value ?? vitalTarget(metric.id)
  if (target != null) return t('start.targetValue', { value: String(target), unit: metric.unit })
  const standard = standardVitalTarget(metric.template_id ?? habitTemplateId({ name: metric.name }))
  if (standard) return t(standard)
  if (isBloodPressure(metric)) return 'Upper and lower, in mmHg'
  return `Logged in ${metric.unit}`
}
