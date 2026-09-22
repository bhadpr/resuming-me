import { createSupabaseClient } from './supabase'
import { addDays, todayLocalDate } from './dates'
import {
  isPausedOnDate,
  type ActivityPause,
} from './dayStatus'
import type { Database } from '../types/database'

export type ActivityPauseRow = Database['public']['Tables']['activity_pauses']['Row']

export type PauseDuration = '1_week' | '2_weeks' | 'until_resume'

export { isPausedOnDate }

export function pauseRowToPause(row: ActivityPauseRow): ActivityPause {
  return {
    activityId: row.activity_id,
    from: row.paused_from,
    until: row.paused_until,
  }
}

/** Active pause covering `date` for this activity (open-ended or until ≥ date). */
export function findActivePause(
  rows: ActivityPauseRow[],
  activityId: string,
  date = todayLocalDate(),
): ActivityPauseRow | null {
  return (
    rows.find((row) =>
      isPausedOnDate(activityId, date, [pauseRowToPause(row)]),
    ) ?? null
  )
}

export function pausedUntilForDuration(
  duration: PauseDuration,
  from = todayLocalDate(),
): string | null {
  if (duration === '1_week') return addDays(from, 6)
  if (duration === '2_weeks') return addDays(from, 13)
  return null
}

export async function listActivityPauses(
  fromDate?: string,
): Promise<ActivityPauseRow[]> {
  const client = createSupabaseClient()
  let query = client
    .from('activity_pauses')
    .select('*')
    .order('paused_from', { ascending: false })

  // Include open-ended pauses and any that ended on/after fromDate
  if (fromDate) {
    query = query.or(`paused_until.is.null,paused_until.gte.${fromDate}`)
  }

  const { data, error } = await query
  if (error) throw error
  return data ?? []
}

export async function createActivityPause(params: {
  userId: string
  activityId: string
  duration: PauseDuration
  from?: string
}): Promise<ActivityPauseRow> {
  const from = params.from ?? todayLocalDate()
  const client = createSupabaseClient()
  const { data, error } = await client
    .from('activity_pauses')
    .insert({
      user_id: params.userId,
      activity_id: params.activityId,
      paused_from: from,
      paused_until: pausedUntilForDuration(params.duration, from),
    })
    .select('*')
    .single()

  if (error) throw error
  return data
}

/** End an open pause so `date` is no longer covered (yesterday inclusive end). */
export async function endActivityPause(
  pauseId: string,
  endOn = addDays(todayLocalDate(), -1),
): Promise<ActivityPauseRow> {
  const client = createSupabaseClient()
  const { data, error } = await client
    .from('activity_pauses')
    .update({ paused_until: endOn })
    .eq('id', pauseId)
    .select('*')
    .single()

  if (error) throw error
  return data
}
