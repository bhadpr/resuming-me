import { describe, expect, it } from 'vitest'
import type { Activity } from './activities'
import type { LogEntry } from './logs'
import { activeReviewWindow, buildWeeklyReview, DEFAULT_REVIEW_SCHEDULE, focusApplies, formatReviewRange, nextFocusWeekStart } from './weeklyReview'

function activity(overrides: Partial<Activity> = {}): Activity {
  return {
    id: 'a1',
    user_id: 'u1',
    name: 'Reading',
    emoji: '📖',
    type: 'daily',
    tracking_mode: 'checkbox',
    target_value: null,
    target_unit: null,
    target_effective_from: '2026-09-01',
    weekly_target: null,
    deadline: null,
    why_matters: null,
    usually_when: null,
    micro_steps: [],
    archived: false,
    created_at: '2026-09-01T00:00:00Z',
    updated_at: '2026-09-01T00:00:00Z',
    ...overrides,
  }
}

function done(date: string): LogEntry {
  return {
    id: date,
    activity_id: 'a1',
    user_id: 'u1',
    type: 'completed',
    source: null,
    started_at: null,
    duration_seconds: null,
    date,
    note: null,
    created_at: `${date}T12:00:00Z`,
  }
}

describe('weekly review', () => {
  it('opens for 48 hours after Sunday 18:00 UTC', () => {
    const open = activeReviewWindow({
      now: new Date('2026-09-20T18:00:00Z'),
      timeZone: 'UTC',
      schedule: DEFAULT_REVIEW_SCHEDULE,
    })
    expect(open?.weekStart).toBe('2026-09-14')
    expect(
      activeReviewWindow({
        now: new Date('2026-09-20T17:00:00Z'),
        timeZone: 'UTC',
      }),
    ).toBeNull()
    expect(
      activeReviewWindow({
        now: new Date('2026-09-22T19:00:00Z'),
        timeZone: 'UTC',
      }),
    ).toBeNull()
    expect(
      activeReviewWindow({
        now: new Date('2026-09-20T19:00:00Z'),
        timeZone: 'UTC',
        reviewsOff: true,
      }),
    ).toBeNull()
  })

  it('renders a full week, an empty week, and a first week', () => {
    const full = buildWeeklyReview({
      activities: [activity()],
      entries: ['2026-09-14', '2026-09-15', '2026-09-16', '2026-09-17'].map(done),
      today: '2026-09-20',
      weekStart: '2026-09-14',
    })
    expect(full.headline).toBe('You showed up 4 days this week.')
    expect(full.steadiestName).toBe('Reading')

    const empty = buildWeeklyReview({
      activities: [activity()],
      entries: [],
      today: '2026-09-20',
      weekStart: '2026-09-14',
    })
    expect(empty.headline).toBe('Quiet week. It happens.')
    expect(empty.comebackLine).toBe('Quiet week. You can still start.')

    const fresh = buildWeeklyReview({
      activities: [activity({ created_at: '2026-09-18T00:00:00Z' })],
      entries: [done('2026-09-18')],
      today: '2026-09-20',
      weekStart: '2026-09-14',
    })
    expect(fresh.firstWeek).toBe(true)
    expect(fresh.showedUpDays).toBe(1)
  })

  it('treats a rest-only week as quiet', () => {
    const review = buildWeeklyReview({
      activities: [activity()],
      entries: [],
      today: '2026-09-20',
      weekStart: '2026-09-14',
      restDates: new Set(['2026-09-14', '2026-09-15', '2026-09-16', '2026-09-17', '2026-09-18', '2026-09-19', '2026-09-20']),
    })
    expect(review.headline).toBe('Quiet week. It happens.')
    expect(review.showedUpDays).toBe(0)
  })

  it('pins a focus to the week after the review', () => {
    expect(nextFocusWeekStart('2026-09-14')).toBe('2026-09-21')
    expect(focusApplies('2026-09-21', '2026-09-23')).toBe(true)
    expect(focusApplies('2026-09-14', '2026-09-23')).toBe(false)
  })

  it('writes the review range as a short date', () => {
    expect(formatReviewRange('2026-09-14', '2026-09-20')).toBe('Sep 14–20')
    expect(formatReviewRange('2026-09-28', '2026-10-04')).toBe('Sep 28–Oct 4')
  })
})
