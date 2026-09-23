import { describe, expect, it } from 'vitest'
import type { Activity } from './activities'
import type { LogEntry } from './logs'
import {
  accountGap,
  canOfferFreshStart,
  coveragePhrase,
  freshStartBlock,
  freshStartCovering,
  listAccountComebacks,
  longestReturnedGap,
  rankResumable,
  shouldShowWelcomeBack,
  showedUpDayCount,
  takeComebackMilestone,
  tinyStartLine,
  welcomeBackLine,
} from './comeback'

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

function done(activityId: string, date: string): LogEntry {
  return {
    id: `${activityId}-${date}`,
    activity_id: activityId,
    user_id: 'u1',
    type: 'completed',
    source: null,
    started_at: null,
    duration_seconds: 120,
    date,
    note: null,
    created_at: `${date}T12:00:00Z`,
  }
}

describe('welcome back', () => {
  const today = '2026-09-23'

  it('counts quiet days and ignores rest and skip', () => {
    const reading = activity()
    const gap = accountGap({
      activities: [reading],
      entries: [done('a1', '2026-09-18')],
      today,
      restDates: new Set(['2026-09-20']),
    })
    expect(gap.gapDays).toBe(3)
    expect(gap.gapStart).toBe('2026-09-19')
  })

  it('does not treat a skip as a quiet day', () => {
    const reading = activity()
    const gap = accountGap({
      activities: [reading],
      entries: [
        done('a1', '2026-09-19'),
        {
          ...done('a1', '2026-09-21'),
          type: 'postponed',
          source: 'manual',
          duration_seconds: null,
        },
      ],
      today,
    })
    expect(gap.gapDays).toBe(2)
  })

  it('phrases the welcome by gap length', () => {
    expect(welcomeBackLine(4)).toBe("It's been a few days. Welcome back.")
    expect(welcomeBackLine(10)).toBe("It's been a couple of weeks. Good to see you.")
    expect(welcomeBackLine(30)).toBe("It's been a while. That's completely normal.")
  })

  it('shows once per gap, and hides a 24 hour dismiss', () => {
    expect(
      shouldShowWelcomeBack({
        gapDays: 4,
        gapStart: '2026-09-19',
        state: { lastGapStartedAt: null, dismissedUntil: null },
      }),
    ).toBe(true)
    expect(
      shouldShowWelcomeBack({
        gapDays: 4,
        gapStart: '2026-09-19',
        state: { lastGapStartedAt: '2026-09-19', dismissedUntil: null },
      }),
    ).toBe(false)
    expect(
      shouldShowWelcomeBack({
        gapDays: 4,
        gapStart: '2026-09-19',
        state: { lastGapStartedAt: '2026-09-19', dismissedUntil: null },
        visibleGapStart: '2026-09-19',
      }),
    ).toBe(true)
    expect(
      shouldShowWelcomeBack({
        gapDays: 4,
        gapStart: '2026-09-19',
        state: { lastGapStartedAt: null, dismissedUntil: '2026-09-23T18:00:00.000Z' },
        now: new Date('2026-09-23T12:00:00.000Z'),
      }),
    ).toBe(false)
  })

  it('suggests the smaller target, not the first activity', () => {
    const gym = activity({
      id: 'gym',
      name: 'Exercise',
      tracking_mode: 'timer',
      target_value: 45,
      target_unit: 'minutes',
      created_at: '2026-09-01T00:00:00Z',
    })
    const reading = activity({
      id: 'read',
      name: 'Reading',
      tracking_mode: 'timer',
      target_value: 2,
      target_unit: 'minutes',
    })
    const ranked = rankResumable([gym, reading], [], today)
    expect(ranked[0]?.name).toBe('Reading')
    expect(tinyStartLine(ranked[0]!)).toBe('Start with 2 minutes of Reading.')
  })

  it('offers a fresh start after a week and refuses a second within 14 days', () => {
    expect(canOfferFreshStart(6)).toBe(false)
    expect(canOfferFreshStart(8)).toBe(true)
    const blocked = freshStartBlock(
      [{ id: 'f1', startedOn: '2026-09-20', coversFrom: '2026-09-01', coversTo: '2026-09-19' }],
      today,
    )
    expect(blocked.allowed).toBe(false)
    expect(blocked.line).toContain('Sep 20')
    expect(freshStartCovering('2026-09-10', [
      { id: 'f1', startedOn: '2026-09-20', coversFrom: '2026-09-01', coversTo: '2026-09-19' },
    ])?.id).toBe('f1')
    expect(
      coveragePhrase(
        [{ id: 'f1', startedOn: '2026-09-20', coversFrom: '2026-09-01', coversTo: '2026-09-19' }],
        '2026-09-01',
        today,
      ),
    ).toBe('Since your fresh start on Sep 20.')
  })
})

describe('comebacks', () => {
  const today = '2026-09-23'

  it('counts a return after two quiet days and keeps the longest gap', () => {
    const reading = activity()
    const dates = ['2026-09-01', '2026-09-04', '2026-09-09']
    const hits = listAccountComebacks([reading], dates.map((date) => done('a1', date)), today)
    expect(hits.map((hit) => hit.date)).toEqual(['2026-09-04', '2026-09-09'])
    expect(hits.map((hit) => hit.gapDays)).toEqual([2, 4])
    expect(longestReturnedGap(hits)).toBe(4)
    expect(showedUpDayCount(reading, dates.map((date) => done('a1', date)), today)).toBe(3)
  })

  it('does not let a rest day grow or end a quiet run', () => {
    const reading = activity()
    const hits = listAccountComebacks(
      [reading],
      ['2026-09-01', '2026-09-04', '2026-09-09'].map((date) => done('a1', date)),
      today,
      30,
      { restDates: new Set(['2026-09-06']) },
    )
    const second = hits.find((hit) => hit.date === '2026-09-09')
    expect(second?.gapDays).toBe(3)
  })

  it('marks milestones already reached so a rebuild does not toast', () => {
    expect(takeComebackMilestone(5, null)).toEqual({ message: null, seen: [1, 5] })
    expect(takeComebackMilestone(10, [1, 5]).message).toContain('10 comebacks')
    expect(takeComebackMilestone(10, [1, 5, 10]).message).toBeNull()
  })
})
