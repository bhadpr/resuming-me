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

export async function markCheckinOpened(): Promise<void> {
  const client = createSupabaseClient()
  const { error } = await client.rpc('mark_checkin_opened')
  if (error) throw error
}
