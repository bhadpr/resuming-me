import { summarizeFeedback } from './feedback'
import { describe, expect, it } from 'vitest'
import type { FeedbackRow } from './feedback'

function row(overrides: Partial<FeedbackRow> = {}): FeedbackRow {
  return {
    id: '1',
    user_id: null,
    rating: 5,
    liked: null,
    improve: null,
    wish: null,
    name: null,
    email: null,
    created_at: '2026-08-18T00:00:00.000Z',
    ...overrides,
  }
}

describe('summarizeFeedback', () => {
  it('is empty with no rows', () => {
    expect(summarizeFeedback([])).toEqual({ count: 0, averageRating: null })
  })

  it('averages ratings', () => {
    const summary = summarizeFeedback([row({ id: 'a', rating: 5 }), row({ id: 'b', rating: 3 })])
    expect(summary.count).toBe(2)
    expect(summary.averageRating).toBe(4)
  })
})
