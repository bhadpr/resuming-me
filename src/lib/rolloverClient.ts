import { createSupabaseClient } from './supabase'
import { listActivities } from './activities'
import { listLogEntriesForActivities, type LogEntry } from './logs'
import { planRollover } from './rollover'
import { addDays, todayLocalDate } from './dates'

export async function insertPostponedEntry(params: {
  userId: string
  activityId: string
  date: string
}): Promise<LogEntry | null> {
  const client = createSupabaseClient()
  const { data, error } = await client
    .from('log_entries')
    .insert({
      user_id: params.userId,
      activity_id: params.activityId,
      type: 'postponed',
      date: params.date,
      source: null,
      started_at: null,
      duration_seconds: null,
      note: null,
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
 * Client-side catch-up: write postponed entries for closed periods in the
 * user's timezone. Safe to call on every app open (idempotent).
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

  // Persist timezone if missing/outdated
  if (!profile) {
    await client.from('profiles').insert({ id: userId, timezone })
  } else if (profile.timezone !== timezone) {
    // Keep browser timezone fresh
    await client.from('profiles').update({ timezone }).eq('id', userId)
  }

  const activities = await listActivities(false)
  const activeIds = activities.map((a) => a.id)
  const today = todayLocalDate()
  const from = addDays(today, -21)
  const entries = await listLogEntriesForActivities(activeIds, from, today)

  const plans = planRollover({
    userId,
    timezone,
    nowUtc: new Date(),
    activities,
    entries,
    lookbackDays: 14,
  })

  let written = 0
  for (const plan of plans) {
    const row = await insertPostponedEntry({
      userId: plan.userId,
      activityId: plan.activityId,
      date: plan.date,
    })
    if (row) written += 1
  }

  return { written, timezone }
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
