import { createSupabaseClient } from './supabase'

export async function loadCheckinOptOut(userId: string): Promise<boolean> {
  const client = createSupabaseClient()
  const { data, error } = await client
    .from('profiles')
    .select('checkins_opt_out')
    .eq('id', userId)
    .maybeSingle()
  if (error) throw error
  return data?.checkins_opt_out ?? false
}

export async function saveCheckinOptOut(userId: string, optOut: boolean): Promise<void> {
  const client = createSupabaseClient()
  const { error } = await client
    .from('profiles')
    .update({ checkins_opt_out: optOut })
    .eq('id', userId)
  if (error) throw error
}

export async function loadReminderTime(userId: string): Promise<string | null> {
  const client = createSupabaseClient()
  const { data, error } = await client
    .from('profiles')
    .select('reminder_time')
    .eq('id', userId)
    .maybeSingle()
  if (error) throw error
  const time = data?.reminder_time?.slice(0, 5) ?? ''
  return time.length === 5 ? time : null
}

export async function saveReminderTime(userId: string, time: string): Promise<void> {
  const client = createSupabaseClient()
  const { error } = await client
    .from('profiles')
    .update({ reminder_time: time })
    .eq('id', userId)
  if (error) throw error
}

/** 19:00 → 7:00 pm. Used for the Settings email line. */
export function formatReminderClock(time: string): string {
  const [hourText, minuteText] = time.split(':')
  const hour24 = Number(hourText)
  const minute = Number(minuteText)
  if (!Number.isFinite(hour24) || !Number.isFinite(minute)) return time
  const suffix = hour24 >= 12 ? 'pm' : 'am'
  const hour12 = hour24 % 12 || 12
  const minutes = String(minute).padStart(2, '0')
  return `${hour12}:${minutes} ${suffix}`
}

export function emailReminderLine(time: string): string {
  return `Email at ${formatReminderClock(time)} if it's still open. Nothing if you're done.`
}

export async function markCheckinOpened(): Promise<void> {
  const client = createSupabaseClient()
  const { error } = await client.rpc('mark_checkin_opened')
  if (error) throw error
}
