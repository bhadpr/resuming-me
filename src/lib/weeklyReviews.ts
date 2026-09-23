import type { Json } from '../types/database'
import { createSupabaseClient } from './supabase'
import type { WeeklyReview } from './weeklyReview'

export async function upsertWeeklyReview(userId: string, review: WeeklyReview): Promise<void> {
  const { error } = await createSupabaseClient()
    .from('weekly_reviews')
    .upsert(
      {
        user_id: userId,
        week_start: review.weekStart,
        payload: review as unknown as Json,
      },
      { onConflict: 'user_id,week_start' },
    )
  if (error) throw error
}
