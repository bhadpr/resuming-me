import { createSupabaseClient } from './supabase'
import type { Database } from '../types/database'

export type RestDay = Database['public']['Tables']['rest_days']['Row']

export async function listRestDays(
  fromDate: string,
  toDate: string,
): Promise<RestDay[]> {
  const client = createSupabaseClient()
  const { data, error } = await client
    .from('rest_days')
    .select('*')
    .gte('date', fromDate)
    .lte('date', toDate)
    .order('date', { ascending: true })

  if (error) throw error
  return data ?? []
}

export async function markRestDay(params: {
  userId: string
  date: string
}): Promise<RestDay> {
  const client = createSupabaseClient()
  const { data, error } = await client
    .from('rest_days')
    .insert({
      user_id: params.userId,
      date: params.date,
    })
    .select('*')
    .single()

  if (error) {
    // Unique per user/day — treat as already marked
    if (error.code === '23505') {
      const { data: existing, error: readError } = await client
        .from('rest_days')
        .select('*')
        .eq('user_id', params.userId)
        .eq('date', params.date)
        .single()
      if (readError) throw readError
      return existing
    }
    throw error
  }
  return data
}

export async function unmarkRestDay(id: string): Promise<void> {
  const client = createSupabaseClient()
  const { error } = await client.from('rest_days').delete().eq('id', id)
  if (error) throw error
}

export function restDayDates(rows: RestDay[]): Set<string> {
  return new Set(rows.map((r) => r.date))
}
