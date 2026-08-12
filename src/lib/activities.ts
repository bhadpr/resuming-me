import { createSupabaseClient } from './supabase'
import { todayLocalDate, yesterdayLocalDate } from './dates'
import type { ActivityType, TrackingMode } from '../types/database'
import type { Database } from '../types/database'

export type Activity = Database['public']['Tables']['activities']['Row']

export interface ActivityInput {
  name: string
  emoji: string
  type: ActivityType
  trackingMode: TrackingMode
  targetValue: number | null
  targetUnit: string | null
  weeklyTarget: number | null
  deadline: string | null
}

export function validateActivityInput(input: ActivityInput): string | null {
  if (!input.name.trim()) return 'Name is required'
  if (!input.emoji.trim()) return 'Pick an emoji'

  if (input.type === 'weekly_n') {
    if (!input.weeklyTarget || input.weeklyTarget < 1) {
      return 'Weekly target must be at least 1'
    }
  }

  if (input.type === 'deadline') {
    if (!input.deadline) return 'Deadline date is required'
  }

  if (input.trackingMode === 'timer' || input.trackingMode === 'count') {
    if (input.type !== 'deadline' && (input.targetValue == null || input.targetValue <= 0)) {
      return 'Target value must be greater than 0'
    }
  }

  if (input.trackingMode === 'timer' && input.type !== 'deadline' && !input.targetUnit) {
    return 'Target unit is required for timer activities'
  }

  return null
}

export function targetFieldsChanged(
  existing: Activity,
  input: ActivityInput,
): boolean {
  const sameValue =
    (existing.target_value ?? null) === (input.targetValue ?? null)
  const sameUnit = (existing.target_unit ?? null) === (input.targetUnit ?? null)
  const sameWeekly =
    (existing.weekly_target ?? null) === (input.weeklyTarget ?? null)
  return !(sameValue && sameUnit && sameWeekly)
}

function toInsertRow(userId: string, input: ActivityInput, effectiveFrom: string) {
  return {
    user_id: userId,
    name: input.name.trim(),
    emoji: input.emoji.trim(),
    type: input.type,
    tracking_mode: input.trackingMode,
    target_value: input.type === 'deadline' ? null : input.targetValue,
    target_unit:
      input.type === 'deadline' || input.trackingMode === 'checkbox'
        ? null
        : input.targetUnit,
    target_effective_from: effectiveFrom,
    weekly_target: input.type === 'weekly_n' ? input.weeklyTarget : null,
    deadline: input.type === 'deadline' ? input.deadline : null,
    archived: false,
  }
}

export async function listActivities(
  includeArchived = false,
): Promise<Activity[]> {
  const client = createSupabaseClient()
  let query = client
    .from('activities')
    .select('*')
    .order('created_at', { ascending: false })

  if (!includeArchived) {
    query = query.eq('archived', false)
  }

  const { data, error } = await query
  if (error) throw error
  return data ?? []
}

export async function getActivity(id: string): Promise<Activity | null> {
  const client = createSupabaseClient()
  const { data, error } = await client
    .from('activities')
    .select('*')
    .eq('id', id)
    .maybeSingle()
  if (error) throw error
  return data
}

export async function createActivity(
  userId: string,
  input: ActivityInput,
): Promise<Activity> {
  const validationError = validateActivityInput(input)
  if (validationError) throw new Error(validationError)

  const client = createSupabaseClient()
  const today = todayLocalDate()
  const row = toInsertRow(userId, input, today)

  const { data: activity, error } = await client
    .from('activities')
    .insert(row)
    .select('*')
    .single()

  if (error) throw error

  const { error: historyError } = await client.from('activity_target_history').insert({
    activity_id: activity.id,
    user_id: userId,
    target_value: activity.target_value,
    target_unit: activity.target_unit,
    weekly_target: activity.weekly_target,
    effective_from: today,
    effective_until: null,
  })

  if (historyError) throw historyError
  return activity
}

export async function updateActivity(
  existing: Activity,
  input: ActivityInput,
): Promise<Activity> {
  const validationError = validateActivityInput(input)
  if (validationError) throw new Error(validationError)

  const client = createSupabaseClient()
  const today = todayLocalDate()
  const targetChanged = targetFieldsChanged(existing, input)

  const updates: Database['public']['Tables']['activities']['Update'] = {
    name: input.name.trim(),
    emoji: input.emoji.trim(),
    type: input.type,
    tracking_mode: input.trackingMode,
    target_value: input.type === 'deadline' ? null : input.targetValue,
    target_unit:
      input.type === 'deadline' || input.trackingMode === 'checkbox'
        ? null
        : input.targetUnit,
    weekly_target: input.type === 'weekly_n' ? input.weeklyTarget : null,
    deadline: input.type === 'deadline' ? input.deadline : null,
  }

  if (targetChanged) {
    updates.target_effective_from = today

    // Close prior history window ending yesterday (or today-1)
    const yesterday = yesterdayLocalDate()
    const { data: openHistory } = await client
      .from('activity_target_history')
      .select('id, effective_from')
      .eq('activity_id', existing.id)
      .is('effective_until', null)
      .order('effective_from', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (openHistory) {
      const effectiveUntil =
        openHistory.effective_from >= today ? openHistory.effective_from : yesterday
      await client
        .from('activity_target_history')
        .update({ effective_until: effectiveUntil })
        .eq('id', openHistory.id)
    }

    await client.from('activity_target_history').insert({
      activity_id: existing.id,
      user_id: existing.user_id,
      target_value: updates.target_value ?? null,
      target_unit: updates.target_unit ?? null,
      weekly_target: updates.weekly_target ?? null,
      effective_from: today,
      effective_until: null,
    })
  }

  const { data, error } = await client
    .from('activities')
    .update(updates)
    .eq('id', existing.id)
    .select('*')
    .single()

  if (error) throw error
  return data
}

export async function archiveActivity(id: string): Promise<void> {
  const client = createSupabaseClient()
  const { error } = await client
    .from('activities')
    .update({ archived: true })
    .eq('id', id)
  if (error) throw error
}

export async function unarchiveActivity(id: string): Promise<void> {
  const client = createSupabaseClient()
  const { error } = await client
    .from('activities')
    .update({ archived: false })
    .eq('id', id)
  if (error) throw error
}

export async function deleteActivity(id: string): Promise<void> {
  const client = createSupabaseClient()
  const { error } = await client.from('activities').delete().eq('id', id)
  if (error) throw error
}

export async function updateActivityMicroSteps(
  id: string,
  steps: { text: string; minutes?: number }[],
): Promise<Activity> {
  const client = createSupabaseClient()
  const { data, error } = await client
    .from('activities')
    .update({ micro_steps: steps })
    .eq('id', id)
    .select('*')
    .single()

  if (error) throw error
  return data
}

export function describeActivity(activity: Activity): string {
  if (activity.type === 'deadline') {
    return `Due ${activity.deadline}`
  }
  if (activity.type === 'weekly_n') {
    if (activity.tracking_mode === 'timer' && activity.target_value) {
      return `${activity.weekly_target}× / week · ${activity.target_value} ${activity.target_unit ?? 'min'}`
    }
    return `${activity.weekly_target}× / week`
  }
  // daily
  if (activity.tracking_mode === 'checkbox') return 'Daily'
  if (activity.tracking_mode === 'count') {
    return `${activity.target_value ?? 1} / day`
  }
  return `${activity.target_value ?? 0} ${activity.target_unit ?? 'min'} / day`
}
