import { createSupabaseClient } from './supabase'
import type { LogEntry } from './logs'

export async function insertPostponedEntry(params: {
  userId: string
  activityId: string
  date: string
  /** Optional skip reason chip text. */
  note?: string | null
}): Promise<LogEntry | null> {
  const client = createSupabaseClient()
  const { data, error } = await client
    .from('log_entries')
    .insert({
      user_id: params.userId,
      activity_id: params.activityId,
      type: 'postponed',
      date: params.date,
      // null source = explicit user Skip (distinct from historical source='auto')
      source: null,
      started_at: null,
      duration_seconds: null,
      note: params.note ?? null,
    })
    .select('*')
    .single()

  if (error) {
    // Unique postponed-per-day — treat as already done
    if (error.code === '23505') return null
    throw error
  }
  return data
}

/**
 * Sync the user's timezone profile on app open.
 * Does not write postponed / put-off rows (P1-04).
 */
export async function runClientRolloverCatchUp(userId: string): Promise<{
  written: number
  timezone: string
}> {
  const client = createSupabaseClient()

  const { data: profile } = await client
    .from('profiles')
    .select('timezone')
    .eq('id', userId)
    .maybeSingle()

  const timezone =
    profile?.timezone ||
    Intl.DateTimeFormat().resolvedOptions().timeZone ||
    'UTC'

  if (!profile) {
    await client.from('profiles').insert({ id: userId, timezone })
  } else if (profile.timezone !== timezone) {
    await client.from('profiles').update({ timezone }).eq('id', userId)
  }

  return { written: 0, timezone }
}

export async function rescheduleDeadline(
  activityId: string,
  newDeadline: string,
): Promise<void> {
  const client = createSupabaseClient()
  const { error } = await client
    .from('activities')
    .update({ deadline: newDeadline })
    .eq('id', activityId)
  if (error) throw error
}
