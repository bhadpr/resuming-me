import { describe, expect, it } from 'vitest'
import {
  findActivePause,
  pauseRowToPause,
  pausedUntilForDuration,
  type ActivityPauseRow,
} from './activityPauses'
import { restDayDates, type RestDay } from './restDays'

function pauseRow(overrides: Partial<ActivityPauseRow> = {}): ActivityPauseRow {
  return {
    id: 'p1',
    user_id: 'u1',
    activity_id: 'a1',
    paused_from: '2026-09-20',
    paused_until: null,
    created_at: '2026-09-20T12:00:00Z',
    ...overrides,
  }
}

describe('pausedUntilForDuration', () => {
  it('maps 1 week / 2 weeks / until resume', () => {
    expect(pausedUntilForDuration('1_week', '2026-09-22')).toBe('2026-09-28')
    expect(pausedUntilForDuration('2_weeks', '2026-09-22')).toBe('2026-10-05')
    expect(pausedUntilForDuration('until_resume', '2026-09-22')).toBeNull()
  })
})

describe('pauseRowToPause / findActivePause', () => {
  it('maps a row to the dayStatus pause shape', () => {
    expect(pauseRowToPause(pauseRow({ paused_until: '2026-09-28' }))).toEqual({
      activityId: 'a1',
      from: '2026-09-20',
      until: '2026-09-28',
    })
  })

  it('finds the open-ended pause covering today', () => {
    const rows = [
      pauseRow({ id: 'old', activity_id: 'a2', paused_from: '2026-09-01' }),
      pauseRow({ id: 'active', paused_from: '2026-09-20', paused_until: null }),
    ]
    expect(findActivePause(rows, 'a1', '2026-09-22')?.id).toBe('active')
    expect(findActivePause(rows, 'a2', '2026-09-22')?.id).toBe('old')
    expect(findActivePause(rows, 'a3', '2026-09-22')).toBeNull()
  })

  it('ignores pauses that ended before the date', () => {
    const rows = [
      pauseRow({ paused_from: '2026-09-01', paused_until: '2026-09-10' }),
    ]
    expect(findActivePause(rows, 'a1', '2026-09-22')).toBeNull()
  })
})

describe('restDayDates', () => {
  it('collects unique rest dates', () => {
    const rows: RestDay[] = [
      {
        id: 'r1',
        user_id: 'u1',
        date: '2026-09-21',
        created_at: 't',
      },
      {
        id: 'r2',
        user_id: 'u1',
        date: '2026-09-22',
        created_at: 't',
      },
    ]
    expect(restDayDates(rows)).toEqual(new Set(['2026-09-21', '2026-09-22']))
    expect(restDayDates([])).toEqual(new Set())
  })
})
