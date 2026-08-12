import { createSupabaseClient } from './supabase'

export interface FeedbackInput {
  rating: number
  liked?: string
  improve?: string
  wish?: string
  name?: string
  email?: string
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
