import { createSupabaseClient } from './supabase'
import type { Database } from '../types/database'

export type FeedbackRow = Database['public']['Tables']['feedback']['Row']

export interface FeedbackInput {
  rating: number
  liked?: string
  improve?: string
  wish?: string
  name?: string
  email?: string
}

export interface FeedbackSummary {
  count: number
  averageRating: number | null
}

function emptyToNull(value: string | undefined): string | null {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

export async function submitFeedback(input: FeedbackInput): Promise<void> {
  if (!Number.isInteger(input.rating) || input.rating < 1 || input.rating > 5) {
    throw new Error('Please choose a star rating.')
  }

  const client = createSupabaseClient()
  const {
    data: { user },
  } = await client.auth.getUser()

  const { error } = await client.from('feedback').insert({
    user_id: user?.id ?? null,
    rating: input.rating,
    liked: emptyToNull(input.liked),
    improve: emptyToNull(input.improve),
    wish: emptyToNull(input.wish),
    name: emptyToNull(input.name),
    email: emptyToNull(input.email),
  })

  if (error) throw error
}

export async function fetchFeedbackForAdmin(): Promise<FeedbackRow[]> {
  const client = createSupabaseClient()
  const { data, error } = await client
    .from('feedback')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(500)

  if (error) {
    if (/permission denied|row-level security|42501/i.test(error.message + error.code)) {
      throw new Error(
        'Apply supabase/migrations/20260818200000_admin_read_feedback.sql in the Supabase SQL Editor.',
      )
    }
    throw error
  }

  return data ?? []
}

export function summarizeFeedback(rows: FeedbackRow[]): FeedbackSummary {
  if (rows.length === 0) return { count: 0, averageRating: null }
  const total = rows.reduce((sum, row) => sum + row.rating, 0)
  return {
    count: rows.length,
    averageRating: total / rows.length,
  }
}

export function formatFeedbackTime(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return 'Unknown'
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}
